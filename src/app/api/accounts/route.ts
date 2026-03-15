import { NextRequest } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/db';
import { apiResponse, paginatedResponse, requireAuth, requireRole, withErrorHandler, logAudit, safeParseBody, NotFoundError } from '@/lib/api-helpers';
import { parsePagination } from '@/lib/api-helpers';
import { encrypt } from '@/lib/encryption';
import { invalidateCache } from '@/lib/cache';

const createAccountSchema = z.object({
  customerId: z.string().min(1),
  customerName: z.string().min(1).max(200),
  apiKey: z.string().min(1),
  secretKey: z.string().min(1),
  dailyBudget: z.number().int().positive().optional(),
  commissionRate: z.number().min(0).max(1).optional(),
});

export const GET = withErrorHandler(async (req: NextRequest) => {
  const user = await requireAuth(req);
  const { page, limit, skip } = parsePagination(req.nextUrl.searchParams);

  const [accounts, total] = await Promise.all([
    prisma.naverAccount.findMany({
      where: { organizationId: user.organizationId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
      select: {
        id: true, customerId: true, customerName: true,
        connectionStatus: true, lastSyncAt: true, dailyBudget: true,
        monthlySpend: true, commissionRate: true, isActive: true,
        createdAt: true, updatedAt: true,
      },
    }),
    prisma.naverAccount.count({
      where: { organizationId: user.organizationId, deletedAt: null },
    }),
  ]);

  return paginatedResponse(accounts, total, page, limit);
});

export const POST = withErrorHandler(async (req: NextRequest) => {
  const user = await requireAuth(req);
  requireRole(user, 'owner', 'admin');

  const body = await safeParseBody<z.infer<typeof createAccountSchema>>(req);
  const data = createAccountSchema.parse(body);

  const account = await prisma.naverAccount.create({
    data: {
      organizationId: user.organizationId,
      customerId: data.customerId,
      customerName: data.customerName,
      apiKeyEncrypted: encrypt(data.apiKey),
      secretKeyEncrypted: encrypt(data.secretKey),
      dailyBudget: data.dailyBudget,
      commissionRate: data.commissionRate,
      connectionStatus: 'pending',
    },
  });

  await invalidateCache(`dashboard:${user.organizationId}`);
  logAudit({
    userId: user.id, organizationId: user.organizationId,
    action: 'CREATE', entityType: 'NaverAccount', entityId: account.id,
  });

  return apiResponse(account, 201);
});
