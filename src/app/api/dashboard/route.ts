import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { apiResponse, requireAuth, withErrorHandler } from '@/lib/api-helpers';
import { cachedQuery, cacheKey } from '@/lib/cache';

// ──── 기간 범위 계산 ────
function parsePeriod(period: string) {
  const now = new Date();
  const endDate = new Date(now); endDate.setHours(23, 59, 59, 999);

  let startDate: Date;
  let prevEndDate: Date;
  let prevStartDate: Date;

  switch (period) {
    case '1d':
      startDate = new Date(now); startDate.setHours(0, 0, 0, 0);
      prevEndDate = new Date(startDate); prevEndDate.setMilliseconds(-1);
      prevStartDate = new Date(prevEndDate); prevStartDate.setHours(0, 0, 0, 0);
      break;
    case '30d':
      startDate = new Date(now); startDate.setDate(now.getDate() - 29); startDate.setHours(0, 0, 0, 0);
      prevEndDate = new Date(startDate); prevEndDate.setMilliseconds(-1);
      prevStartDate = new Date(prevEndDate); prevStartDate.setDate(prevEndDate.getDate() - 29); prevStartDate.setHours(0, 0, 0, 0);
      break;
    case '90d':
      startDate = new Date(now); startDate.setDate(now.getDate() - 89); startDate.setHours(0, 0, 0, 0);
      prevEndDate = new Date(startDate); prevEndDate.setMilliseconds(-1);
      prevStartDate = new Date(prevEndDate); prevStartDate.setDate(prevEndDate.getDate() - 89); prevStartDate.setHours(0, 0, 0, 0);
      break;
    default: // 7d
      startDate = new Date(now); startDate.setDate(now.getDate() - 6); startDate.setHours(0, 0, 0, 0);
      prevEndDate = new Date(startDate); prevEndDate.setMilliseconds(-1);
      prevStartDate = new Date(prevEndDate); prevStartDate.setDate(prevEndDate.getDate() - 6); prevStartDate.setHours(0, 0, 0, 0);
      break;
  }

  return {
    current: { start: startDate, end: endDate },
    previous: { start: prevStartDate, end: prevEndDate },
  };
}

// ──── 증감률 계산 ────
function calcChange(current: number, previous: number): string {
  if (previous === 0) return current > 0 ? '+∞' : '0%';
  const pct = ((current - previous) / previous * 100).toFixed(1);
  return `${Number(pct) > 0 ? '+' : ''}${pct}%`;
}

// ──── 기간 별 KPI 집계 ────
async function getKpiForRange(orgId: string, start: Date, end: Date) {
  const agg = await prisma.keyword.aggregate({
    where: {
      organizationId: orgId,
      deletedAt: null,
      updatedAt: { gte: start, lte: end },
    },
    _sum: {
      impressions: true,
      clicks: true,
      conversions: true,
      conversionValue: true,
      cost: true,
    },
  });
  return {
    totalImpressions: Number(agg._sum.impressions ?? 0),
    totalClicks: Number(agg._sum.clicks ?? 0),
    totalConversions: Number(agg._sum.conversions ?? 0),
    totalConversionValue: Number(agg._sum.conversionValue ?? 0),
    totalCost: Number(agg._sum.cost ?? 0),
  };
}

export const GET = withErrorHandler(async (req: NextRequest) => {
  const user = await requireAuth(req);
  const orgId = user.organizationId;
  const period = req.nextUrl.searchParams.get('period') || '7d';
  const { current, previous } = parsePeriod(period);

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
        currentKpi,
        previousKpi,
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
        getKpiForRange(orgId, current.start, current.end),
        getKpiForRange(orgId, previous.start, previous.end),
      ]);

      // ROAS 계산: (전환 가치 / 비용) * 100
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
          // ── 증감률 (WoW / DoD) ──
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
