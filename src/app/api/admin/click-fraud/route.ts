import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { apiResponse, requireAuth, requireSuperAdmin, withErrorHandler } from '@/lib/api-helpers';

export const GET = withErrorHandler(async (req: NextRequest) => {
  const user = await requireAuth(req);
  requireSuperAdmin(user);

  const [totalEvents, confirmedEvents, statusCounts, recentEvents] = await Promise.all([
    prisma.clickFraudEvent.count(),
    prisma.clickFraudEvent.count({ where: { status: 'confirmed' } }),
    prisma.clickFraudEvent.groupBy({ by: ['status'], _count: true }),
    prisma.clickFraudEvent.findMany({
      orderBy: { createdAt: 'desc' },
      take: 30,
      include: {
        organization: { select: { name: true } },
        naverAccount: { select: { customerName: true } },
      },
    }),
  ]);

  const blockedIps = await prisma.blockedIp.findMany({
    where: { isActive: true },
    orderBy: { blockedAt: 'desc' },
    take: 30,
    include: { organization: { select: { name: true } } },
  });

  const dailySummaries = await prisma.clickFraudDailySummary.findMany({
    orderBy: { summaryDate: 'desc' },
    take: 30,
  });

  return apiResponse({
    totalEvents, confirmedEvents, statusCounts,
    recentEvents, blockedIps, dailySummaries,
  });
});
