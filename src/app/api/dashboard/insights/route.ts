import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { apiResponse, requireAuth, withErrorHandler } from '@/lib/api-helpers';
import { callAi } from '@/lib/ai/ai-client';
import { getModelForFeature } from '@/lib/ai/model-router';
import { isAiFeatureEnabled } from '@/lib/ai/feature-flags';

export const GET = withErrorHandler(async (req: NextRequest) => {
  const user = await requireAuth(req);

  if (!isAiFeatureEnabled('AI_FEATURE_INSIGHT')) {
    return apiResponse({
      insights: '📊 AI 인사이트가 비활성 상태입니다. 환경변수 AI_FEATURE_INSIGHT=true를 설정하세요.',
      mock: true,
    });
  }

  // 데이터 수집
  const [keywordCount, campaignCount, recentBids, fraudSummary] = await Promise.all([
    prisma.keyword.count({ where: { organizationId: user.organizationId, deletedAt: null } }),
    prisma.campaign.count({ where: { organizationId: user.organizationId, status: 'active' } }),
    prisma.bidHistory.findMany({
      where: { organizationId: user.organizationId },
      orderBy: { changedAt: 'desc' },
      take: 10,
      select: { oldBid: true, newBid: true, reason: true, changedBy: true },
    }),
    prisma.clickFraudDailySummary.findMany({
      where: { organizationId: user.organizationId },
      orderBy: { summaryDate: 'desc' },
      take: 7,
    }),
  ]);

  const aiResult = await callAi({
    systemPrompt: `당신은 네이버 검색광고 전문 대행사의 데이터 애널리스트입니다.
제공된 실제 운영 데이터만을 분석하며, 절대로 가상의 수치나 추측성 발언을 하지 않습니다.

[인사이트 작성 규칙]
- 총 3~5개 항목으로 구성 (너무 많으면 산만해짐)
- 각 항목은 1~2문장으로 간결하게
- 한국어, 마크다운 형식, 관련 이모지 활용

[우선순위 기준 — 아래 순서로 중요도 판단]
1. 🚨 즉각 조치 필요: 부정클릭 급증, 예산 소진 임박, 순위 급락
2. ⚠️ 주의 필요: 지난 주 대비 CTR/ROAS 하락, 입찰가 변동 이력 이상
3. 💡 개선 기회: 상위 전환 키워드 예산 증액 가능, 신규 키워드 추가 여지
4. ✅ 긍정 성과: 성과 개선된 항목 1개 이상 반드시 포함

[액션 아이템 — 필수 포함]
- 각 인사이트 하단에 "👉 권장 액션:" 한 줄 추가
- 실행 가능한 구체적 행동 (예: "B 계정 임플란트 키워드 입찰가 ₩100 상향")
- 데이터가 없어 판단 불가한 경우: "데이터 수집 후 재분석 필요" 명시

[절대 금지]
- 데이터에 없는 계정명, 키워드명, 수치 사용 금지
- "약", "대략", "아마도" 등 불확실한 표현 금지`,
    userPrompt: JSON.stringify({
      keywordCount, campaignCount,
      recentBidChanges: recentBids,
      fraudSummary: fraudSummary.map(s => ({
        date: s.summaryDate, fraudRate: Number(s.fraudRate),
        estimatedLoss: Number(s.estimatedLoss),
      })),
    }),
    model: getModelForFeature('dashboard_insight'),
    temperature: 0.6,
  });

  if (aiResult.isMock) {
    return apiResponse({
      insights: `📊 **오늘의 인사이트**\n\n활성 캠페인 ${campaignCount}개, 키워드 ${keywordCount}개를 관리 중입니다.\nAI 인사이트를 활성화하면 더 상세한 분석을 제공합니다.`,
      mock: true,
    });
  }

  return apiResponse({ insights: aiResult.content, mock: false, model: aiResult.model });
});
