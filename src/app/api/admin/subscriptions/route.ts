import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { apiResponse, requireAuth, requireSuperAdmin, withErrorHandler } from '@/lib/api-helpers';

export const GET = withErrorHandler(async (req: NextRequest) => {
  const user = await requireAuth(req);
  requireSuperAdmin(user);

  const [subscriptions, planDistribution] = await Promise.all([
    prisma.subscription.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: { organization: { select: { id: true, name: true } } },
    }),
    prisma.subscription.groupBy({
      by: ['planType'],
      where: { status: 'active' },
      _count: true,
    }),
  ]);

  const mrrResult = await prisma.subscription.aggregate({
    _sum: { monthlyPrice: true },
    where: { status: 'active' },
  });

  return apiResponse({
    subscriptions,
    planDistribution,
    mrr: mrrResult._sum.monthlyPrice ?? 0,
  });
});
