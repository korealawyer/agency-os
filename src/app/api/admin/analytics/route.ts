import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { apiResponse, requireAuth, requireSuperAdmin, withErrorHandler } from '@/lib/api-helpers';

export const GET = withErrorHandler(async (req: NextRequest) => {
  const user = await requireAuth(req);
  requireSuperAdmin(user);

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [
    newOrgsThisMonth,
    canceledThisMonth,
    totalActiveSubscriptions,
    mrrResult,
    planConversions,
  ] = await Promise.all([
    prisma.organization.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
    prisma.subscription.count({ where: { status: 'canceled', canceledAt: { gte: thirtyDaysAgo } } }),
    prisma.subscription.count({ where: { status: 'active' } }),
    prisma.subscription.aggregate({ _sum: { monthlyPrice: true }, where: { status: 'active' } }),
    prisma.subscription.groupBy({
      by: ['planType'],
      where: { status: 'active' },
      _count: true,
      _sum: { monthlyPrice: true },
    }),
  ]);

  const mrr = mrrResult._sum.monthlyPrice ?? 0;
  const arr = mrr * 12;
  const churnRate = totalActiveSubscriptions > 0
    ? Math.round((canceledThisMonth / (totalActiveSubscriptions + canceledThisMonth)) * 100)
    : 0;

  return apiResponse({
    mrr, arr, churnRate,
    newOrgsThisMonth, canceledThisMonth,
    totalActiveSubscriptions, planConversions,
  });
});
