import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { apiResponse, requireAuth, requireSuperAdmin, withErrorHandler, safeParseBody } from '@/lib/api-helpers';

export const GET = withErrorHandler(async (req: NextRequest) => {
  const user = await requireAuth(req);
  requireSuperAdmin(user);

  const notifications = await prisma.notification.findMany({
    where: { type: 'system_notice' },
    orderBy: { createdAt: 'desc' },
    take: 50,
    include: { organization: { select: { name: true } } },
  });

  return apiResponse({ notifications });
});

export const POST = withErrorHandler(async (req: NextRequest) => {
  const user = await requireAuth(req);
  requireSuperAdmin(user);
  const body = await safeParseBody<any>(req);

  // 전체 조직의 owner에게 시스템 공지 발송
  const owners = await prisma.user.findMany({
    where: { role: { in: ['owner', 'admin'] }, isActive: true, deletedAt: null },
    select: { id: true, organizationId: true },
  });

  const notifications = await prisma.notification.createMany({
    data: owners.map(owner => ({
      userId: owner.id,
      organizationId: owner.organizationId,
      type: 'system_notice' as const,
      priority: body.priority || 'normal',
      title: body.title,
      message: body.message,
      metadata: { isGlobal: true },
    })),
  });

  return apiResponse({ created: notifications.count }, 201);
});
