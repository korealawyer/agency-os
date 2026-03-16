import { NextRequest } from 'next/server';
import { apiResponse, requireAuth, withErrorHandler } from '@/lib/api-helpers';
import { syncAccount } from '@/lib/naver-sync';

/**
 * POST /api/accounts/[id]/sync
 * 특정 네이버 계정의 캠페인/광고그룹/키워드/통계를 즉시 동기화합니다.
 */
export const POST = withErrorHandler(async (req: NextRequest, { params }: { params: { id: string } }) => {
  const user = await requireAuth(req);
  const { id: accountId } = params;

  const result = await syncAccount(accountId, user.organizationId);

  if (result.error) {
    return apiResponse(
      { success: false, error: result.error, partial: result },
      502
    );
  }

  return apiResponse({
    success: true,
    synced: {
      campaigns: result.campaigns,
      adGroups: result.adGroups,
      keywords: result.keywords,
      notifications: result.notifications,
    },
    syncedAt: new Date().toISOString(),
  });
});
