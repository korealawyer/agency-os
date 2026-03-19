import { NextRequest } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/db';
import { apiResponse, paginatedResponse, requireAuth, requireRole, withErrorHandler, logAudit, safeParseBody, parsePagination } from '@/lib/api-helpers';

const createReportSchema = z.object({
  templateId: z.string().uuid().optional(),
  title: z.string().min(1).max(255),
  periodStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  periodEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  sentTo: z.array(z.string().email()).default([]),
});

export const GET = withErrorHandler(async (req: NextRequest) => {
  const user = await requireAuth(req);
  const { page, limit, skip } = parsePagination(req.nextUrl.searchParams);
  const templateId = req.nextUrl.searchParams.get('templateId');

  const where: any = {
    organizationId: user.organizationId,
    ...(templateId && { templateId }),
  };

  const [reports, total] = await Promise.all([
    prisma.report.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
      include: {
        template: { select: { name: true } },
      },
    }),
    prisma.report.count({ where }),
  ]);

  return paginatedResponse(reports, total, page, limit);
});

export const POST = withErrorHandler(async (req: NextRequest) => {
  const user = await requireAuth(req);
  requireRole(user, 'owner', 'admin', 'editor');

  const body = await safeParseBody(req);
  const data = createReportSchema.parse(body);

  const report = await prisma.report.create({
    data: {
      organizationId: user.organizationId,
      templateId: data.templateId,
      title: data.title,
      periodStart: new Date(data.periodStart),
      periodEnd: new Date(data.periodEnd),
      sentTo: data.sentTo,
      sentAt: data.sentTo.length > 0 ? new Date() : null,
    },
  });

  logAudit({
    userId: user.id, organizationId: user.organizationId,
    action: 'CREATE', entityType: 'Report', entityId: report.id,
    newValues: { title: data.title, sentTo: data.sentTo },
  });

  return apiResponse(report, 201);
});
