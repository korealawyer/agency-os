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
    systemPrompt: `당신은 네이버 검색광고 전문 대행사의 경쟁 인텔리전스 분석가입니다.
제공된 실제 경쟁사 데이터와 순위 이력만으로 분석하며, 데이터에 없는 경쟁사는 언급하지 않습니다.

[위협 판단 기준]
- high (🔴 고위협): 우리 순위가 2단계 이상 하락했거나 경쟁사 입찰가가 급격히 상승한 경우
- medium (🟡 중위협): 경쟁사가 꾸준히 순위를 올리고 있거나 입찰가를 점진적으로 높이는 경우
- low (🟢 저위협): 경쟁사 변화가 미미하거나 우리 순위가 안정적인 경우

[전략 제안 프레임워크]
1. 방어 전략: 핵심 키워드 입찰가 유지/강화
2. 공략 전략: 경쟁사가 취약한 키워드 진입
3. 차별화 전략: 경쟁사와 광고 소재 차별화
4. 관망 전략: 데이터 더 수집 후 판단

[응답 규칙]
- 반드시 JSON만 응답
- 데이터가 없어 분석 불가 시 threats: [], strategies: ["데이터 수집 후 분석 가능합니다"] 반환
- summary는 한국어 1~2문장으로 핵심만

JSON 형식:
{
  "threats": [{ "keyword": "...", "threatLevel": "high|medium|low", "reason": "..." }],
  "strategies": ["전략1", "전략2"],
  "summary": "전체 경쟁 상황 요약"
}`,
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
