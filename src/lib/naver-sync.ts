/**
 * lib/naver-sync.ts
 * 네이버 광고 계정 → DB 동기화 서비스 (광고그룹 단위 단계별 동기화)
 *
 * [흐름]
 * Phase 1: syncStructure(accountId)
 *   → 캠페인 전체 + 광고그룹 전체 동기화 (~10초)
 *   → 미동기화 광고그룹 ID 목록 반환
 *
 * Phase 2: syncAdGroupDetails(accountId, adGroupId)
 *   → 특정 광고그룹의 소재 + 키워드 동기화 (~10-20초)
 *   → 프론트에서 광고그룹별로 순차 호출
 */

import prisma from '@/lib/db';
import { decrypt } from '@/lib/encryption';
import { createNaverAdsClient } from '@/lib/naver-ads-api';

// ── 결과 타입 ──

export interface StructureSyncResult {
  accountId: string;
  customerId: string;
  campaigns: number;
  adGroups: number;
  /** Phase 2에서 처리할 광고그룹 ID 목록 */
  pendingAdGroupIds: string[];
  error?: string;
}

export interface AdGroupSyncResult {
  adGroupId: string;
  adGroupName: string;
  ads: number;
  keywords: number;
  error?: string;
}

export interface SyncResult {
  accountId: string;
  customerId: string;
  campaigns: number;
  adGroups: number;
  keywords: number;
  ads: number;
  notifications: number;
  error?: string;
}

// ── 내부 헬퍼: 계정 → 클라이언트 생성 ──

async function getAccountClient(accountId: string, organizationId: string) {
  const account = await prisma.naverAccount.findFirst({
    where: { id: accountId, organizationId, deletedAt: null },
  });
  if (!account) throw new Error(`Account not found: ${accountId}`);

  const apiKey = decrypt(account.apiKeyEncrypted);
  const secretKey = decrypt(account.secretKeyEncrypted);
  const client = createNaverAdsClient(account.customerId, apiKey, secretKey);

  return { account, client };
}

// ════════════════════════════════════════════════════════════════
// Phase 1: 캠페인 + 광고그룹 동기화 (빠름, ~10초)
// ════════════════════════════════════════════════════════════════

export async function syncStructure(
  accountId: string,
  organizationId: string
): Promise<StructureSyncResult> {
  const result: StructureSyncResult = {
    accountId,
    customerId: '',
    campaigns: 0,
    adGroups: 0,
    pendingAdGroupIds: [],
  };

  const { account, client } = await getAccountClient(accountId, organizationId);
  result.customerId = account.customerId;

  try {
    // 1. 캠페인 조회
    const campaigns = await client.getCampaigns();
    console.log(`[Sync Phase1] 캠페인 ${campaigns.length}개 발견`);

    // ★ API 연결 성공 → 즉시 connected 상태 업데이트
    await prisma.naverAccount.update({
      where: { id: accountId },
      data: { connectionStatus: 'connected', lastSyncAt: new Date() },
    });

    // 2. 캠페인 + 광고그룹 upsert
    for (const camp of campaigns) {
      const existingCampaign = await prisma.campaign.findFirst({
        where: { naverCampaignId: camp.nccCampaignId, naverAccountId: account.id },
        select: { id: true },
      });

      const campaign = await prisma.campaign.upsert({
        where: { id: existingCampaign?.id ?? 'new' },
        update: {
          name: camp.name,
          status: mapCampaignStatus(camp.userLock, camp.status),
          dailyBudget: camp.dailyBudget ?? 0,
          lastSyncAt: new Date(),
          updatedAt: new Date(),
        },
        create: {
          naverAccountId: account.id,
          organizationId,
          naverCampaignId: camp.nccCampaignId,
          name: camp.name,
          status: mapCampaignStatus(camp.userLock, camp.status),
          dailyBudget: camp.dailyBudget ?? 0,
          lastSyncAt: new Date(),
        },
      });
      result.campaigns++;

      // 3. 광고그룹 조회
      let adGroups: any[] = [];
      try {
        adGroups = await client.getAdGroups(camp.nccCampaignId);
      } catch (e: any) {
        console.warn(`[Sync Phase1] 광고그룹 조회 실패 (${camp.name}):`, e.message);
        continue;
      }

      for (const ag of adGroups) {
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

        // 이 광고그룹의 DB ID를 Phase 2 처리 목록에 추가
        result.pendingAdGroupIds.push(adGroup.id);
      }
    }

    console.log(`[Sync Phase1] 완료: 캠페인 ${result.campaigns}, 광고그룹 ${result.adGroups}`);
  } catch (error: any) {
    console.error(`[Sync Phase1] 에러:`, error.message);
    await prisma.naverAccount.update({
      where: { id: accountId },
      data: { connectionStatus: 'error' },
    }).catch(() => {});
    result.error = error.message;
  }

  return result;
}

// ════════════════════════════════════════════════════════════════
// Phase 2: 특정 광고그룹의 소재 + 키워드 동기화 (~10-20초)
// ════════════════════════════════════════════════════════════════

