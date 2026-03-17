import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { apiResponse, requireAuth, requireSuperAdmin, withErrorHandler } from '@/lib/api-helpers';

export const GET = withErrorHandler(async (req: NextRequest) => {
  const user = await requireAuth(req);
  requireSuperAdmin(user);

  const accounts = await prisma.naverAccount.findMany({
    orderBy: { createdAt: 'desc' },
    select: {
      id: true, customerId: true, customerName: true,
      connectionStatus: true, lastSyncAt: true, commissionRate: true,
      monthlySpend: true, dailyBudget: true, isActive: true, createdAt: true,
      organization: { select: { id: true, name: true } },
    },
  });

  const statusCounts = await prisma.naverAccount.groupBy({
    by: ['connectionStatus'],
    _count: true,
  });

  return apiResponse({ accounts, statusCounts });
});
