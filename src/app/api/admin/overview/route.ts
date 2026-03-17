import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { apiResponse, requireAuth, requireSuperAdmin, withErrorHandler } from '@/lib/api-helpers';

export const GET = withErrorHandler(async (req: NextRequest) => {
  const user = await requireAuth(req);
  requireSuperAdmin(user);

  const [
    totalOrgs, activeOrgs,
    totalUsers, activeUsers,
    totalSubscriptions,
    totalNaverAccounts, connectedAccounts,
    totalAiActions, approvedActions,
    totalFraudEvents,
  ] = await Promise.all([
    prisma.organization.count(),
    prisma.organization.count({ where: { isActive: true, deletedAt: null } }),
    prisma.user.count(),
    prisma.user.count({ where: { isActive: true, deletedAt: null } }),
    prisma.subscription.count({ where: { status: 'active' } }),
    prisma.naverAccount.count(),
    prisma.naverAccount.count({ where: { connectionStatus: 'connected' } }),
    prisma.aiActionLog.count(),
    prisma.aiActionLog.count({ where: { isApproved: true } }),
    prisma.clickFraudEvent.count({ where: { status: 'confirmed' } }),
  ]);

  // MRR 계산
  const mrrResult = await prisma.subscription.aggregate({
    _sum: { monthlyPrice: true },
    where: { status: 'active' },
  });

  // 최근 가입 조직
  const recentOrgs = await prisma.organization.findMany({
    orderBy: { createdAt: 'desc' },
    take: 5,
    select: { id: true, name: true, planType: true, createdAt: true, isActive: true },
  });

  // 총 광고비
  const adSpendResult = await prisma.organization.aggregate({
    _sum: { totalAdSpend: true },
  });

  return apiResponse({
    kpi: {
      totalOrgs,
      activeOrgs,
      totalUsers,
      activeUsers,
      mrr: mrrResult._sum.monthlyPrice ?? 0,
      totalSubscriptions,
      totalNaverAccounts,
      connectedAccounts,
      totalAdSpend: adSpendResult._sum.totalAdSpend ?? 0,
      aiActionCount: totalAiActions,
      aiApprovalRate: totalAiActions > 0
        ? Math.round((approvedActions / totalAiActions) * 100)
        : 0,
      totalFraudEvents,
    },
    recentOrgs,
  });
});
