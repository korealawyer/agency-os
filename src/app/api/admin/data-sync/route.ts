import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { apiResponse, requireAuth, requireSuperAdmin, withErrorHandler } from '@/lib/api-helpers';

export const GET = withErrorHandler(async (req: NextRequest) => {
  const user = await requireAuth(req);
  requireSuperAdmin(user);

  // 최근 동기화 상태
  const recentSyncs = await prisma.naverAccount.findMany({
    orderBy: { lastSyncAt: 'desc' },
    take: 20,
    select: {
      id: true, customerName: true, lastSyncAt: true, connectionStatus: true,
      organization: { select: { name: true } },
    },
  });

  // 계정 상태 집계
  const statusCounts = await prisma.naverAccount.groupBy({
    by: ['connectionStatus'],
    _count: true,
  });

  return apiResponse({ recentSyncs, statusCounts });
});
