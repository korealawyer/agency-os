import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { apiResponse, requireAuth, withErrorHandler } from '@/lib/api-helpers';
import { cachedQuery, cacheKey } from '@/lib/cache';

/**
 * 시간대별 성과 히트맵 API
 * GET /api/dashboard/heatmap?period=7d
 *
 * 반환: 요일(0~6) × 시간(0~23) 매트릭스 — clicks, impressions, cost, conversions
 */
export const GET = withErrorHandler(async (req: NextRequest) => {
  const user = await requireAuth(req);
  const orgId = user.organizationId;
  const period = req.nextUrl.searchParams.get('period') || '7d';

  // 기간 계산
  const days = period === '1d' ? 1 : period === '30d' ? 30 : period === '90d' ? 90 : 7;
  const since = new Date();
  since.setDate(since.getDate() - days);
  since.setHours(0, 0, 0, 0);

  const heatmap = await cachedQuery(
    cacheKey(orgId, 'heatmap', period),
    600, // 10분 TTL
    async () => {
      // BidHistory의 changedAt 타임스탬프를 활용하여 시간대별 활동 분석
      const bidHistories = await prisma.bidHistory.findMany({
        where: {
          organizationId: orgId,
          changedAt: { gte: since },
        },
        select: {
          changedAt: true,
          newBid: true,
          oldBid: true,
        },
      });

      // 요일 × 시간 매트릭스 초기화 (0=일요일 ~ 6=토요일, 0~23시)
      const matrix: Record<string, { clicks: number; impressions: number; cost: number; conversions: number; count: number }> = {};
      for (let dow = 0; dow < 7; dow++) {
        for (let hour = 0; hour < 24; hour++) {
          matrix[`${dow}-${hour}`] = { clicks: 0, impressions: 0, cost: 0, conversions: 0, count: 0 };
        }
      }

      // BidHistory 기반 활동 빈도 집계
      for (const bh of bidHistories) {
        const d = new Date(bh.changedAt);
        const dow = d.getDay();
        const hour = d.getHours();
        const key = `${dow}-${hour}`;
        matrix[key].count += 1;
        matrix[key].cost += Math.abs(bh.newBid - bh.oldBid);
      }

      // 키워드 집계 데이터로 히트맵 보강 (전체 성과 기반)
      const keywords = await prisma.keyword.findMany({
        where: { organizationId: orgId, deletedAt: null },
        select: {
          impressions: true,
          clicks: true,
          conversions: true,
          cost: true,
          updatedAt: true,
        },
      });

      // 키워드 성과를 updatedAt 기준으로 시간대 배분
      for (const kw of keywords) {
        const d = new Date(kw.updatedAt);
        const dow = d.getDay();
        const hour = d.getHours();
        const key = `${dow}-${hour}`;
        matrix[key].clicks += Number(kw.clicks ?? 0);
        matrix[key].impressions += Number(kw.impressions ?? 0);
        matrix[key].conversions += Number(kw.conversions ?? 0);
        matrix[key].cost += Number(kw.cost ?? 0);
      }

      // 매트릭스를 배열로 변환
      const data = [];
      const dayLabels = ['일', '월', '화', '수', '목', '금', '토'];
      for (let dow = 0; dow < 7; dow++) {
        for (let hour = 0; hour < 24; hour++) {
          const cell = matrix[`${dow}-${hour}`];
          data.push({
            day: dow,
            dayLabel: dayLabels[dow],
            hour,
            hourLabel: `${hour}시`,
            clicks: cell.clicks,
            impressions: cell.impressions,
            cost: cell.cost,
            conversions: cell.conversions,
            intensity: cell.clicks, // 히트맵 색상 강도 기준
          });
        }
      }

      return { data, dayLabels };
    },
    [`heatmap:${orgId}`],
  );

  return apiResponse(heatmap);
});
