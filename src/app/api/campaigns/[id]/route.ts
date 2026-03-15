import { NextRequest } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/db';
import { apiResponse, requireAuth, requireRole, withErrorHandler, logAudit, NotFoundError, safeParseBody } from '@/lib/api-helpers';
import { invalidateCache } from '@/lib/cache';

const updateCampaignSchema = z.object({
  name: z.string().max(255).optional(),
  status: z.enum(['active', 'paused', 'ended', 'draft']).optional(),
  dailyBudget: z.number().int().positive().optional(),
});

export const GET = withErrorHandler(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireAuth(req);
  const { id } = await params;

  const campaign = await prisma.campaign.findFirst({
    where: { id, organizationId: user.organizationId, deletedAt: null },
    include: {
      naverAccount: { select: { id: true, customerName: true } },
      adGroups: {
        where: { deletedAt: null },
        orderBy: { createdAt: 'desc' },
        include: {
          _count: { select: { keywords: { where: { deletedAt: null } } } },
        },
      },
    },
  });

  if (!campaign) throw new NotFoundError('캠페인을 찾을 수 없습니다.');
  return apiResponse(campaign);
});

export const PUT = withErrorHandler(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireAuth(req);
  requireRole(user, 'owner', 'admin', 'editor');
  const { id } = await params;

  const body = await safeParseBody(req);
  const data = updateCampaignSchema.parse(body);

  const existing = await prisma.campaign.findFirst({
    where: { id, organizationId: user.organizationId, deletedAt: null },
  });
  if (!existing) throw new NotFoundError('캠페인을 찾을 수 없습니다.');

  const updated = await prisma.campaign.update({
    where: { id, organizationId: user.organizationId },
    data,
  });

  await invalidateCache(`dashboard:${user.organizationId}`);
  logAudit({
    userId: user.id, organizationId: user.organizationId,
    action: 'UPDATE', entityType: 'Campaign', entityId: id,
    oldValues: { name: existing.name, status: existing.status },
    newValues: data,
  });

  return apiResponse(updated);
});

export const DELETE = withErrorHandler(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireAuth(req);
  requireRole(user, 'owner', 'admin');
  const { id } = await params;

  const existing = await prisma.campaign.findFirst({
    where: { id, organizationId: user.organizationId, deletedAt: null },
  });
  if (!existing) throw new NotFoundError('캠페인을 찾을 수 없습니다.');

  await prisma.campaign.update({
    where: { id, organizationId: user.organizationId },
    data: { deletedAt: new Date() },
  });

  await invalidateCache(`dashboard:${user.organizationId}`);
  logAudit({
    userId: user.id, organizationId: user.organizationId,
    action: 'DELETE', entityType: 'Campaign', entityId: id,
  });

  return apiResponse({ success: true });
});
