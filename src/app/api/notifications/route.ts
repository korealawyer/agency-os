import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { apiResponse, paginatedResponse, requireAuth, withErrorHandler, parsePagination, NotFoundError } from '@/lib/api-helpers';

export const GET = withErrorHandler(async (req: NextRequest) => {
  const user = await requireAuth(req);
  const { page, limit, skip } = parsePagination(req.nextUrl.searchParams);
  const unreadOnly = req.nextUrl.searchParams.get('unread') === 'true';

  const where: any = {
    organizationId: user.organizationId,
    userId: user.id,
    ...(unreadOnly && { isRead: false }),
  };

  const [notifications, total] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.notification.count({ where }),
  ]);

  return paginatedResponse(notifications, total, page, limit);
});

// 일괄 읽음 처리
export const PATCH = withErrorHandler(async (req: NextRequest) => {
  const user = await requireAuth(req);

  const updated = await prisma.notification.updateMany({
    where: {
      organizationId: user.organizationId,
      userId: user.id,
      isRead: false,
    },
    data: {
      isRead: true,
      readAt: new Date(),
    },
  });

  return apiResponse({ markedAsRead: updated.count });
});
