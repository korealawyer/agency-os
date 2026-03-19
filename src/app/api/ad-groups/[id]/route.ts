import { NextRequest } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/db';
import { apiResponse, requireAuth, requireRole, withErrorHandler, logAudit, safeParseBody, NotFoundError } from '@/lib/api-helpers';

const updateAdGroupSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  isActive: z.boolean().optional(),
  dailyBudget: z.number().int().nullable().optional(),
});

export const PATCH = withErrorHandler(async (req: NextRequest, context: any) => {
  const user = await requireAuth(req);
  requireRole(user, 'owner', 'admin', 'editor');

  const { id } = await context.params;
  const body = await safeParseBody(req);
  const data = updateAdGroupSchema.parse(body);

  const existing = await prisma.adGroup.findFirst({
    where: { id, organizationId: user.organizationId, deletedAt: null },
  });
  if (!existing) throw new NotFoundError('광고그룹을 찾을 수 없습니다.');

  const updated = await prisma.adGroup.update({
    where: { id },
    data,
  });

  logAudit({
    userId: user.id, organizationId: user.organizationId,
    action: 'UPDATE', entityType: 'AdGroup', entityId: id,
    oldValues: { name: existing.name, isActive: existing.isActive },
    newValues: data,
  });

  return apiResponse(updated);
});

export const DELETE = withErrorHandler(async (req: NextRequest, context: any) => {
  const user = await requireAuth(req);
  requireRole(user, 'owner', 'admin', 'editor');

  const { id } = await context.params;

  const existing = await prisma.adGroup.findFirst({
    where: { id, organizationId: user.organizationId, deletedAt: null },
  });
  if (!existing) throw new NotFoundError('광고그룹을 찾을 수 없습니다.');

  await prisma.adGroup.update({
    where: { id },
    data: { deletedAt: new Date() },
  });

  logAudit({
    userId: user.id, organizationId: user.organizationId,
    action: 'DELETE', entityType: 'AdGroup', entityId: id,
    oldValues: { name: existing.name },
  });

  return apiResponse({ deleted: true });
});
