import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { requireAuth, requireSuperAdmin, withErrorHandler, parsePagination, paginatedResponse } from '@/lib/api-helpers';

export const GET = withErrorHandler(async (req: NextRequest) => {
  const user = await requireAuth(req);
  requireSuperAdmin(user);

  const { page, limit, skip } = parsePagination(req.nextUrl.searchParams);
  const action = req.nextUrl.searchParams.get('action') || '';
  const entityType = req.nextUrl.searchParams.get('entityType') || '';

  const where = {
    ...(action ? { action: action as any } : {}),
    ...(entityType ? { entityType } : {}),
  };

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
      include: {
        user: { select: { name: true, email: true } },
        organization: { select: { name: true } },
      },
    }),
    prisma.auditLog.count({ where }),
  ]);

  return paginatedResponse(logs, total, page, limit);
});
