import { NextRequest } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/db';
import { apiResponse, requireAuth, requireRole, withErrorHandler, logAudit, safeParseBody, NotFoundError } from '@/lib/api-helpers';

const updateEventSchema = z.object({
  status: z.enum(['confirmed', 'dismissed']),
  actionTaken: z.string().max(20).optional(),
});

export const PATCH = withErrorHandler(async (req: NextRequest, context: any) => {
  const user = await requireAuth(req);
  requireRole(user, 'owner', 'admin');

  const { id } = await context.params;
  const body = await safeParseBody(req);
  const data = updateEventSchema.parse(body);

  const existing = await prisma.clickFraudEvent.findFirst({
    where: { id, organizationId: user.organizationId },
  });
  if (!existing) throw new NotFoundError('부정클릭 이벤트를 찾을 수 없습니다.');

  const updated = await prisma.clickFraudEvent.update({
    where: { id },
    data: {
      status: data.status,
      actionTaken: data.actionTaken,
    },
  });

  logAudit({
    userId: user.id, organizationId: user.organizationId,
    action: 'UPDATE', entityType: 'ClickFraudEvent', entityId: id,
    oldValues: { status: existing.status },
    newValues: { status: data.status },
  });

  return apiResponse(updated);
});
