import { NextRequest } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/db';
import { apiResponse, requireAuth, requireRole, withErrorHandler, logAudit, safeParseBody, NotFoundError } from '@/lib/api-helpers';
import { invalidateCache } from '@/lib/cache';

const updateAdSchema = z.object({
  title: z.string().max(255).optional(),
  description: z.string().optional(),
  displayUrl: z.string().max(500).optional(),
  landingUrl: z.string().optional(),
  isActive: z.boolean().optional(),
});

export const GET = withErrorHandler(async (req: NextRequest, { params }: { params: { id: string } }) => {
  const user = await requireAuth(req);
  // Next.js params is potentially asynchronous in newer versions, awaiting it is safer, but next 14/15 allows synchronous access in some contexts. Let's stick to standard behavior.
  const id = params.id;

  const ad = await prisma.ad.findFirst({
    where: { id, organizationId: user.organizationId, deletedAt: null },
    include: {
      adGroup: {
        select: { name: true, campaign: { select: { name: true } } }
      }
    }
  });

  if (!ad) throw new NotFoundError('광고 소재를 찾을 수 없습니다.');

  return apiResponse(ad);
});

export const PUT = withErrorHandler(async (req: NextRequest, { params }: { params: { id: string } }) => {
  return handleUpdate(req, params.id);
});

export const PATCH = withErrorHandler(async (req: NextRequest, { params }: { params: { id: string } }) => {
  return handleUpdate(req, params.id);
});

async function handleUpdate(req: NextRequest, id: string) {
  const user = await requireAuth(req);
  requireRole(user, 'owner', 'admin', 'editor');

  const ad = await prisma.ad.findFirst({
    where: { id, organizationId: user.organizationId, deletedAt: null },
  });

  if (!ad) throw new NotFoundError('광고 소재를 찾을 수 없습니다.');

  const body = await safeParseBody(req);
  const data = updateAdSchema.parse(body);

  const updatedAd = await prisma.ad.update({
    where: { id },
    data,
  });

  await invalidateCache(`dashboard:${user.organizationId}`);
  logAudit({
    userId: user.id,
    organizationId: user.organizationId,
    action: 'UPDATE',
    entityType: 'Ad',
    entityId: id,
    oldValues: { title: ad.title, description: ad.description, isActive: ad.isActive },
    newValues: { title: updatedAd.title, description: updatedAd.description, isActive: updatedAd.isActive },
  });

  return apiResponse(updatedAd);
}

export const DELETE = withErrorHandler(async (req: NextRequest, { params }: { params: { id: string } }) => {
  const user = await requireAuth(req);
  requireRole(user, 'owner', 'admin');

  const id = params.id;
  const ad = await prisma.ad.findFirst({
    where: { id, organizationId: user.organizationId, deletedAt: null },
  });

  if (!ad) throw new NotFoundError('광고 소재를 찾을 수 없습니다.');

  await prisma.ad.update({
    where: { id },
    data: { deletedAt: new Date() },
  });

  await invalidateCache(`dashboard:${user.organizationId}`);
  logAudit({
    userId: user.id,
    organizationId: user.organizationId,
    action: 'DELETE',
    entityType: 'Ad',
    entityId: id,
    oldValues: { id: ad.id, naverAdId: ad.naverAdId },
  });

  return apiResponse({ success: true });
});
