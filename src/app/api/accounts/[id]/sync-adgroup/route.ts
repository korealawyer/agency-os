import { NextRequest } from 'next/server';
import { apiResponse, requireAuth, withErrorHandler, safeParseBody } from '@/lib/api-helpers';
import { syncAdGroupDetails } from '@/lib/naver-sync';

// Vercel Pro 최대 300초 타임아웃
export const maxDuration = 300;

/**
 * POST /api/accounts/[id]/sync-adgroup
 * Phase 2: 특정 광고그룹의 소재 + 키워드 동기화
 *
 * Body: { adGroupId: string }
 */
export const POST = withErrorHandler(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireAuth(req);
  const { id: accountId } = await params;
  const body: any = await safeParseBody(req);
  const adGroupId = body?.adGroupId;

  if (!adGroupId) {
    return apiResponse({ success: false, error: 'adGroupId is required' }, 400);
  }

  const result = await syncAdGroupDetails(accountId, user.organizationId, adGroupId);

  if (result.error) {
    return apiResponse(
      { success: false, error: result.error, partial: result },
      502
    );
  }

  return apiResponse({
    success: true,
    phase: 2,
    synced: {
      adGroupId: result.adGroupId,
      adGroupName: result.adGroupName,
      ads: result.ads,
      keywords: result.keywords,
    },
  });
});
