import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { apiResponse, requireAuth, withErrorHandler } from '@/lib/api-helpers';
import { cachedQuery, cacheKey } from '@/lib/cache';

// ──── 증감률 계산 ────
function calcChange(current: number, previous: number): string {
  if (previous === 0) return current > 0 ? '+∞' : '0%';
  const pct = ((current - previous) / previous * 100).toFixed(1);
  return `${Number(pct) > 0 ? '+' : ''}${pct}%`;
}

// ──── KPI 집계 (Campaign 테이블 기준 — lastSyncAt으로 기간 필터) ────
// 스키마에 날짜별 성과 테이블이 없으므로 Campaign/Keyword 누적값을 사용.
// lastSyncAt을 기준으로 해당 기간에 동기화된 데이터를 집계.
async function getKpiForRange(orgId: string, start: Date, end: Date) {
  // Campaign 레벨 집계 (impressions, clicks, conversions, totalCost)
  const campAgg = await prisma.campaign.aggregate({
    where: {
      organizationId: orgId,
      deletedAt: null,
      lastSyncAt: { gte: start, lte: end },
    },
    _sum: {
      impressions: true,
      clicks: true,
      conversions: true,
      totalCost: true,
    },
  });

  // Keyword 레벨 집계 (전환 가치 + cost 더 세밀하게)
  const kwAgg = await prisma.keyword.aggregate({
    where: {
      organizationId: orgId,
      deletedAt: null,
      lastSyncAt: { gte: start, lte: end },
    },
    _sum: {
      impressions: true,
      clicks: true,
      conversions: true,
      conversionValue: true,
      cost: true,
    },
  });

  // Campaign에서 가져온 값이 있으면 우선, 없으면 Keyword 집계값 사용
  const campImpressions = Number(campAgg._sum.impressions ?? 0);
  const campClicks = Number(campAgg._sum.clicks ?? 0);
  const campConversions = Number(campAgg._sum.conversions ?? 0);
  const campCost = Number(campAgg._sum.totalCost ?? 0);

  const kwImpressions = Number(kwAgg._sum.impressions ?? 0);
  const kwClicks = Number(kwAgg._sum.clicks ?? 0);
  const kwConversions = Number(kwAgg._sum.conversions ?? 0);
  const kwCost = Number(kwAgg._sum.cost ?? 0);
  const kwConversionValue = Number(kwAgg._sum.conversionValue ?? 0);

  const totalImpressions = campImpressions > 0 ? campImpressions : kwImpressions;
  const totalClicks = campClicks > 0 ? campClicks : kwClicks;
  const totalConversions = campConversions > 0 ? campConversions : kwConversions;
  const totalCost = campCost > 0 ? campCost : kwCost;
  const totalConversionValue = kwConversionValue;

  return { totalImpressions, totalClicks, totalConversions, totalConversionValue, totalCost };
}

// ──── 전체 누적 KPI (필터 없음 — 동기화 미완료 시 폴백) ────
async function getTotalKpi(orgId: string) {
  const [campAgg, kwAgg] = await Promise.all([
    prisma.campaign.aggregate({
      where: { organizationId: orgId, deletedAt: null },
      _sum: { impressions: true, clicks: true, conversions: true, totalCost: true },
    }),
    prisma.keyword.aggregate({
      where: { organizationId: orgId, deletedAt: null },
      _sum: { impressions: true, clicks: true, conversions: true, conversionValue: true, cost: true },
    }),
  ]);

  const campImpressions = Number(campAgg._sum.impressions ?? 0);
  const campClicks = Number(campAgg._sum.clicks ?? 0);
  const campConversions = Number(campAgg._sum.conversions ?? 0);
  const campCost = Number(campAgg._sum.totalCost ?? 0);

  return {
    totalImpressions: campImpressions > 0 ? campImpressions : Number(kwAgg._sum.impressions ?? 0),
    totalClicks: campClicks > 0 ? campClicks : Number(kwAgg._sum.clicks ?? 0),
    totalConversions: campConversions > 0 ? campConversions : Number(kwAgg._sum.conversions ?? 0),
    totalConversionValue: Number(kwAgg._sum.conversionValue ?? 0),
    totalCost: campCost > 0 ? campCost : Number(kwAgg._sum.cost ?? 0),
  };
}

