import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { apiResponse, requireAuth, withErrorHandler, safeParseBody } from '@/lib/api-helpers';
import { callAi } from '@/lib/ai/ai-client';
import { getModelForFeature } from '@/lib/ai/model-router';
import { isAiFeatureEnabled } from '@/lib/ai/feature-flags';

export const POST = withErrorHandler(async (req: NextRequest) => {
  const user = await requireAuth(req);
  const body = await safeParseBody<any>(req);

  if (!isAiFeatureEnabled('AI_FEATURE_AD_CREATIVE')) {
    return apiResponse({
      creatives: [
        { title: '[Mock] 전문 변호사 상담', description: '20년 경력 전문 변호사의 무료 상담. 지금 바로 문의하세요.', version: 'mock' },
      ],
      mock: true,
    });
  }

  const aiResult = await callAi({
    systemPrompt: `당신은 네이버 검색광고 카피라이터입니다.
네이버 광고 규정(제목 15자, 설명 45자) 준수.
클릭률을 높이는 제목/설명을 3세트 생성하세요.
JSON으로 응답: { "creatives": [{ "title": "...", "description": "..." }] }`,
    userPrompt: `키워드: ${body.keyword || ''}
업종: ${body.industry || ''}
현재 제목: ${JSON.stringify(body.currentTitles || [])}`,
    model: getModelForFeature('ad_creative'),
    jsonMode: true,
    temperature: 0.8,
  });

  if (aiResult.isMock) {
    return apiResponse({ creatives: [], mock: true });
  }

  await prisma.aiActionLog.create({
    data: {
      organizationId: user.organizationId, userId: user.id,
      actionType: 'creative_suggestion', entityType: 'Ad',
      inputData: { keyword: body.keyword },
      outputData: { model: aiResult.model },
    },
  });

  return apiResponse({ ...JSON.parse(aiResult.content || '{}'), mock: false, model: aiResult.model });
});
