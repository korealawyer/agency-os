import { NextRequest } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/db';
import { apiResponse, paginatedResponse, requireAuth, requireRole, withErrorHandler, logAudit, safeParseBody, parsePagination } from '@/lib/api-helpers';

const createActionSchema = z.object({
  actionType: z.enum(['bid_adjustment', 'keyword_recommendation', 'report_generation', 'anomaly_alert', 'creative_suggestion']),
  entityType: z.string().min(1).max(50),
  entityId: z.string().optional(),
  inputData: z.record(z.string(), z.unknown()).default({}),
  outputData: z.record(z.string(), z.unknown()).default({}),
  confidence: z.number().min(0).max(1).optional(),
});

export const GET = withErrorHandler(async (req: NextRequest) => {
  const user = await requireAuth(req);
  const { page, limit, skip } = parsePagination(req.nextUrl.searchParams);
  const actionType = req.nextUrl.searchParams.get('actionType');
  const isApprovedStr = req.nextUrl.searchParams.get('isApproved');

  const where: any = {
    organizationId: user.organizationId,
    ...(actionType && { actionType }),
    ...(isApprovedStr !== null && { isApproved: isApprovedStr === 'true' }),
  };

  const [actions, total] = await Promise.all([
    prisma.aiActionLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
      include: {
        user: { select: { name: true, email: true } },
      },
    }),
    prisma.aiActionLog.count({ where }),
  ]);

  return paginatedResponse(actions, total, page, limit);
});

export const POST = withErrorHandler(async (req: NextRequest) => {
  const user = await requireAuth(req);
  requireRole(user, 'owner', 'admin', 'editor');

  const body = await safeParseBody(req);
  const data = createActionSchema.parse(body);

  const action = await prisma.aiActionLog.create({
    data: {
      ...(data as any),
      userId: user.id,
      organizationId: user.organizationId,
    },
  });

  logAudit({
    userId: user.id, organizationId: user.organizationId,
    action: 'CREATE', entityType: 'AiActionLog', entityId: action.id,
    newValues: { actionType: data.actionType, entityType: data.entityType },
  });

  return apiResponse(action, 201);
});
