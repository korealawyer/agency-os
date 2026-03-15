import { NextRequest } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/db';
import { apiResponse, paginatedResponse, requireAuth, requireRole, withErrorHandler, logAudit, safeParseBody, NotFoundError, parsePagination } from '@/lib/api-helpers';

const createAdGroupSchema = z.object({
  campaignId: z.string().uuid(),
  naverAdGroupId: z.string().min(1).max(100),
  name: z.string().min(1).max(255),
  isActive: z.boolean().default(true),
  dailyBudget: z.number().int().optional(),
});

export const GET = withErrorHandler(async (req: NextRequest) => {
  const user = await requireAuth(req);
  const { page, limit, skip } = parsePagination(req.nextUrl.searchParams);
  const campaignId = req.nextUrl.searchParams.get('campaignId');
  const isActiveStr = req.nextUrl.searchParams.get('isActive');

  const where: any = {
    organizationId: user.organizationId,
    deletedAt: null,
    ...(campaignId && { campaignId }),
    ...(isActiveStr !== null && { isActive: isActiveStr === 'true' }),
  };

  const [adGroups, total] = await Promise.all([
    prisma.adGroup.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
      include: {
        campaign: { select: { name: true, status: true } },
        _count: { select: { keywords: true, ads: true } },
      },
    }),
    prisma.adGroup.count({ where }),
  ]);

  return paginatedResponse(adGroups, total, page, limit);
});

export const POST = withErrorHandler(async (req: NextRequest) => {
  const user = await requireAuth(req);
  requireRole(user, 'owner', 'admin', 'editor');

  const body = await safeParseBody(req);
  const data = createAdGroupSchema.parse(body);

  const campaign = await prisma.campaign.findFirst({
    where: { id: data.campaignId, organizationId: user.organizationId, deletedAt: null },
  });
  if (!campaign) throw new NotFoundError('캠페인을 찾을 수 없습니다.');

  const adGroup = await prisma.adGroup.create({
    data: {
      ...data,
      organizationId: user.organizationId,
    },
  });

  logAudit({
    userId: user.id, organizationId: user.organizationId,
    action: 'CREATE', entityType: 'AdGroup', entityId: adGroup.id,
    newValues: { name: data.name, campaignId: data.campaignId },
  });

  return apiResponse(adGroup, 201);
});
