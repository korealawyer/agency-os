import { NextRequest } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/db';
import { apiResponse, paginatedResponse, requireAuth, requireRole, withErrorHandler, logAudit, safeParseBody, NotFoundError, parsePagination } from '@/lib/api-helpers';
import { invalidateCache } from '@/lib/cache';

const createCampaignSchema = z.object({
  naverAccountId: z.string().uuid(),
  naverCampaignId: z.string().min(1).max(100),
  name: z.string().min(1).max(255),
  status: z.enum(['active', 'paused', 'ended', 'draft']).default('active'),
  campaignType: z.enum(['WEB_SITE', 'SHOPPING', 'BRAND_SEARCH', 'PERFORMANCE_MAX']).optional(),
  dailyBudget: z.number().int().positive().optional(),
});

export const GET = withErrorHandler(async (req: NextRequest) => {
  const user = await requireAuth(req);
  const { page, limit, skip } = parsePagination(req.nextUrl.searchParams);
  const status = req.nextUrl.searchParams.get('status');

  const where: any = {
    organizationId: user.organizationId,
    deletedAt: null,
    ...(status && { status }),
  };

  const [campaigns, total] = await Promise.all([
    prisma.campaign.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
      select: {
        id: true, name: true, status: true, campaignType: true,
        dailyBudget: true, totalCost: true, impressions: true,
        clicks: true, conversions: true, lastSyncAt: true,
        naverAccount: { select: { customerName: true } },
        _count: { select: { adGroups: true } },
        createdAt: true,
      },
    }),
    prisma.campaign.count({ where }),
  ]);

  return paginatedResponse(campaigns, total, page, limit);
});

export const POST = withErrorHandler(async (req: NextRequest) => {
  const user = await requireAuth(req);
  requireRole(user, 'owner', 'admin', 'editor');

  const body = await safeParseBody(req);
  const data = createCampaignSchema.parse(body);

  // 네이버 계정이 해당 조직 소속인지 확인
  const account = await prisma.naverAccount.findFirst({
    where: { id: data.naverAccountId, organizationId: user.organizationId, deletedAt: null },
  });
  if (!account) throw new NotFoundError('네이버 계정을 찾을 수 없습니다.');

  const campaign = await prisma.campaign.create({
    data: {
      ...data,
      organizationId: user.organizationId,
    },
  });

  await invalidateCache(`dashboard:${user.organizationId}`);
  logAudit({
    userId: user.id, organizationId: user.organizationId,
    action: 'CREATE', entityType: 'Campaign', entityId: campaign.id,
    newValues: { name: data.name },
  });

  return apiResponse(campaign, 201);
});
