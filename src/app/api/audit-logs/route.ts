import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { apiResponse, paginatedResponse, requireAuth, requireRole, withErrorHandler, parsePagination } from '@/lib/api-helpers';

export const GET = withErrorHandler(async (req: NextRequest) => {
  const user = await requireAuth(req);
  const { page, limit, skip } = parsePagination(req.nextUrl.searchParams);
  const action = req.nextUrl.searchParams.get('action');
  const entityType = req.nextUrl.searchParams.get('entityType');

  const where: any = {
    organizationId: user.organizationId,
    ...(action && { action }),
    ...(entityType && { entityType }),
  };

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
      include: {
        user: { select: { name: true, email: true } },
      },
    }),
    prisma.auditLog.count({ where }),
  ]);

  return paginatedResponse(logs, total, page, limit);
});
