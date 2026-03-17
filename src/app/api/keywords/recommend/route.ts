import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { apiResponse, requireAuth, withErrorHandler } from '@/lib/api-helpers';
import { callAi } from '@/lib/ai/ai-client';
import { getModelForFeature } from '@/lib/ai/model-router';
import { isAiFeatureEnabled } from '@/lib/ai/feature-flags';

export const POST = withErrorHandler(async (req: NextRequest) => {
  const user = await requireAuth(req);

  if (!isAiFeatureEnabled('AI_FEATURE_KEYWORD_RECOMMEND')) {
    return apiResponse({
      recommendations: [
        { keyword: '교통사고변호사', reason: 'Mock - AI 미연동', expectedCpc: 680 },
        { keyword: '상속변호사', reason: 'Mock - AI 미연동', expectedCpc: 850 },
      ],
      mock: true,
    });
  }

  const keywords = await prisma.keyword.findMany({
    where: { organizationId: user.organizationId, deletedAt: null },
    orderBy: { cost: 'desc' },
    take: 50,
    select: { keywordText: true, ctr: true, conversions: true, cost: true, roas: true, bidStrategy: true },
  });

  const aiResult = await callAi({
    systemPrompt: `당신은 네이버 검색광고 키워드 전문가입니다.
현재 키워드 성과를 분석하여 신규 키워드 추천과 퇴출 키워드를 제안하세요.
JSON으로 응답: { "recommendations": [{ "keyword": "...", "reason": "...", "expectedCpc": 숫자 }], "removeSuggestions": [{ "keyword": "...", "reason": "..." }] }`,
    userPrompt: JSON.stringify(keywords),
    model: getModelForFeature('keyword_recommend'),
    jsonMode: true,
    temperature: 0.5,
  });

  if (aiResult.isMock) {
    return apiResponse({ recommendations: [], removeSuggestions: [], mock: true });
  }

  await prisma.aiActionLog.create({
    data: {
      organizationId: user.organizationId, userId: user.id,
      actionType: 'keyword_recommendation', entityType: 'Keyword',
      inputData: { keywordsAnalyzed: keywords.length },
      outputData: { model: aiResult.model },
    },
  });

  return apiResponse({ ...JSON.parse(aiResult.content || '{}'), mock: false, model: aiResult.model });
});
