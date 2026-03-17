import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { apiResponse, requireAuth, requireSuperAdmin, withErrorHandler } from '@/lib/api-helpers';

export const GET = withErrorHandler(async (req: NextRequest) => {
  const user = await requireAuth(req);
  requireSuperAdmin(user);

  const profitability = await prisma.profitability.findMany({
    orderBy: { period: 'desc' },
    take: 100,
    include: {
      organization: { select: { id: true, name: true } },
      naverAccount: { select: { id: true, customerName: true } },
    },
  });

  const totals = await prisma.profitability.aggregate({
    _sum: { adSpend: true, agencyFee: true, netProfit: true, laborCost: true },
  });

  // 조직별 수익 랭킹
  const orgProfits = await prisma.profitability.groupBy({
    by: ['organizationId'],
    _sum: { netProfit: true, adSpend: true, agencyFee: true },
    orderBy: { _sum: { netProfit: 'desc' } },
    take: 20,
  });

  return apiResponse({ profitability, totals, orgProfits });
});
