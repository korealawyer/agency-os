import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { apiResponse, requireAuth, requireSuperAdmin, withErrorHandler } from '@/lib/api-helpers';

export const GET = withErrorHandler(async (req: NextRequest) => {
  const user = await requireAuth(req);
  requireSuperAdmin(user);

  const planDistribution = await prisma.subscription.groupBy({
    by: ['planType'],
    where: { status: 'active' },
    _count: true,
    _sum: { monthlyPrice: true },
  });

  const orgsByPlan = await prisma.organization.groupBy({
    by: ['planType'],
    _count: true,
  });

  return apiResponse({ planDistribution, orgsByPlan });
});
