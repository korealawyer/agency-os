import { NextRequest } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/db';
import { apiResponse, paginatedResponse, requireAuth, requireRole, withErrorHandler, logAudit, safeParseBody, parsePagination } from '@/lib/api-helpers';

const createCompetitiveSchema = z.object({
  naverAccountId: z.string().uuid().optional(),
  keywordText: z.string().min(1).max(500),
  top5Ads: z.array(z.record(z.string(), z.unknown())).default([]),
  estimatedBidLow: z.number().int().optional(),
  estimatedBidHigh: z.number().int().optional(),
  competitorCount: z.number().int().default(0),
});

export const GET = withErrorHandler(async (req: NextRequest) => {
  const user = await requireAuth(req);
  const { page, limit, skip } = parsePagination(req.nextUrl.searchParams);
  const keywordText = req.nextUrl.searchParams.get('keywordText');
  const naverAccountId = req.nextUrl.searchParams.get('naverAccountId');

  const where: any = {
    organizationId: user.organizationId,
    ...(keywordText && { keywordText: { contains: keywordText } }),
    ...(naverAccountId && { naverAccountId }),
  };

  const [intel, total] = await Promise.all([
    prisma.competitiveIntel.findMany({
      where,
      orderBy: { crawledAt: 'desc' },
      skip,
      take: limit,
      include: {
        naverAccount: { select: { customerName: true } },
      },
    }),
    prisma.competitiveIntel.count({ where }),
  ]);

  return paginatedResponse(intel, total, page, limit);
});

export const POST = withErrorHandler(async (req: NextRequest) => {
  const user = await requireAuth(req);
  requireRole(user, 'owner', 'admin', 'editor');

  const body = await safeParseBody(req);
  const data = createCompetitiveSchema.parse(body);

  const intel = await prisma.competitiveIntel.create({
    data: {
      organizationId: user.organizationId,
      naverAccountId: data.naverAccountId,
      keywordText: data.keywordText,
      top5Ads: data.top5Ads as any,
      estimatedBidLow: data.estimatedBidLow,
      estimatedBidHigh: data.estimatedBidHigh,
      competitorCount: data.competitorCount,
    },
  });

  logAudit({
    userId: user.id, organizationId: user.organizationId,
    action: 'CREATE', entityType: 'CompetitiveIntel', entityId: intel.id,
    newValues: { keywordText: data.keywordText, competitorCount: data.competitorCount },
  });

  return apiResponse(intel, 201);
});
