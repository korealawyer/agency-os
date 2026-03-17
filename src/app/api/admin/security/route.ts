import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { apiResponse, requireAuth, requireSuperAdmin, withErrorHandler } from '@/lib/api-helpers';

export const GET = withErrorHandler(async (req: NextRequest) => {
  const user = await requireAuth(req);
  requireSuperAdmin(user);

  const [loginAttempts, recentLogins, inactiveUsers] = await Promise.all([
    prisma.auditLog.count({ where: { action: 'LOGIN' } }),
    prisma.auditLog.findMany({
      where: { action: 'LOGIN' },
      orderBy: { createdAt: 'desc' },
      take: 20,
      include: { user: { select: { name: true, email: true } }, organization: { select: { name: true } } },
    }),
    prisma.user.count({
      where: {
        isActive: true,
        lastLoginAt: { lt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
      },
    }),
  ]);

  return apiResponse({ loginAttempts, recentLogins, inactiveUsers });
});
