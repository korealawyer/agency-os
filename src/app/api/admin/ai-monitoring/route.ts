import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { apiResponse, requireAuth, requireSuperAdmin, withErrorHandler, parsePagination, paginatedResponse } from '@/lib/api-helpers';

export const GET = withErrorHandler(async (req: NextRequest) => {
  const user = await requireAuth(req);
  requireSuperAdmin(user);

  const { page, limit, skip } = parsePagination(req.nextUrl.searchParams);

  const [logs, total, typeCounts] = await Promise.all([
    prisma.aiActionLog.findMany({
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
      include: {
        organization: { select: { name: true } },
        user: { select: { name: true, email: true } },
      },
    }),
    prisma.aiActionLog.count(),
    prisma.aiActionLog.groupBy({
      by: ['actionType'],
      _count: true,
    }),
  ]);

  const approvalStats = await prisma.aiActionLog.groupBy({
    by: ['isApproved'],
    _count: true,
  });

  return paginatedResponse(
    logs.map(l => ({ ...l, _typeCounts: typeCounts, _approvalStats: approvalStats })),
    total,
    page,
    limit,
  );
});
