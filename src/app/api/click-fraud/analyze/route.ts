import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { apiResponse, apiError, withErrorHandler } from '@/lib/api-helpers';
import { callAi } from '@/lib/ai/ai-client';
import { getModelForFeature } from '@/lib/ai/model-router';
import { parseJsonResponse } from '@/lib/ai/response-parser';
import { isAiFeatureEnabled } from '@/lib/ai/feature-flags';

export const maxDuration = 60;

export const POST = withErrorHandler(async (req: NextRequest) => {
  const authHeader = req.headers.get('authorization');
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return apiError('Unauthorized', 401);
  }

  if (!isAiFeatureEnabled('AI_FEATURE_CLICK_FRAUD')) {
    return apiResponse({ message: 'Click fraud AI feature is disabled', analyzed: 0 });
  }

  // 최근 분석 이후 데이터만 조회
  const recentEvents = await prisma.clickFraudEvent.findMany({
    where: { status: 'pending' },
    orderBy: { createdAt: 'desc' },
    take: 200,
    select: {
      id: true, ipHash: true, dwellTimeMs: true, geoCountry: true,
      deviceFingerprint: true, fraudScore: true, clickTimestamp: true,
      organizationId: true, naverAccountId: true,
    },
  });

  if (recentEvents.length === 0) {
    return apiResponse({ message: 'No pending events', analyzed: 0 });
  }

  const aiResult = await callAi({
    systemPrompt: `당신은 디지털 광고 보안 전문가 AI "AdPilot"으로, 네이버 검색광고 부정클릭 탐지를 담당합니다.
오탐(정상 클릭을 부정클릭으로 잘못 분류)은 광고 효율을 직접 손상시킵니다. 불확실하면 반드시 safe로 판단합니다.

<scoring_formula>
fraudScore = 각 신호의 가산점 합계 (최대 1.0으로 클리핑):
  dwellScore:
    dwellTimeMs < 200ms   → +0.40  (즉시 이탈, 봇 의심)
    dwellTimeMs 200~1000ms → +0.20  (짧은 체류)
    dwellTimeMs ≥ 1000ms  → +0.00  (정상)
  geoScore:
    geoCountry ≠ "KR"    → +0.30  (내국인 타겟 광고 해외 클릭)
    geoCountry = "KR"    → +0.00
  fingerprintScore:
    fingerprint = null/empty           → +0.20
    동일 지문 반복 패턴(배치 내 중복) → +0.30
    정상 지문                          → +0.00
fraudScore = min(1.0, dwellScore + geoScore + fingerprintScore)
</scoring_formula>

<decision_rules>
fraudScore ≥ 0.80 AND 이상 신호 2가지 이상 조합 → "block"
fraudScore 0.50~0.79                                → "monitor"
fraudScore < 0.50 OR 단일 신호만 존재              → "safe"
※ 단일 신호만으로는 절대 "block" 판정하지 않는다
※ null 값이 많아 데이터 불완전 시 → "safe" 강제
</decision_rules>

<few_shot_examples>
✅ GOOD 예시 1 — block 정당:
  입력: dwellTimeMs=150, geoCountry="US", fingerprint=null
  계산: dwell(0.40) + geo(0.30) + fingerprint(0.20) = 0.90, 신호 3개
  출력: {"fraudScore": 0.90, "scoreBreakdown": "dwell(+0.40)+geo(+0.30)+fingerprint(+0.20)", "recommendation": "block", "reason": "150ms 즉시이탈 + 해외(US) + 지문미수집 3중 이상 신호"}

✅ GOOD 예시 2 — safe 정당:
  입력: dwellTimeMs=3500, geoCountry="KR", fingerprint="abc123"
  계산: dwell(0.00) + geo(0.00) + fingerprint(0.00) = 0.00
  출력: {"fraudScore": 0.00, "scoreBreakdown": "dwell(+0.00)+geo(+0.00)+fingerprint(+0.00)", "recommendation": "safe", "reason": "3.5초 체류·국내·정상 지문 — 정상 클릭"}

❌ BAD 예시 — 단일 신호로 block (절대 금지):
  입력: dwellTimeMs=180, geoCountry="KR", fingerprint="xyz456"
  나쁜 판단: fraudScore=0.40(단일신호) → "block" ❌
  올바른 판단: 신호 1개뿐 → "monitor" 또는 "safe"
</few_shot_examples>

<output_format>
반드시 JSON 배열만 응답 (입력 이벤트와 동일한 순서):
[{
  "fraudScore": 0.00,
  "scoreBreakdown": "dwell(+X.XX)+geo(+X.XX)+fingerprint(+X.XX)",
  "recommendation": "block | monitor | safe",
  "reason": "한국어 1문장 (적용된 신호 명시)"
}]
</output_format>`,
    userPrompt: JSON.stringify(recentEvents.map(e => ({
      ipHash: e.ipHash, dwellTimeMs: e.dwellTimeMs,
      geoCountry: e.geoCountry, fingerprint: e.deviceFingerprint,
    }))),
    model: getModelForFeature('click_fraud'),
    jsonMode: true,
    temperature: 0.2,
  });


  if (aiResult.isMock) {
    return apiResponse({ message: 'Mock mode', analyzed: 0, mock: true });
  }

  const analyses = parseJsonResponse<any[]>(aiResult.content, []);
  let blocked = 0, monitored = 0;

  for (let i = 0; i < Math.min(recentEvents.length, (analyses as any[]).length); i++) {
    const event = recentEvents[i];
    const analysis = (analyses as any[])?.[i];
    if (!analysis) continue;

    const score = Math.min(1, Math.max(0, analysis.fraudScore ?? 0));

    await prisma.clickFraudEvent.update({
      where: { id: event.id },
      data: {
        fraudScore: score,
        status: score >= 0.8 ? 'confirmed' : score >= 0.5 ? 'pending' : 'dismissed',
        triggeredRules: analysis.reason ? [analysis.reason] : [],
      },
    });

    if (score >= 0.8) {
      // BlockedIp 차단 기록 → AiActionLog로 남김
      await prisma.aiActionLog.create({
        data: {
          organizationId: event.organizationId,
          actionType: 'anomaly_alert',
          entityType: 'ClickFraudEvent',
          entityId: event.id,
          inputData: { ipHash: event.ipHash, naverAccountId: event.naverAccountId },
          outputData: { fraudScore: score, reason: analysis.reason || 'AI detected' },
          confidence: score,
          isApproved: true,
        },
      });
      blocked++;
    } else if (score >= 0.5) {
      monitored++;
    }
  }

  return apiResponse({ analyzed: recentEvents.length, blocked, monitored, model: aiResult.model });
});
