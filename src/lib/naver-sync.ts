/**
 * lib/naver-sync.ts
 * 네이버 광고 계정 → DB 동기화 서비스 (서버 최적화 버전)
 *
 * [흐름]
 * syncAccount(accountId) →
 *   1. NaverAccount 조회 + 복호화
 *   2. naverclient.getCampaigns() → upsert Campaign
 *   3. 캠페인별 adGroups 병렬 조회 → upsert AdGroup
 *   4. adGroup별 keywords 병렬 조회 → 배치 upsert Keyword
 *   5. Account.lastSyncAt + connectionStatus 업데이트
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
 * 단일 NaverAccount 동기화 (서버 최적화)
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
    console.log(`[Sync] 캠페인 ${campaigns.length}개 발견`);

    for (const camp of campaigns) {
      // 캠페인 upsert
      const existingCampaign = await prisma.campaign.findFirst({
        where: { naverCampaignId: camp.nccCampaignId, naverAccountId: account.id },
        select: { id: true },
      });

      const campaignData = {
        name: camp.name,
        status: mapCampaignStatus(camp.userLock, camp.status),
        dailyBudget: camp.dailyBudget ?? 0,
        lastSyncAt: new Date(),
        updatedAt: new Date(),
      };

      const campaign = await prisma.campaign.upsert({
        where: { id: existingCampaign?.id ?? 'new' },
        update: campaignData,
        create: {
          naverAccountId: account.id,
          organizationId,
          naverCampaignId: camp.nccCampaignId,
          ...campaignData,
        },
      });
      result.campaigns++;

      // 3. 광고그룹 목록
      let adGroups: any[] = [];
      try {
        adGroups = await client.getAdGroups(camp.nccCampaignId);
        console.log(`[Sync] 캠페인 "${camp.name}" → 광고그룹 ${adGroups.length}개`);
      } catch (e: any) {
        console.warn(`[Sync] 광고그룹 조회 실패 (캠페인: ${camp.name}):`, e.message);
        continue;
      }

      // 광고그룹별 키워드를 병렬로 조회 (3개씩 동시)
      const PARALLEL_LIMIT = 3;
      for (let i = 0; i < adGroups.length; i += PARALLEL_LIMIT) {
        const batch = adGroups.slice(i, i + PARALLEL_LIMIT);
        
        await Promise.all(batch.map(async (ag: any) => {
          // 광고그룹 upsert
          const existingAg = await prisma.adGroup.findFirst({
            where: { naverAdGroupId: ag.nccAdgroupId, campaignId: campaign.id },
            select: { id: true },
          });

          const adGroup = await prisma.adGroup.upsert({
            where: { id: existingAg?.id ?? 'new' },
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

          // 4. 키워드 조회
          let keywords: any[] = [];
          try {
            keywords = await client.getKeywords(ag.nccAdgroupId);
          } catch (e: any) {
            console.warn(`[Sync] 키워드 조회 실패 (${ag.name}):`, e.message);
            return;
          }

          // 키워드 배치 처리 (한 번에 50개씩)
          const KW_BATCH_SIZE = 50;
          for (let j = 0; j < keywords.length; j += KW_BATCH_SIZE) {
            const kwBatch = keywords.slice(j, j + KW_BATCH_SIZE);
            
            await Promise.all(kwBatch.map(async (kw: any) => {
              const existingKw = await prisma.keyword.findFirst({
                where: { naverKeywordId: kw.nccKeywordId, adGroupId: adGroup.id },
                select: { id: true },
              });

              await prisma.keyword.upsert({
                where: { id: existingKw?.id ?? 'new' },
                update: {
                  keywordText: kw.keyword,
                  currentBid: kw.bidAmt ?? 0,
                  lastSyncAt: new Date(),
                  updatedAt: new Date(),
                },
                create: {
                  adGroupId: adGroup.id,
                  organizationId,
                  naverKeywordId: kw.nccKeywordId,
                  keywordText: kw.keyword,
                  currentBid: kw.bidAmt ?? 0,
                  lastSyncAt: new Date(),
                },
              });
              result.keywords++;
            }));
          }

          console.log(`[Sync] 광고그룹 "${ag.name}" → 키워드 ${keywords.length}개 완료`);
        }));
      }
    }

    // 5. Account 상태 업데이트
    await prisma.naverAccount.update({
      where: { id: accountId },
      data: { connectionStatus: 'connected', lastSyncAt: new Date() },
    });

    console.log(`[Sync] 동기화 완료: 캠페인 ${result.campaigns}, 광고그룹 ${result.adGroups}, 키워드 ${result.keywords}`);
  } catch (error: any) {
    console.error(`[Sync] 동기화 에러:`, error.message);
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
