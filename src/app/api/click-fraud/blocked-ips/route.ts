import { NextRequest } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/db';
import { apiResponse, paginatedResponse, requireAuth, requireRole, withErrorHandler, logAudit, safeParseBody, parsePagination } from '@/lib/api-helpers';

const createBlockedIpSchema = z.object({
  naverAccountId: z.string().uuid(),
  ipHash: z.string().min(1).max(64),
  ipMasked: z.string().max(15).optional(),
  blockReason: z.enum(['rule_based', 'ml_detected', 'manual']).default('manual'),
  triggeredRules: z.array(z.string()).default([]),
  fraudCount: z.number().int().default(0),
  estimatedLoss: z.number().default(0),
  expiresAt: z.string().datetime().optional(),
});

export const GET = withErrorHandler(async (req: NextRequest) => {
  const user = await requireAuth(req);
  const { page, limit, skip } = parsePagination(req.nextUrl.searchParams);
  const isActiveStr = req.nextUrl.searchParams.get('isActive');
  const naverAccountId = req.nextUrl.searchParams.get('naverAccountId');

  const where: any = {
    organizationId: user.organizationId,
    ...(isActiveStr !== null && { isActive: isActiveStr === 'true' }),
    ...(naverAccountId && { naverAccountId }),
  };

  const [blockedIps, total] = await Promise.all([
    prisma.blockedIp.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
      include: {
        naverAccount: { select: { customerName: true } },
      },
    }),
    prisma.blockedIp.count({ where }),
  ]);

  return paginatedResponse(blockedIps, total, page, limit);
});

export const POST = withErrorHandler(async (req: NextRequest) => {
  const user = await requireAuth(req);
  requireRole(user, 'owner', 'admin');

  const body = await safeParseBody(req);
  const data = createBlockedIpSchema.parse(body);

  const blockedIp = await prisma.blockedIp.create({
    data: {
      organizationId: user.organizationId,
      naverAccountId: data.naverAccountId,
      ipHash: data.ipHash,
      ipMasked: data.ipMasked,
      blockReason: data.blockReason,
      triggeredRules: data.triggeredRules,
      fraudCount: data.fraudCount,
      estimatedLoss: data.estimatedLoss,
      isActive: true,
      expiresAt: data.expiresAt ? new Date(data.expiresAt) : undefined,
    },
  });

  logAudit({
    userId: user.id, organizationId: user.organizationId,
    action: 'CREATE', entityType: 'BlockedIp', entityId: blockedIp.id,
    newValues: { ipHash: data.ipHash, blockReason: data.blockReason },
  });

  return apiResponse(blockedIp, 201);
});
