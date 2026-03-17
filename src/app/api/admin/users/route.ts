import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { apiResponse, requireAuth, requireSuperAdmin, withErrorHandler, parsePagination, paginatedResponse, safeParseBody } from '@/lib/api-helpers';

export const GET = withErrorHandler(async (req: NextRequest) => {
  const user = await requireAuth(req);
  requireSuperAdmin(user);

  const { page, limit, skip } = parsePagination(req.nextUrl.searchParams);
  const search = req.nextUrl.searchParams.get('search') || '';

  const where = {
    ...(search ? {
      OR: [
        { name: { contains: search, mode: 'insensitive' as const } },
        { email: { contains: search, mode: 'insensitive' as const } },
      ],
    } : {}),
  };

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
      select: {
        id: true, email: true, name: true, role: true,
        isActive: true, lastLoginAt: true, createdAt: true,
        organization: { select: { id: true, name: true } },
      },
    }),
    prisma.user.count({ where }),
  ]);

  return paginatedResponse(users, total, page, limit);
});

export const PATCH = withErrorHandler(async (req: NextRequest) => {
  const user = await requireAuth(req);
  requireSuperAdmin(user);
  const body = await safeParseBody<any>(req);

  const updated = await prisma.user.update({
    where: { id: body.id },
    data: {
      ...(body.role !== undefined ? { role: body.role } : {}),
      ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
      ...(body.name !== undefined ? { name: body.name } : {}),
    },
  });

  return apiResponse(updated);
});
