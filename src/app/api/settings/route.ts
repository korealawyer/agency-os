import { NextRequest } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/db';
import { apiResponse, requireAuth, requireRole, withErrorHandler, safeParseBody, logAudit, NotFoundError } from '@/lib/api-helpers';

// GET: 조직 설정 조회
export const GET = withErrorHandler(async (req: NextRequest) => {
  const user = await requireAuth(req);

  const org = await prisma.organization.findUnique({
    where: { id: user.organizationId },
    select: {
      id: true, name: true, planType: true, businessNumber: true,
      contactEmail: true, maxAccounts: true, isActive: true,
      createdAt: true,
      subscriptions: {
        where: { status: { in: ['active', 'trialing'] } },
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
    },
  });

  if (!org) throw new NotFoundError('조직을 찾을 수 없습니다.');
  return apiResponse(org);
});

// PUT: 조직 설정 수정
const updateSettingsSchema = z.object({
  name: z.string().max(200).optional(),
  businessNumber: z.string().max(20).optional(),
  contactEmail: z.string().email().optional(),
});

export const PUT = withErrorHandler(async (req: NextRequest) => {
  const user = await requireAuth(req);
  requireRole(user, 'owner', 'admin');

  const body = await safeParseBody(req);
  const data = updateSettingsSchema.parse(body);

  const updated = await prisma.organization.update({
    where: { id: user.organizationId },
    data,
    select: {
      id: true, name: true, businessNumber: true,
      contactEmail: true, updatedAt: true,
    },
  });

  logAudit({
    userId: user.id, organizationId: user.organizationId,
    action: 'UPDATE', entityType: 'Organization',
    entityId: user.organizationId, newValues: data,
  });

  return apiResponse(updated);
});