export async function syncAdGroupDetails(
  accountId: string,
  organizationId: string,
  adGroupDbId: string
): Promise<AdGroupSyncResult> {
  const result: AdGroupSyncResult = { adGroupId: adGroupDbId, adGroupName: '', ads: 0, keywords: 0 };

  // 1. 광고그룹 DB 레코드 조회
  const adGroup = await prisma.adGroup.findFirst({
    where: { id: adGroupDbId, organizationId },
    select: { id: true, name: true, naverAdGroupId: true },
  });
  if (!adGroup) throw new Error(`AdGroup not found: ${adGroupDbId}`);

  result.adGroupName = adGroup.name;

  const { client } = await getAccountClient(accountId, organizationId);

  try {
    // 2. 소재(Ad) 동기화
    let naverAds: any[] = [];
    try {
      naverAds = await client.getAds(adGroup.naverAdGroupId);
    } catch (e: any) {
      console.warn(`[Sync Phase2] 소재 조회 실패 (${adGroup.name}):`, e.message);
    }

    for (const ad of naverAds) {
      const existingAd = await prisma.ad.findFirst({
        where: { naverAdId: ad.nccAdId, adGroupId: adGroup.id },
        select: { id: true },
      });

      await prisma.ad.upsert({
        where: { id: existingAd?.id ?? 'new' },
        update: {
          title: ad.subject ?? ad.headline ?? null,
          description: ad.description ?? null,
          displayUrl: ad.displayUrl ?? null,
          landingUrl: ad.pc?.final ?? ad.mobile?.final ?? ad.pcLandingUrl ?? null,
          isActive: !ad.userLock,
          updatedAt: new Date(),
        },
        create: {
          adGroupId: adGroup.id,
          organizationId,
          naverAdId: ad.nccAdId,
          title: ad.subject ?? ad.headline ?? null,
          description: ad.description ?? null,
          displayUrl: ad.displayUrl ?? null,
          landingUrl: ad.pc?.final ?? ad.mobile?.final ?? ad.pcLandingUrl ?? null,
          isActive: !ad.userLock,
        },
      });
      result.ads++;
    }

    // 3. 키워드 동기화 (배치 처리)
    let keywords: any[] = [];
    try {
      keywords = await client.getKeywords(adGroup.naverAdGroupId);
    } catch (e: any) {
      console.warn(`[Sync Phase2] 키워드 조회 실패 (${adGroup.name}):`, e.message);
    }

    const BATCH = 10;
    for (let i = 0; i < keywords.length; i += BATCH) {
      const batch = keywords.slice(i, i + BATCH);
      await Promise.all(batch.map(async (kw: any) => {
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

    console.log(`[Sync Phase2] "${adGroup.name}" 완료: 소재 ${result.ads}, 키워드 ${result.keywords}`);
  } catch (error: any) {
    console.error(`[Sync Phase2] 에러 (${adGroup.name}):`, error.message);
    result.error = error.message;
  }

  return result;
}

// ════════════════════════════════════════════════════════════════
// 하위 호환: 기존 syncAccount (단일 호출) — cron 등에서 사용
// ════════════════════════════════════════════════════════════════

export async function syncAccount(accountId: string, organizationId: string): Promise<SyncResult> {
  const result: SyncResult = { accountId, customerId: '', campaigns: 0, adGroups: 0, keywords: 0, ads: 0, notifications: 0 };

  // Phase 1
  const phase1 = await syncStructure(accountId, organizationId);
  result.customerId = phase1.customerId;
  result.campaigns = phase1.campaigns;
  result.adGroups = phase1.adGroups;
  if (phase1.error) {
    result.error = phase1.error;
    return result;
  }

  // Phase 2 — 가능한 만큼 (타임아웃 내)
  const startTime = Date.now();
  const TIMEOUT = 45_000; // 45초
  for (const agId of phase1.pendingAdGroupIds) {
    if (Date.now() - startTime > TIMEOUT) {
      console.warn(`[Sync] 타임아웃 임박 — 키워드/소재 부분만 동기화됨`);
      break;
    }
    const phase2 = await syncAdGroupDetails(accountId, organizationId, agId);
    result.ads += phase2.ads;
    result.keywords += phase2.keywords;
  }

  // 최종 lastSyncAt 갱신
  await prisma.naverAccount.update({
    where: { id: accountId },
    data: { lastSyncAt: new Date() },
  }).catch(() => {});

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
    r.status === 'fulfilled' ? r.value : { accountId: '', customerId: '', campaigns: 0, adGroups: 0, keywords: 0, ads: 0, notifications: 0, error: (r as PromiseRejectedResult).reason?.message }
  );
}

// ── 내부 유틸 ──
function mapCampaignStatus(userLock: boolean, status: string): 'active' | 'paused' | 'ended' | 'draft' {
  if (userLock) return 'paused';
  if (status === 'BUSINESS_IN_PROGRESS') return 'active';
  if (status === 'ENDED') return 'ended';
  return 'active';
}
