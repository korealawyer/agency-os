import { NextRequest } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/db';
import { apiResponse, requireAuth, requireRole, withErrorHandler, logAudit, NotFoundError, safeParseBody } from '@/lib/api-helpers';
import { invalidateCache } from '@/lib/cache';

const updateAccountSchema = z.object({
  customerName: z.string().max(200).optional(),
  dailyBudget: z.number().int().positive().optional(),
  commissionRate: z.number().min(0).max(1).optional(),
  isActive: z.boolean().optional(),
});

export const GET = withErrorHandler(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireAuth(req);
  const { id } = await params;

  const account = await prisma.naverAccount.findFirst({
    where: { id, organizationId: user.organizationId, deletedAt: null },
    include: {
      campaigns: {
        where: { deletedAt: null },
        orderBy: { createdAt: 'desc' },
        take: 20,
        select: { id: true, name: true, status: true, totalCost: true },
      },
      _count: {
        select: {
          campaigns: { where: { deletedAt: null } },
          clickFraudEvents: true,
        },
      },
    },
  });

  if (!account) throw new NotFoundError('계정을 찾을 수 없습니다.');

  return apiResponse(account);
});

export const PUT = withErrorHandler(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireAuth(req);
  requireRole(user, 'owner', 'admin');
  const { id } = await params;

  const body = await safeParseBody(req);
  const data = updateAccountSchema.parse(body);

  const existing = await prisma.naverAccount.findFirst({
    where: { id, organizationId: user.organizationId, deletedAt: null },
  });
  if (!existing) throw new NotFoundError('계정을 찾을 수 없습니다.');

  const updated = await prisma.naverAccount.update({
    where: { id, organizationId: user.organizationId },
    data,
  });

  await invalidateCache(`dashboard:${user.organizationId}`);
  logAudit({
    userId: user.id, organizationId: user.organizationId,
    action: 'UPDATE', entityType: 'NaverAccount', entityId: id,
    oldValues: { customerName: existing.customerName },
    newValues: data,
  });

  return apiResponse(updated);
});

export const DELETE = withErrorHandler(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireAuth(req);
  requireRole(user, 'owner');
  const { id } = await params;

  const existing = await prisma.naverAccount.findFirst({
    where: { id, organizationId: user.organizationId, deletedAt: null },
  });
  if (!existing) throw new NotFoundError('계정을 찾을 수 없습니다.');

  // Soft delete
  await prisma.naverAccount.update({
    where: { id, organizationId: user.organizationId },
    data: { deletedAt: new Date(), isActive: false },
  });

  await invalidateCache(`dashboard:${user.organizationId}`);
  logAudit({
    userId: user.id, organizationId: user.organizationId,
    action: 'DELETE', entityType: 'NaverAccount', entityId: id,
  });

  return apiResponse({ success: true });
});
