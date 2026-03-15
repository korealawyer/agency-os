import { NextRequest } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/db';
import { apiResponse, paginatedResponse, requireAuth, requireRole, withErrorHandler, logAudit, safeParseBody, NotFoundError, parsePagination } from '@/lib/api-helpers';
import { invalidateCache } from '@/lib/cache';

const createAdSchema = z.object({
  adGroupId: z.string().uuid(),
  naverAdId: z.string().min(1).max(100),
  title: z.string().max(255).optional(),
  description: z.string().optional(),
  displayUrl: z.string().max(500).optional(),
  landingUrl: z.string().optional(),
  isActive: z.boolean().default(true),
});

export const GET = withErrorHandler(async (req: NextRequest) => {
  const user = await requireAuth(req);
  const { page, limit, skip } = parsePagination(req.nextUrl.searchParams);
  const adGroupId = req.nextUrl.searchParams.get('adGroupId');
  const isActiveStr = req.nextUrl.searchParams.get('isActive');

  const where: any = {
    organizationId: user.organizationId,
    deletedAt: null,
    ...(adGroupId && { adGroupId }),
    ...(isActiveStr !== null && { isActive: isActiveStr === 'true' }),
  };

  const [ads, total] = await Promise.all([
    prisma.ad.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
      select: {
        id: true, adGroupId: true, naverAdId: true, title: true,
        description: true, displayUrl: true, landingUrl: true, isActive: true,
        adGroup: { select: { name: true, campaign: { select: { name: true } } } },
        createdAt: true,
      },
    }),
    prisma.ad.count({ where }),
  ]);

  return paginatedResponse(ads, total, page, limit);
});

export const POST = withErrorHandler(async (req: NextRequest) => {
  const user = await requireAuth(req);
  requireRole(user, 'owner', 'admin', 'editor');

  const body = await safeParseBody(req);
  const data = createAdSchema.parse(body);

  // 광고그룹이 유효하고 해당 조직 소속인지 확인
  const adGroup = await prisma.adGroup.findFirst({
    where: { id: data.adGroupId, organizationId: user.organizationId, deletedAt: null },
  });
  if (!adGroup) throw new NotFoundError('광고그룹을 찾을 수 없습니다.');

  const ad = await prisma.ad.create({
    data: {
      ...data,
      organizationId: user.organizationId,
    },
  });

  await invalidateCache(`dashboard:${user.organizationId}`);
  logAudit({
    userId: user.id, organizationId: user.organizationId,
    action: 'CREATE', entityType: 'Ad', entityId: ad.id,
    newValues: { naverAdId: data.naverAdId, title: data.title },
  });

  return apiResponse(ad, 201);
});
