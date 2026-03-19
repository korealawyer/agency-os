import { NextRequest } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/db';
import { apiResponse, requireAuth, requireRole, withErrorHandler, logAudit, NotFoundError, ConflictError, safeParseBody } from '@/lib/api-helpers';
import { invalidateCache } from '@/lib/cache';
import { createNaverAdsClient } from '@/lib/naver-ads-api';

const updateBidSchema = z.object({
  newBid: z.number().int().min(70), // 네이버 최소 입찰가 70원
  reason: z.string().max(500).default('수동 변경'),
});

export const GET = withErrorHandler(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireAuth(req);
  const { id } = await params;

  const keyword = await prisma.keyword.findFirst({
    where: { id, organizationId: user.organizationId, deletedAt: null },
    include: {
      bidHistory: { orderBy: { changedAt: 'desc' }, take: 20 },
      rankSnapshots: { orderBy: { capturedAt: 'desc' }, take: 30 },
      adGroup: { select: { id: true, name: true, campaign: { select: { id: true, name: true } } } },
    },
  });

  if (!keyword) throw new NotFoundError('키워드를 찾을 수 없습니다.');
  return apiResponse(keyword);
});

export const PUT = withErrorHandler(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireAuth(req);
  requireRole(user, 'owner', 'admin', 'editor');
  const { id } = await params;

  const body = await safeParseBody(req);
  const { newBid, reason } = updateBidSchema.parse(body);

  // 키워드 조회 (Naver API 연동용 필드 포함: Keyword→AdGroup→Campaign→NaverAccount)
  const existing = await prisma.keyword.findFirst({
    where: { id, organizationId: user.organizationId, deletedAt: null },
    include: {
      adGroup: {
        include: {
          campaign: {
            include: {
              naverAccount: {
                select: {
                  customerId: true,
                  apiKeyEncrypted: true,
                  secretKeyEncrypted: true,
                },
              },
            },
          },
        },
      },
    },
  });
  if (!existing) throw new NotFoundError('키워드를 찾을 수 없습니다.');

  const result = await prisma.$transaction(async (tx: any) => {
    const updated = await tx.keyword.updateMany({
      where: { id, organizationId: user.organizationId, version: existing.version },
      data: { currentBid: newBid, version: { increment: 1 } },
    });

    if (updated.count === 0) {
      throw new ConflictError('다른 사용자가 이미 수정했습니다. 새로고침 후 다시 시도해주세요.');
    }

    // 입찰 이력 기록
    const bidHistory = await tx.bidHistory.create({
      data: {
        keywordId: id,
        organizationId: user.organizationId,
        oldBid: existing.currentBid,
        newBid,
        reason,
        changedBy: 'manual',
        currentRank: existing.targetRank,
      },
    });

    return bidHistory;
  });

  // ── 네이버 광고 API 실제 반영 ──
  // DB 트랜잭션 완료 후 Naver API 호출. 실패 시 경고 로그만 남기고 계속 진행
  // (API 동기화 지연은 허용, DB가 진실의 원천)
  const naverAccount = existing.adGroup?.campaign?.naverAccount;
  const naverKeywordId = existing.naverKeywordId;
  if (naverAccount?.customerId && naverAccount?.apiKeyEncrypted && naverAccount?.secretKeyEncrypted && naverKeywordId) {
    try {
      // TODO: 운영 환경에서는 apiKeyEncrypted/secretKeyEncrypted를 복호화 후 사용
      const naverClient = createNaverAdsClient(
        naverAccount.customerId,
        naverAccount.apiKeyEncrypted,   // 암호화된 키 (복호화 필요 시 decrypt() 호출)
        naverAccount.secretKeyEncrypted,
      );
      await naverClient.updateBid(naverKeywordId, newBid);
      console.log(`[NaverAPI] 입찰가 반영 완료: keyword=${id}, naverKeywordId=${naverKeywordId}, bid=${newBid}`);
    } catch (naverError: any) {
      // API 실패는 치명적 에러가 아님 — 경고만 남기고 성공 응답
      console.warn(`[NaverAPI] 입찰가 반영 실패 (DB는 업데이트됨): ${naverError.message}`);
    }
  }

  await invalidateCache(`dashboard:${user.organizationId}`);
  logAudit({
    userId: user.id, organizationId: user.organizationId,
    action: 'UPDATE', entityType: 'Keyword', entityId: id,
    oldValues: { currentBid: existing.currentBid },
    newValues: { currentBid: newBid, reason },
  });

  return apiResponse({ keyword: { ...existing, currentBid: newBid }, bidHistory: result });
});

export const DELETE = withErrorHandler(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireAuth(req);
  requireRole(user, 'owner', 'admin', 'editor');
  const { id } = await params;

  const existing = await prisma.keyword.findFirst({
    where: { id, organizationId: user.organizationId, deletedAt: null },
  });
  if (!existing) throw new NotFoundError('키워드를 찾을 수 없습니다.');

  await prisma.keyword.update({
    where: { id, organizationId: user.organizationId },
    data: { deletedAt: new Date() },
  });

  await invalidateCache(`dashboard:${user.organizationId}`);
  logAudit({
    userId: user.id, organizationId: user.organizationId,
    action: 'DELETE', entityType: 'Keyword', entityId: id,
  });

  return apiResponse({ success: true });
});
