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
    systemPrompt: `당신은 부정클릭 탐지 전문가입니다. 클릭 이벤트 데이터를 분석하여 각 IP에 대해:
- fraudScore: 0.0~1.0 (부정클릭 확률)
- reason: 탐지 사유
- recommendation: "block" | "monitor" | "safe"
JSON 배열로 응답하세요.`,
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
