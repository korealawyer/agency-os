import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { apiResponse, paginatedResponse, requireAuth, withErrorHandler, parsePagination } from '@/lib/api-helpers';

export const GET = withErrorHandler(async (req: NextRequest) => {
  const user = await requireAuth(req);
  const { page, limit, skip } = parsePagination(req.nextUrl.searchParams);
  const naverAccountId = req.nextUrl.searchParams.get('naverAccountId');
  const startDate = req.nextUrl.searchParams.get('startDate');
  const endDate = req.nextUrl.searchParams.get('endDate');

  const where: any = {
    organizationId: user.organizationId,
    ...(naverAccountId && { naverAccountId }),
    ...(startDate && endDate && {
      summaryDate: {
        gte: new Date(startDate),
        lte: new Date(endDate),
      },
    }),
  };

  const [summaries, total] = await Promise.all([
    prisma.clickFraudDailySummary.findMany({
      where,
      orderBy: { summaryDate: 'desc' },
      skip,
      take: limit,
      include: {
        naverAccount: { select: { customerName: true } },
      },
    }),
    prisma.clickFraudDailySummary.count({ where }),
  ]);

  return paginatedResponse(summaries, total, page, limit);
});
