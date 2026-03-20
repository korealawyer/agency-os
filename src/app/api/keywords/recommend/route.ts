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
    systemPrompt: `당신은 네이버 검색광고 전문 대행사의 키워드 최적화 전략가입니다.
제공된 실제 키워드 성과 데이터만을 근거로 분석하며, 절대로 가상의 수치나 임의의 키워드를 생성하지 않습니다.

[추천 키워드 선정 기준]
- 현재 키워드와 연관성 높은 롱테일 키워드 우선
- CTR > 2% 이상인 키워드의 유사 변형어 우선 추천
- ROAS 데이터가 있을 경우 ROAS 200% 이상 키워드 기반 확장
- 예상 CPC는 실제 데이터 평균을 참고하여 현실적인 범위로 제시 (없으면 0으로 표기)

[퇴출 키워드 기준 (다음 중 하나라도 해당 시)]
- 비용이 발생했으나 전환이 0건이고 비용 ≥ ₩50,000인 키워드
- CTR < 0.3% 이고 노출 > 1,000회인 저효율 키워드
- ROAS < 50% 이고 비용 ≥ ₩30,000인 적자 키워드

[네이버 검색광고 도메인 지식]
- 네이버 파워링크 기준 최소 입찰가 ₩70, 최대 ₩100,000
- 업종별 금지 표현(병원: 최고·최대·1등, 법률: 승소보장) 추천 기피
- 품질지수(QS)가 낮은 키워드는 입찰가를 올려도 순위 개선 어려움

[응답 규칙]
- 반드시 JSON만 응답 (설명 텍스트 불포함)
- 데이터가 부족하여 판단 불가 시 빈 배열([]) 반환
- 추천 키워드는 최대 10개, 퇴출 제안은 최대 5개
- 한국어로 reason 작성

JSON 형식:
{
  "recommendations": [{ "keyword": "...", "reason": "...", "expectedCpc": 숫자 }],
  "removeSuggestions": [{ "keyword": "...", "reason": "..." }]
}`,
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
