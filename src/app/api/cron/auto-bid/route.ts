import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { apiResponse, apiError, withErrorHandler } from '@/lib/api-helpers';
import { callAi } from '@/lib/ai/ai-client';
import { getModelForFeature } from '@/lib/ai/model-router';
import { parseJsonResponse } from '@/lib/ai/response-parser';
import { isAiFeatureEnabled, getAutoBidConfig } from '@/lib/ai/feature-flags';

// Vercel Pro 최대 300초 타임아웃
export const maxDuration = 300;

export const POST = withErrorHandler(async (req: NextRequest) => {
  // ──── Cron 인증 (Fail-Close) ────
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return apiError('CRON_SECRET 환경변수가 설정되지 않았습니다.', 500);
  }
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${cronSecret}`) {
    return apiError('Unauthorized', 401);
  }

  if (!isAiFeatureEnabled('AI_FEATURE_AUTO_BID')) {
    return apiResponse({ message: 'Auto-bid feature is disabled', processed: 0 });
  }

  const config = getAutoBidConfig();
  if (!config.enabled) {
    return apiResponse({ message: 'Auto-bid is disabled', processed: 0 });
  }

  // 자동입찰 활성 키워드 조회
  const keywords = await prisma.keyword.findMany({
    where: { isAutoManaged: true, deletedAt: null },
    take: config.batchSize,
    include: {
      organization: { select: { id: true, name: true } },
      bidHistory: { orderBy: { changedAt: 'desc' }, take: 1 },
      rankSnapshots: { orderBy: { capturedAt: 'desc' }, take: 1 },
    },
  });

  if (keywords.length === 0) {
    return apiResponse({ message: 'No auto-managed keywords found', processed: 0 });
  }

  // 배치 분석
  const keywordsData = keywords.map(k => ({
    id: k.id,
    keyword: k.keywordText,
    strategy: k.bidStrategy,
    currentBid: k.currentBid,
    targetRank: k.targetRank,
    currentRank: k.rankSnapshots[0]?.rank ?? null,
    ctr: Number(k.ctr),
    conversions: k.conversions,
    cost: Number(k.cost),
    roas: k.roas ? Number(k.roas) : null,
    hasBidHistory: k.bidHistory.length > 0,
  }));

  const aiResult = await callAi({
    systemPrompt: `당신은 네이버 검색광고 전문 입찰가 최적화 AI "AdPilot"입니다.
실제 성과 데이터만을 근거로 판단하며, 이 결과는 자동으로 실제 입찰가에 반영됩니다.
보수적·신중하게 판단하고, 수치 근거 없는 상향 조정은 절대 하지 않습니다.

<thinking_process>
각 키워드에 대해 반드시 아래 5단계 순서로 사고하세요 (Chain of Thought):
1단계 — 현재 성과 파악: ROAS, CTR, 전환수, 비용, 현재순위를 확인한다
2단계 — strategy별 목표 갭 계산:
  • target_roas  → 현재 ROAS vs 목표 ROAS 갭
  • target_rank  → currentRank vs targetRank 갭 (클수록 순위 낮음)
  • max_clicks   → 현재 CTR 대비 개선 여지
  • manual       → AI 개입 없음, confidence 0.0 즉시 반환
3단계 — 원인 분석: 성과 저하 원인이 입찰가인지, 소재인지, 품질지수인지 판단
4단계 — 조정 방향·폭 결정: UP / DOWN / HOLD + 구체적 변경폭
5단계 — confidence 산정 및 approvalRequired 결정
</thinking_process>

<confidence_criteria>
0.90 이상 → 데이터 충분, 자동 실행 가능   (approvalRequired: false)
0.70~0.89 → 조정 권장, 소폭 변경         (approvalRequired: false)
0.50~0.69 → 불확실, 최소 조정            (approvalRequired: true)
0.50 미만  → 데이터 부족, 현상 유지 권장  (approvalRequired: true)
</confidence_criteria>

<safety_rules>
- 전환(conversions) = 0인 키워드: 하향(DOWN)만 허용, 상향(UP) 절대 금지
- hasBidHistory = false인 키워드: confidence 최대 0.40
- strategy = "manual": confidence 0.0, reason = "수동 전략 키워드 — AI 조정 제외"
- 안전장치 범위 (별도 로직으로 강제 적용됨):
  상한 ₩${config.maxBid} / 하한 ₩${config.minBid} / 1회 변경폭 ±₩${config.maxChange}
</safety_rules>

<few_shot_examples>
✅ GOOD 예시:
  입력: keyword="임플란트", strategy="target_roas", roas=1.8, conversions=3, cost=45000, ctr=0.028, hasBidHistory=true
  사고: 1)전환3건·CTR2.8% 양호 2)target_roas, 현재ROAS=180% 3)입찰가 소폭 상향 시 노출 확대 가능 4)UP +₩100 5)confidence=0.78
  출력: {"recommendedBid": currentBid+100, "bidDirection": "UP", "confidence": 0.78, "approvalRequired": false, "reason": "전환 3건·CTR 2.8% 양호, 소폭 상향으로 노출 확대 권장"}

