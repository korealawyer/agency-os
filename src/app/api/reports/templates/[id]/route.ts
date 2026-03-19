import { NextRequest } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/db';
import { apiResponse, requireAuth, requireRole, withErrorHandler, logAudit, safeParseBody, NotFoundError } from '@/lib/api-helpers';

const updateTemplateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().optional(),
  logoUrl: z.string().nullable().optional(),
  kpiConfig: z.record(z.string(), z.unknown()).optional(),
  layoutConfig: z.record(z.string(), z.unknown()).optional(),
  scheduleType: z.enum(['weekly', 'monthly']).optional(),
  recipientEmails: z.array(z.string().email()).optional(),
  naverAccountIds: z.array(z.string().uuid()).optional(),
  isDefault: z.boolean().optional(),
});

export const PATCH = withErrorHandler(async (req: NextRequest, context: any) => {
  const user = await requireAuth(req);
  requireRole(user, 'owner', 'admin', 'editor');

  const { id } = await context.params;
  const body = await safeParseBody(req);
  const data = updateTemplateSchema.parse(body);

  const existing = await prisma.reportTemplate.findFirst({
    where: { id, organizationId: user.organizationId },
  });
  if (!existing) throw new NotFoundError('리포트 템플릿을 찾을 수 없습니다.');

  const updated = await prisma.reportTemplate.update({
    where: { id },
    data: data as any,
  });

  logAudit({
    userId: user.id, organizationId: user.organizationId,
    action: 'UPDATE', entityType: 'ReportTemplate', entityId: id,
    oldValues: { name: existing.name },
    newValues: data,
  });

  return apiResponse(updated);
});

export const DELETE = withErrorHandler(async (req: NextRequest, context: any) => {
  const user = await requireAuth(req);
  requireRole(user, 'owner', 'admin', 'editor');

  const { id } = await context.params;

  const existing = await prisma.reportTemplate.findFirst({
    where: { id, organizationId: user.organizationId },
  });
  if (!existing) throw new NotFoundError('리포트 템플릿을 찾을 수 없습니다.');

  await prisma.reportTemplate.delete({ where: { id } });

  logAudit({
    userId: user.id, organizationId: user.organizationId,
    action: 'DELETE', entityType: 'ReportTemplate', entityId: id,
    oldValues: { name: existing.name },
  });

  return apiResponse({ deleted: true });
});
