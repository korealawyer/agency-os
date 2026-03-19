import { NextRequest } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/db';
import { apiResponse, requireAuth, requireRole, withErrorHandler, logAudit, safeParseBody, NotFoundError } from '@/lib/api-helpers';

const approveActionSchema = z.object({
  isApproved: z.boolean(),
});

export const PATCH = withErrorHandler(async (req: NextRequest, context: any) => {
  const user = await requireAuth(req);
  requireRole(user, 'owner', 'admin', 'editor');

  const { id } = await context.params;
  const body = await safeParseBody(req);
  const data = approveActionSchema.parse(body);

  const existing = await prisma.aiActionLog.findFirst({
    where: { id, organizationId: user.organizationId },
  });
  if (!existing) throw new NotFoundError('AI 액션 로그를 찾을 수 없습니다.');

  const updated = await prisma.aiActionLog.update({
    where: { id },
    data: {
      isApproved: data.isApproved,
      approvedAt: data.isApproved ? new Date() : null,
    },
  });

  logAudit({
    userId: user.id, organizationId: user.organizationId,
    action: 'UPDATE', entityType: 'AiActionLog', entityId: id,
    oldValues: { isApproved: existing.isApproved },
    newValues: { isApproved: data.isApproved },
  });

  return apiResponse(updated);
});