export const GET = withErrorHandler(async (req: NextRequest) => {
  const user = await requireAuth(req);
  const orgId = user.organizationId;
  const period = req.nextUrl.searchParams.get('period') || '7d';

  // 기간 계산
  const now = new Date();
  const daysMap: Record<string, number> = { '1d': 1, '7d': 7, '30d': 30, '90d': 90 };
  const days = daysMap[period] ?? 7;
  const currentStart = new Date(now); currentStart.setDate(now.getDate() - (days - 1)); currentStart.setHours(0, 0, 0, 0);
  const currentEnd = new Date(now); currentEnd.setHours(23, 59, 59, 999);
  const prevEnd = new Date(currentStart); prevEnd.setMilliseconds(-1);
  const prevStart = new Date(prevEnd); prevStart.setDate(prevEnd.getDate() - (days - 1)); prevStart.setHours(0, 0, 0, 0);

  const dashboard = await cachedQuery(
    cacheKey(orgId, 'dashboard', period),
    300, // 5분 TTL
    async () => {
      const [
        accountCount,
        campaignCount,
        keywordCount,
        unreadNotifications,
        recentAuditLogs,
        currentKpiBySync,
        previousKpiBySync,
        totalKpi,
      ] = await Promise.all([
        prisma.naverAccount.count({
          where: { organizationId: orgId, deletedAt: null, isActive: true },
        }),
        prisma.campaign.count({
          where: { organizationId: orgId, deletedAt: null },
        }),
        prisma.keyword.count({
          where: { organizationId: orgId, deletedAt: null },
        }),
        prisma.notification.count({
          where: { organizationId: orgId, userId: user.id, isRead: false },
        }),
        prisma.auditLog.findMany({
          where: { organizationId: orgId },
          orderBy: { createdAt: 'desc' },
          take: 10,
          select: {
            id: true,
            action: true,
            entityType: true,
            entityId: true,
            createdAt: true,
            user: { select: { name: true } },
          },
        }),
        getKpiForRange(orgId, currentStart, currentEnd),
        getKpiForRange(orgId, prevStart, prevEnd),
        getTotalKpi(orgId),
      ]);

      // lastSyncAt 기준 데이터가 없으면 전체 누적값 사용 (폴백)
      const currentKpi = currentKpiBySync.totalCost > 0 ? currentKpiBySync : totalKpi;
      const previousKpi = previousKpiBySync;

      // ROAS 계산
      const avgRoas = currentKpi.totalCost > 0
        ? Math.round((currentKpi.totalConversionValue / currentKpi.totalCost) * 10000) / 100
        : 0;
      const prevAvgRoas = previousKpi.totalCost > 0
        ? Math.round((previousKpi.totalConversionValue / previousKpi.totalCost) * 10000) / 100
        : 0;

      return {
        kpi: {
          totalAccounts: accountCount,
          activeCampaigns: campaignCount,
          totalKeywords: keywordCount,
          unreadNotifications,
          totalImpressions: currentKpi.totalImpressions,
          totalClicks: currentKpi.totalClicks,
          totalConversions: currentKpi.totalConversions,
          totalConversionValue: currentKpi.totalConversionValue,
          totalCost: currentKpi.totalCost,
          avgRoas,
          totalCostChange: calcChange(currentKpi.totalCost, previousKpi.totalCost),
          totalImpressionsChange: calcChange(currentKpi.totalImpressions, previousKpi.totalImpressions),
          totalClicksChange: calcChange(currentKpi.totalClicks, previousKpi.totalClicks),
          totalConversionsChange: calcChange(currentKpi.totalConversions, previousKpi.totalConversions),
          avgRoasChange: calcChange(avgRoas, prevAvgRoas),
        },
        recentActivity: recentAuditLogs,
      };
    },
    [`dashboard:${orgId}`],
  );

  return apiResponse(dashboard);
});
