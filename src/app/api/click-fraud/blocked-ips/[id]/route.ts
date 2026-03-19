import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { apiResponse, requireAuth, requireRole, withErrorHandler, logAudit, NotFoundError } from '@/lib/api-helpers';

export const PATCH = withErrorHandler(async (req: NextRequest, context: any) => {
  const user = await requireAuth(req);
  requireRole(user, 'owner', 'admin', 'editor');

  const { id } = await context.params;

  const existing = await prisma.blockedIp.findFirst({
    where: { id, organizationId: user.organizationId },
  });
  if (!existing) throw new NotFoundError('차단된 IP를 찾을 수 없습니다.');

  const updated = await prisma.blockedIp.update({
    where: { id },
    data: {
      isActive: !existing.isActive,
      unblockedAt: existing.isActive ? new Date() : null,
    },
  });

  logAudit({
    userId: user.id, organizationId: user.organizationId,
    action: 'UPDATE', entityType: 'BlockedIp', entityId: id,
    oldValues: { isActive: existing.isActive },
    newValues: { isActive: updated.isActive },
  });

  return apiResponse(updated);
});
