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
    systemPrompt: `당신은 네이버 검색광고 AI 어시스턴트입니다.
대시보드에 표시할 3~5문장의 핵심 인사이트를 생성하세요.
마크다운 형식, 이모지 활용, 한국어로 응답하세요.`,
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
