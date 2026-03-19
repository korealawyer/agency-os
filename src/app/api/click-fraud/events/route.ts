import { NextRequest } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/db';
import { apiResponse, paginatedResponse, requireAuth, requireRole, withErrorHandler, logAudit, safeParseBody, parsePagination } from '@/lib/api-helpers';

const createEventSchema = z.object({
  naverAccountId: z.string().uuid(),
  keywordId: z.string().uuid().optional(),
  campaignId: z.string().uuid().optional(),
  clickTimestamp: z.string().datetime(),
  ipHash: z.string().min(1).max(64),
  userAgent: z.string().optional(),
  deviceFingerprint: z.string().max(64).optional(),
  geoCountry: z.string().max(2).optional(),
  geoRegion: z.string().max(20).optional(),
  sessionId: z.string().max(64).optional(),
  landingUrl: z.string().optional(),
  dwellTimeMs: z.number().int().optional(),
  fraudScore: z.number().min(0).max(1).default(0),
  triggeredRules: z.array(z.string()).default([]),
});

export const GET = withErrorHandler(async (req: NextRequest) => {
  const user = await requireAuth(req);
  const { page, limit, skip } = parsePagination(req.nextUrl.searchParams);
  const status = req.nextUrl.searchParams.get('status');
  const naverAccountId = req.nextUrl.searchParams.get('naverAccountId');

  const where: any = {
    organizationId: user.organizationId,
    ...(status && { status }),
    ...(naverAccountId && { naverAccountId }),
  };

  const [events, total] = await Promise.all([
    prisma.clickFraudEvent.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
      include: {
        naverAccount: { select: { customerName: true } },
        keyword: { select: { keywordText: true } },
        campaign: { select: { name: true } },
      },
    }),
    prisma.clickFraudEvent.count({ where }),
  ]);

  return paginatedResponse(events, total, page, limit);
});

export const POST = withErrorHandler(async (req: NextRequest) => {
  const user = await requireAuth(req);
  requireRole(user, 'owner', 'admin', 'editor');

  const body = await safeParseBody(req);
  const data = createEventSchema.parse(body);

  const event = await prisma.clickFraudEvent.create({
    data: {
      organizationId: user.organizationId,
      naverAccountId: data.naverAccountId,
      keywordId: data.keywordId,
      campaignId: data.campaignId,
      clickTimestamp: new Date(data.clickTimestamp),
      ipHash: data.ipHash,
      userAgent: data.userAgent,
      deviceFingerprint: data.deviceFingerprint,
      geoCountry: data.geoCountry,
      geoRegion: data.geoRegion,
      sessionId: data.sessionId,
      landingUrl: data.landingUrl,
      dwellTimeMs: data.dwellTimeMs,
      fraudScore: data.fraudScore,
      triggeredRules: data.triggeredRules,
      status: 'pending',
    },
  });

  logAudit({
    userId: user.id, organizationId: user.organizationId,
    action: 'CREATE', entityType: 'ClickFraudEvent', entityId: event.id,
    newValues: { ipHash: data.ipHash, fraudScore: data.fraudScore },
  });

  return apiResponse(event, 201);
});
