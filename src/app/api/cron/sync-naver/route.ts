import { NextRequest, NextResponse } from 'next/server';
import { syncAllAccounts } from '@/lib/naver-sync';
import prisma from '@/lib/db';

/**
 * POST /api/cron/sync-naver
 * 전체 조직의 네이버 광고 계정을 일괄 동기화합니다.
 * Vercel Cron Job에서 호출 (매 1시간마다 권장)
 *
 * 보안: CRON_SECRET 헤더 검증
 */
export const POST = async (req: NextRequest) => {
  // Vercel cron 또는 서버 내부 호출 검증
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const startTime = Date.now();

  // 모든 활성 조직 목록 조회
  const organizations = await prisma.organization.findMany({
    where: { isActive: true, deletedAt: null },
    select: { id: true, name: true },
  });

  const allResults = [];
  let totalCampaigns = 0;
  let totalKeywords = 0;
  let totalErrors = 0;

  for (const org of organizations) {
    const results = await syncAllAccounts(org.id);
    for (const r of results) {
      totalCampaigns += r.campaigns;
      totalKeywords += r.keywords;
      if (r.error) totalErrors++;
    }
    allResults.push({ orgId: org.id, orgName: org.name, results });
  }

  const elapsed = Date.now() - startTime;
  console.log(`[cron/sync-naver] elapsed=${elapsed}ms orgs=${organizations.length} campaigns=${totalCampaigns} keywords=${totalKeywords} errors=${totalErrors}`);

  return NextResponse.json({
    success: true,
    elapsed,
    organizations: organizations.length,
    totalCampaigns,
    totalKeywords,
    totalErrors,
  });
};
