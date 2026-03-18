/**
 * lib/naver-sync.ts
 * 네이버 광고 계정 → DB 동기화 서비스
 *
 * [흐름]
 * syncAccount(accountId) →
 *   1. NaverAccount 조회 + 복호화
 *   2. naverclient.getCampaigns() → upsert Campaign
 *   3. 각 캠페인 adGroups → upsert AdGroup
 *   4. 각 adGroup keywords + stats → upsert Keyword
 *   5. Account.lastSyncAt + connectionStatus 업데이트
 *   6. 이상 탐지 → Notification 생성
 */

import prisma from '@/lib/db';
import { decrypt } from '@/lib/encryption';
import { createNaverAdsClient } from '@/lib/naver-ads-api';

// 날짜 포맷 (YYYY-MM-DD)
function toDateStr(date: Date): string {
  return date.toISOString().slice(0, 10);
}

// 오늘/어제 범위
function getStatRange() {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - 1);
  return { start: toDateStr(start), end: toDateStr(end) };
}

export interface SyncResult {
  accountId: string;
  customerId: string;
  campaigns: number;
  adGroups: number;
  keywords: number;
  notifications: number;
  error?: string;
}

/**
 * 단일 NaverAccount 동기화
 */
export async function syncAccount(accountId: string, organizationId: string): Promise<SyncResult> {
  const result: SyncResult = { accountId, customerId: '', campaigns: 0, adGroups: 0, keywords: 0, notifications: 0 };

  // 1. 계정 조회 + 키 복호화
  const account = await prisma.naverAccount.findFirst({
    where: { id: accountId, organizationId, deletedAt: null },
  });
  if (!account) throw new Error(`Account not found: ${accountId}`);

  result.customerId = account.customerId;

  const apiKey = decrypt(account.apiKeyEncrypted);
  const secretKey = decrypt(account.secretKeyEncrypted);
  const client = createNaverAdsClient(account.customerId, apiKey, secretKey);

  try {
    // 2. 캠페인 목록
    const campaigns = await client.getCampaigns();

    for (const camp of campaigns) {
      const campaign = await prisma.campaign.upsert({
        where: {
          // naverCampaignId + naverAccountId 는 중복 체크
          id: (await prisma.campaign.findFirst({
            where: { naverCampaignId: camp.nccCampaignId, naverAccountId: account.id },
            select: { id: true },
          }))?.id ?? 'new',
        },
        update: {
          name: camp.name,
          status: mapCampaignStatus(camp.userLock, camp.status),
          dailyBudget: camp.dailyBudget,
          lastSyncAt: new Date(),
          updatedAt: new Date(),
        },
        create: {
          naverAccountId: account.id,
          organizationId,
          naverCampaignId: camp.nccCampaignId,
          name: camp.name,
          status: mapCampaignStatus(camp.userLock, camp.status),
          dailyBudget: camp.dailyBudget,
          lastSyncAt: new Date(),
        },
      });
      result.campaigns++;

      // 3. 광고그룹 목록
      let adGroups: any[] = [];
      try { adGroups = await client.getAdGroups(camp.nccCampaignId); } catch (e: any) {
        console.warn(`[Sync] 광고그룹 조회 실패 (캠페인: ${camp.name}, ID: ${camp.nccCampaignId}):`, e.message);
        continue;
      }

      for (const ag of adGroups) {
        const adGroup = await prisma.adGroup.upsert({
          where: {
            id: (await prisma.adGroup.findFirst({
              where: { naverAdGroupId: ag.nccAdgroupId, campaignId: campaign.id },
              select: { id: true },
            }))?.id ?? 'new',
          },
          update: {
            name: ag.name,
            isActive: !ag.userLock,
            updatedAt: new Date(),
          },
          create: {
            campaignId: campaign.id,
            organizationId,
            naverAdGroupId: ag.nccAdgroupId,
            name: ag.name,
            isActive: !ag.userLock,
          },
        });
        result.adGroups++;

        // 4. 키워드 목록 + 통계
        let keywords: any[] = [];
        try { keywords = await client.getKeywords(ag.nccAdgroupId); } catch (e: any) {
          console.warn(`[Sync] 키워드 조회 실패 (광고그룹: ${ag.name}, ID: ${ag.nccAdgroupId}):`, e.message);
          continue;
        }

        // 통계 배치 조회 (id 리스트)
        const kwIds = keywords.map((k: any) => k.nccKeywordId).filter(Boolean);
        const { start, end } = getStatRange();
        let statsMap: Record<string, any> = {};
        if (kwIds.length > 0) {
          try {
            const statsList = await client.getKeywordStats(kwIds, start, end);
            for (const s of statsList) {
              if (s.id) statsMap[s.id] = s;
            }
          } catch (e: any) {
            console.warn(`[Sync] 키워드 통계 조회 실패:`, e.message);
          }
        }

        for (const kw of keywords) {
          const stat = statsMap[kw.nccKeywordId] ?? {};
          const clicks = stat.clkCnt ?? 0;
          const impressions = stat.impCnt ?? 0;
          const ctr = impressions > 0 ? clicks / impressions : 0;
          const conversions = stat.ccnt ?? 0;
          const cost = stat.salesAmt ?? 0;
          const convValue = stat.convAmt ?? 0;
          const roas = cost > 0 ? (convValue / cost) * 100 : null;

          await prisma.keyword.upsert({
            where: {
              id: (await prisma.keyword.findFirst({
                where: { naverKeywordId: kw.nccKeywordId, adGroupId: adGroup.id },
                select: { id: true },
              }))?.id ?? 'new',
            },
            update: {
              keywordText: kw.keyword,
              currentBid: kw.bidAmt ?? 0,
              clicks,
              impressions,
              ctr,
              conversions,
              cost,
              conversionValue: convValue,
              roas,
              lastSyncAt: new Date(),
              updatedAt: new Date(),
            },
            create: {
              adGroupId: adGroup.id,
              organizationId,
              naverKeywordId: kw.nccKeywordId,
              keywordText: kw.keyword,
              currentBid: kw.bidAmt ?? 0,
              clicks,
              impressions,
              ctr,
              conversions,
              cost,
              conversionValue: convValue,
              roas,
              lastSyncAt: new Date(),
            },
          });
          result.keywords++;

          // 5. CTR 이상 탐지 → Notification
          const prevCtr = kw.prevCtr ?? null;
          if (prevCtr != null && ctr < prevCtr * 0.5 && impressions > 100) {
            const user = await prisma.user.findFirst({
              where: { organizationId, role: { in: ['owner', 'admin'] }, isActive: true },
              select: { id: true },
            });
            if (user) {
              await prisma.notification.create({
                data: {
                  userId: user.id,
                  organizationId,
                  type: 'anomaly_detected',
                  priority: 'high',
                  title: `${kw.keyword} CTR 급락 탐지`,
                  message: `CTR이 ${(prevCtr * 100).toFixed(1)}% → ${(ctr * 100).toFixed(1)}%로 50% 이상 하락했습니다.`,
                  metadata: {
                    keywordId: (await prisma.keyword.findFirst({
                      where: { naverKeywordId: kw.nccKeywordId },
                      select: { id: true },
                    }))?.id,
                    accountId: account.id,
                    prevCtr, ctr,
                  },
                },
              });
              result.notifications++;
            }
          }
        }
      }
    }

    // 6. Account 상태 업데이트
    await prisma.naverAccount.update({
      where: { id: accountId },
      data: { connectionStatus: 'connected', lastSyncAt: new Date() },
    });
  } catch (error: any) {
    // 연결 실패 시 상태 error
    await prisma.naverAccount.update({
      where: { id: accountId },
      data: { connectionStatus: 'error' },
    }).catch(() => {});
    result.error = error.message;
  }

  return result;
}

/**
 * 조직 전체 계정 동기화
 */
export async function syncAllAccounts(organizationId: string): Promise<SyncResult[]> {
  const accounts = await prisma.naverAccount.findMany({
    where: { organizationId, deletedAt: null, isActive: true },
    select: { id: true },
  });

  const results = await Promise.allSettled(
    accounts.map((acc) => syncAccount(acc.id, organizationId))
  );

  return results.map((r: PromiseSettledResult<SyncResult>) =>
    r.status === 'fulfilled' ? r.value : { accountId: '', customerId: '', campaigns: 0, adGroups: 0, keywords: 0, notifications: 0, error: (r as PromiseRejectedResult).reason?.message }
  );
}

// ── 내부 유틸 ──
function mapCampaignStatus(userLock: boolean, status: string): 'active' | 'paused' | 'ended' | 'draft' {
  if (userLock) return 'paused';
  if (status === 'BUSINESS_IN_PROGRESS') return 'active';
  if (status === 'ENDED') return 'ended';
  return 'active';
}
