import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { apiResponse, requireAuth, withErrorHandler } from '@/lib/api-helpers';
import { callAi } from '@/lib/ai/ai-client';
import { getModelForFeature } from '@/lib/ai/model-router';
import { isAiFeatureEnabled } from '@/lib/ai/feature-flags';

export const POST = withErrorHandler(async (req: NextRequest) => {
  const user = await requireAuth(req);

  if (!isAiFeatureEnabled('AI_FEATURE_COMPETITIVE')) {
    return apiResponse({ message: 'Competitive AI feature is disabled', mock: true, analysis: [] });
  }

  const data = await prisma.competitiveIntel.findMany({
    where: { organizationId: user.organizationId },
    orderBy: { crawledAt: 'desc' },
    take: 20,
  });

  const ranks = await prisma.rankSnapshot.findMany({
    where: { organizationId: user.organizationId },
    orderBy: { capturedAt: 'desc' },
    take: 50,
    include: { keyword: { select: { keywordText: true } } },
  });

  const aiResult = await callAi({
    systemPrompt: `당신은 네이버 검색광고 경쟁 분석 전문가입니다.
경쟁사 데이터와 순위 추이를 분석하여 다음을 JSON으로 응답하세요:
{ "threats": [{ "keyword": "...", "threatLevel": "high|medium|low", "reason": "..." }],
  "strategies": ["전략1", "전략2", ...],
  "summary": "요약 문장" }`,
    userPrompt: JSON.stringify({ competitors: data, rankings: ranks }),
    model: getModelForFeature('competitive'),
    jsonMode: true,
    temperature: 0.4,
  });

  if (aiResult.isMock) {
    return apiResponse({
      analysis: { threats: [], strategies: ['데이터 수집 후 분석 가능합니다.'], summary: '현재 AI 미연동 상태입니다.' },
      mock: true,
    });
  }

  await prisma.aiActionLog.create({
    data: {
      organizationId: user.organizationId,
      userId: user.id,
      actionType: 'anomaly_alert',
      entityType: 'CompetitiveIntel',
      inputData: { competitorCount: data.length, rankCount: ranks.length },
      outputData: { model: aiResult.model },
    },
  });

  return apiResponse({ analysis: aiResult.content, mock: false, model: aiResult.model });
});
