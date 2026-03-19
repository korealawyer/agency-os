import { NextRequest } from 'next/server';
import { apiResponse, requireAuth, withErrorHandler } from '@/lib/api-helpers';
import { syncStructure } from '@/lib/naver-sync';

// Vercel Pro 최대 300초 타임아웃
export const maxDuration = 300;

/**
 * POST /api/accounts/[id]/sync
 * Phase 1: 캠페인 + 광고그룹 구조 동기화
 * → pendingAdGroupIds를 반환하여 프론트에서 Phase 2 순차 호출
 */
export const POST = withErrorHandler(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireAuth(req);
  const { id: accountId } = await params;

  const result = await syncStructure(accountId, user.organizationId);

  if (result.error) {
    return apiResponse(
      { success: false, error: result.error, partial: result },
      502
    );
  }

  return apiResponse({
    success: true,
    phase: 1,
    synced: {
      campaigns: result.campaigns,
      adGroups: result.adGroups,
    },
    /** 프론트에서 Phase 2 호출에 사용할 광고그룹 ID 목록 */
    pendingAdGroupIds: result.pendingAdGroupIds,
    syncedAt: new Date().toISOString(),
  });
});
