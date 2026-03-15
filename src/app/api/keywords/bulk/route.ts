import { NextRequest } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/db';
import { apiResponse, requireAuth, requireRole, withErrorHandler, logAudit, safeParseBody } from '@/lib/api-helpers';
import { invalidateCache } from '@/lib/cache';

const bulkBidSchema = z.object({
  keywordIds: z.array(z.string().uuid()).min(1).max(500),
  newBid: z.number().int().min(70),
  reason: z.string().max(500).default('벌크 변경'),
});

export const POST = withErrorHandler(async (req: NextRequest) => {
  const user = await requireAuth(req);
  requireRole(user, 'owner', 'admin', 'editor');

  const body = await safeParseBody(req);
  const { keywordIds, newBid, reason } = bulkBidSchema.parse(body);

  const result = await prisma.$transaction(async (tx: any) => {
    // 대상 키워드 확인
    const keywords = await tx.keyword.findMany({
      where: {
        id: { in: keywordIds },
        organizationId: user.organizationId,
        deletedAt: null,
      },
      select: { id: true, currentBid: true, version: true },
    });

    if (keywords.length === 0) return { updated: 0, histories: 0 };

    // Raw SQL 단일 UPDATE — N+1 제거
    const batchIds = keywords.map((kw: any) => kw.id);
    await tx.$executeRaw`
      UPDATE keywords
      SET current_bid = ${newBid}, version = version + 1, updated_at = NOW()
      WHERE id = ANY(${batchIds}::uuid[])
        AND organization_id = ${user.organizationId}::uuid AND deleted_at IS NULL
    `;

    // 입찰 이력 일괄 삽입
    await tx.bidHistory.createMany({
      data: keywords.map((kw: any) => ({
        keywordId: kw.id,
        organizationId: user.organizationId,
        oldBid: kw.currentBid,
        newBid,
        reason,
        changedBy: 'manual' as const,
      })),
    });

    return { updated: keywords.length, histories: keywords.length };
  });

  await invalidateCache(`dashboard:${user.organizationId}`);
  logAudit({
    userId: user.id, organizationId: user.organizationId,
    action: 'UPDATE', entityType: 'Keyword',
    newValues: { bulkUpdate: true, count: result.updated, newBid },
  });

  return apiResponse(result);
});
