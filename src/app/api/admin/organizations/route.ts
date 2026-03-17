import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { apiResponse, apiError, requireAuth, requireSuperAdmin, withErrorHandler, parsePagination, paginatedResponse, safeParseBody } from '@/lib/api-helpers';

export const GET = withErrorHandler(async (req: NextRequest) => {
  const user = await requireAuth(req);
  requireSuperAdmin(user);

  const { page, limit, skip } = parsePagination(req.nextUrl.searchParams);
  const search = req.nextUrl.searchParams.get('search') || '';

  const where = {
    ...(search ? { name: { contains: search, mode: 'insensitive' as const } } : {}),
  };

  const [orgs, total] = await Promise.all([
    prisma.organization.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
      include: {
        _count: { select: { users: true, naverAccounts: true } },
        subscriptions: { where: { status: 'active' }, take: 1, select: { planType: true, status: true } },
      },
    }),
    prisma.organization.count({ where }),
  ]);

  return paginatedResponse(orgs, total, page, limit);
});

export const POST = withErrorHandler(async (req: NextRequest) => {
  const user = await requireAuth(req);
  requireSuperAdmin(user);
  const body = await safeParseBody<any>(req);

  const org = await prisma.organization.create({
    data: {
      name: body.name,
      planType: body.planType || 'starter',
      contactEmail: body.contactEmail,
      businessNumber: body.businessNumber,
      maxAccounts: body.maxAccounts || 5,
    },
  });

  return apiResponse(org, 201);
});
