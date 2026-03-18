import { NextRequest } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/db';
import { apiResponse, paginatedResponse, requireAuth, requireRole, withErrorHandler, logAudit, safeParseBody, NotFoundError, parsePagination } from '@/lib/api-helpers';
import { invalidateCache } from '@/lib/cache';

const createKeywordSchema = z.object({
  adGroupId: z.string().uuid(),
  naverKeywordId: z.string().min(1).max(100),
  keywordText: z.string().min(1).max(500),
  currentBid: z.number().int().min(0).default(0),
  targetRank: z.number().int().min(1).max(15).optional(),
  bidStrategy: z.enum(['target_rank', 'target_cpc', 'target_roas', 'max_conversion', 'time_based', 'manual']).default('manual'),
  matchType: z.enum(['exact', 'phrase', 'broad']).default('exact'),
});

export const GET = withErrorHandler(async (req: NextRequest) => {
  const user = await requireAuth(req);
  const { page, limit, skip } = parsePagination(req.nextUrl.searchParams);
  const search = req.nextUrl.searchParams.get('search');
  const adGroupId = req.nextUrl.searchParams.get('adGroupId');

  const where: any = {
    organizationId: user.organizationId,
    deletedAt: null,
    ...(adGroupId && { adGroupId }),
    ...(search && { keywordText: { contains: search, mode: 'insensitive' } }),
  };

  const [keywords, total] = await Promise.all([
    prisma.keyword.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
      select: {
        id: true, keywordText: true, currentBid: true, targetRank: true,
        bidStrategy: true, matchType: true, qualityIndex: true,
        impressions: true, clicks: true, cpc: true, ctr: true,
        conversions: true, conversionValue: true, cost: true, roas: true,
        isAutoManaged: true, version: true,
        lastSyncAt: true, createdAt: true,
        adGroup: {
          select: {
            id: true,
            name: true,
            campaign: {
              select: {
                name: true,
                naverAccount: { select: { customerName: true } },
              },
            },
          },
        },
      },
    }),
    prisma.keyword.count({ where }),
  ]);

  return paginatedResponse(keywords, total, page, limit);
});

export const POST = withErrorHandler(async (req: NextRequest) => {
  const user = await requireAuth(req);
  requireRole(user, 'owner', 'admin', 'editor');

  const body = await safeParseBody(req);
  const data = createKeywordSchema.parse(body);

  // 광고그룹이 해당 조직 소속인지 확인
  const adGroup = await prisma.adGroup.findFirst({
    where: { id: data.adGroupId, organizationId: user.organizationId, deletedAt: null },
  });
  if (!adGroup) throw new NotFoundError('광고그룹을 찾을 수 없습니다.');

  const keyword = await prisma.keyword.create({
    data: {
      ...data,
      organizationId: user.organizationId,
    },
  });

  await invalidateCache(`dashboard:${user.organizationId}`);
  logAudit({
    userId: user.id, organizationId: user.organizationId,
    action: 'CREATE', entityType: 'Keyword', entityId: keyword.id,
    newValues: { keywordText: data.keywordText, currentBid: data.currentBid },
  });

  return apiResponse(keyword, 201);
});
