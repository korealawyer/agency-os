import { NextRequest } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/db';
import { apiResponse, paginatedResponse, requireAuth, requireRole, withErrorHandler, logAudit, safeParseBody, NotFoundError, parsePagination } from '@/lib/api-helpers';

const createSubscriptionSchema = z.object({
  planType: z.enum(['personal', 'starter', 'growth', 'scale', 'enterprise']),
  monthlyPrice: z.number().int().min(0),
  paymentProvider: z.string().optional(),
});

export const GET = withErrorHandler(async (req: NextRequest) => {
  const user = await requireAuth(req);
  requireRole(user, 'owner', 'admin');

  const { page, limit, skip } = parsePagination(req.nextUrl.searchParams);
  const status = req.nextUrl.searchParams.get('status');

  const where: any = {
    organizationId: user.organizationId,
    ...(status && { status }),
  };

  const [subscriptions, total] = await Promise.all([
    prisma.subscription.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
      select: {
        id: true,
        planType: true,
        status: true,
        monthlyPrice: true,
        currentPeriodStart: true,
        currentPeriodEnd: true,
        paymentProvider: true,
        canceledAt: true,
        createdAt: true,
      },
    }),
    prisma.subscription.count({ where }),
  ]);

  return paginatedResponse(subscriptions, total, page, limit);
});

export const POST = withErrorHandler(async (req: NextRequest) => {
  const user = await requireAuth(req);
  requireRole(user, 'owner'); // Only owners can create/change subscriptions

  const body = await safeParseBody(req);
  const data = createSubscriptionSchema.parse(body);

  // Set subscription period to 1 month from now
  const now = new Date();
  const nextMonth = new Date();
  nextMonth.setMonth(now.getMonth() + 1);

  // Check if there is an existing active subscription and cancel it
  const existingSubs = await prisma.subscription.findMany({
    where: { organizationId: user.organizationId, status: { in: ['active', 'trialing'] } }
  });

  for (const sub of existingSubs) {
    await prisma.subscription.update({
      where: { id: sub.id },
      data: { status: 'canceled', canceledAt: now }
    });
  }

  const subscription = await prisma.subscription.create({
    data: {
      organizationId: user.organizationId,
      planType: data.planType,
      monthlyPrice: data.monthlyPrice,
      paymentProvider: data.paymentProvider || 'stripe',
      status: 'active',
      currentPeriodStart: now,
      currentPeriodEnd: nextMonth,
    },
  });

  // Update organization plan
  await prisma.organization.update({
    where: { id: user.organizationId },
    data: { planType: data.planType }
  });

  logAudit({
    userId: user.id, organizationId: user.organizationId,
    action: 'CREATE', entityType: 'Subscription', entityId: subscription.id,
    newValues: { planType: data.planType, monthlyPrice: data.monthlyPrice },
  });

  return apiResponse(subscription, 201);
});
