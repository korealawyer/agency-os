import { NextRequest } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/db';
import { apiResponse, paginatedResponse, requireAuth, requireRole, withErrorHandler, logAudit, safeParseBody, parsePagination } from '@/lib/api-helpers';

const createTemplateSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().optional(),
  logoUrl: z.string().optional(),
  kpiConfig: z.record(z.string(), z.unknown()).default({}),
  layoutConfig: z.record(z.string(), z.unknown()).default({}),
  scheduleType: z.enum(['weekly', 'monthly']).default('weekly'),
  recipientEmails: z.array(z.string().email()).default([]),
  naverAccountIds: z.array(z.string().uuid()).default([]),
  isDefault: z.boolean().default(false),
});

export const GET = withErrorHandler(async (req: NextRequest) => {
  const user = await requireAuth(req);
  const { page, limit, skip } = parsePagination(req.nextUrl.searchParams);

  const where = { organizationId: user.organizationId };

  const [templates, total] = await Promise.all([
    prisma.reportTemplate.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
      include: {
        _count: { select: { reports: true } },
      },
    }),
    prisma.reportTemplate.count({ where }),
  ]);

  return paginatedResponse(templates, total, page, limit);
});

export const POST = withErrorHandler(async (req: NextRequest) => {
  const user = await requireAuth(req);
  requireRole(user, 'owner', 'admin', 'editor');

  const body = await safeParseBody(req);
  const data = createTemplateSchema.parse(body);

  const template = await prisma.reportTemplate.create({
    data: {
      organizationId: user.organizationId,
      name: data.name,
      description: data.description,
      logoUrl: data.logoUrl,
      kpiConfig: data.kpiConfig as any,
      layoutConfig: data.layoutConfig as any,
      scheduleType: data.scheduleType,
      recipientEmails: data.recipientEmails,
      naverAccountIds: data.naverAccountIds,
      isDefault: data.isDefault,
    },
  });

  logAudit({
    userId: user.id, organizationId: user.organizationId,
    action: 'CREATE', entityType: 'ReportTemplate', entityId: template.id,
    newValues: { name: data.name, scheduleType: data.scheduleType },
  });

  return apiResponse(template, 201);
});
