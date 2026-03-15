import { NextRequest } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/db';
import { apiResponse, requireAuth, requireRole, withErrorHandler, safeParseBody, NotFoundError, ForbiddenError, logAudit } from '@/lib/api-helpers';

const updateMemberSchema = z.object({
  role: z.enum(['admin', 'editor', 'viewer']).optional(),
  isActive: z.boolean().optional(),
});

export const PUT = withErrorHandler(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireAuth(req);
  requireRole(user, 'owner', 'admin');
  const { id } = await params;

  // 자기 자신의 role 변경 방지
  if (id === user.id) throw new ForbiddenError('자신의 역할은 변경할 수 없습니다.');

  const body = await safeParseBody(req);
  const data = updateMemberSchema.parse(body);

  const member = await prisma.user.findFirst({
    where: { id, organizationId: user.organizationId, deletedAt: null },
  });
  if (!member) throw new NotFoundError('멤버를 찾을 수 없습니다.');

  // owner 역할은 변경 불가
  if (member.role === 'owner') throw new ForbiddenError('Owner 역할은 변경할 수 없습니다.');

  const updated = await prisma.user.update({
    where: { id },
    data,
    select: {
      id: true, email: true, name: true, role: true,
      isActive: true, updatedAt: true,
    },
  });

  logAudit({
    userId: user.id, organizationId: user.organizationId,
    action: 'UPDATE', entityType: 'User', entityId: id,
    oldValues: { role: member.role, isActive: member.isActive },
    newValues: data,
  });

  return apiResponse(updated);
});

export const DELETE = withErrorHandler(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireAuth(req);
  requireRole(user, 'owner');
  const { id } = await params;

  if (id === user.id) throw new ForbiddenError('자기 자신은 삭제할 수 없습니다.');

  const member = await prisma.user.findFirst({
    where: { id, organizationId: user.organizationId, deletedAt: null },
  });
  if (!member) throw new NotFoundError('멤버를 찾을 수 없습니다.');
  if (member.role === 'owner') throw new ForbiddenError('Owner는 삭제할 수 없습니다.');

  await prisma.user.update({
    where: { id },
    data: { deletedAt: new Date(), isActive: false },
  });

  logAudit({
    userId: user.id, organizationId: user.organizationId,
    action: 'DELETE', entityType: 'User', entityId: id,
  });

  return apiResponse({ success: true });
});