❌ BAD 예시 (절대 금지):
  입력: keyword="레이저치료", strategy="target_roas", conversions=0, cost=62000
  잘못된 판단: 입찰가 상향 → 전환 0건은 하향만 허용
  올바른 출력: {"recommendedBid": currentBid-200, "bidDirection": "DOWN", "confidence": 0.88, "approvalRequired": false, "reason": "전환 0건 + 비용 ₩62,000 발생, 전환 없는 키워드 하향 필수"}
</few_shot_examples>

<output_format>
반드시 JSON 배열만 응답 (설명 텍스트 일절 없음):
[{
  "keywordId": "string",
  "recommendedBid": 숫자,
  "bidDirection": "UP | DOWN | HOLD",
  "reason": "한국어 1문장 (수치 근거 포함)",
  "confidence": 0.00,
  "approvalRequired": true 또는 false
}]
조정 불필요 시: recommendedBid = currentBid, bidDirection = "HOLD"
</output_format>`,
    userPrompt: JSON.stringify(keywordsData),
    model: getModelForFeature('auto_bid'),
    jsonMode: true,
    temperature: 0.3,
  });

  if (aiResult.isMock) {
    return apiResponse({ message: 'Mock mode - no changes applied', processed: 0, mock: true });
  }

  // AI 응답 파싱
  const recommendations = parseJsonResponse<any[]>(aiResult.content, []);
  const validRecs: Array<{ keyword: typeof keywords[0]; newBid: number; rec: any }> = [];

  for (const rec of Array.isArray(recommendations) ? recommendations : []) {
    const keyword = keywords.find(k => k.id === rec.keywordId);
    if (!keyword) continue;

    // 신뢰도 필터 + 승인 필요 항목 건너뛰기
    if ((rec.confidence ?? 0) < config.minConfidence) continue;
    if (rec.approvalRequired === true) continue; // 사람 검토 필요 항목은 자동 적용 제외

    // 안전장치 검증
    let newBid = Math.round(rec.recommendedBid ?? keyword.currentBid);
    newBid = Math.min(newBid, config.maxBid);
    newBid = Math.max(newBid, config.minBid);

    const change = Math.abs(newBid - keyword.currentBid);
    if (change > config.maxChange) {
      newBid = keyword.currentBid + (newBid > keyword.currentBid ? config.maxChange : -config.maxChange);
    }

    if (newBid === keyword.currentBid) continue;
    validRecs.push({ keyword, newBid, rec });
  }

  // ──── 배치 트랜잭션 + OCC(Optimistic Concurrency Control) ────
  const results: any[] = [];

  if (validRecs.length > 0) {
    await prisma.$transaction(async (tx) => {
      for (const { keyword, newBid, rec } of validRecs) {
        // OCC: version 확인 후 업데이트 — 동시 수정 시 건너뛰기
        const updated = await tx.keyword.updateMany({
          where: { id: keyword.id, version: keyword.version },
          data: { currentBid: newBid, version: { increment: 1 } },
        });

        if (updated.count === 0) continue; // 동시 수정 충돌 시 건너뛰기

        await tx.bidHistory.create({
          data: {
            keywordId: keyword.id,
            organizationId: keyword.organizationId,
            oldBid: keyword.currentBid,
            newBid,
            reason: rec.reason || 'AI 자동 입찰 조정',
            changedBy: 'ai',
          },
        });

        await tx.aiActionLog.create({
          data: {
            organizationId: keyword.organizationId,
            actionType: 'bid_adjustment',
            entityType: 'Keyword',
            entityId: keyword.id,
            inputData: { keyword: keyword.keywordText, currentBid: keyword.currentBid, strategy: keyword.bidStrategy },
            outputData: { newBid, reason: rec.reason, confidence: rec.confidence, bidDirection: rec.bidDirection },
            confidence: rec.confidence,
            isApproved: true,
          },
        });

        results.push({ keywordId: keyword.id, keyword: keyword.keywordText, oldBid: keyword.currentBid, newBid, bidDirection: rec.bidDirection });
      }
    });
  }

  return apiResponse({ processed: results.length, results, model: aiResult.model });
});

// Vercel Cron은 GET으로 호출하므로 GET → POST 위임
export const GET = POST;
