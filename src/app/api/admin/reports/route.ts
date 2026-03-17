import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { apiResponse, requireAuth, requireSuperAdmin, withErrorHandler } from '@/lib/api-helpers';

export const GET = withErrorHandler(async (req: NextRequest) => {
  const user = await requireAuth(req);
  requireSuperAdmin(user);

  const [reports, templates, totalReports] = await Promise.all([
    prisma.report.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: {
        organization: { select: { name: true } },
        template: { select: { name: true } },
      },
    }),
    prisma.reportTemplate.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        organization: { select: { name: true } },
        _count: { select: { reports: true } },
      },
    }),
    prisma.report.count(),
  ]);

  return apiResponse({ reports, templates, totalReports });
});
