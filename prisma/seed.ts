import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 시드 데이터 생성 시작...\n');

  // 1. 조직 생성
  const org = await prisma.organization.create({
    data: {
      name: '안티그래비티 마케팅',
      planType: 'growth',
      businessNumber: '123-45-67890',
      contactEmail: 'admin@antigravity.kr',
      maxAccounts: 10,
    },
  });
  console.log(`✅ 조직 생성: ${org.name} (${org.id})`);

  // 2. 사용자 생성
  const passwordHash = await bcrypt.hash('password123', 12);

  const owner = await prisma.user.create({
    data: {
      email: 'admin@agency.com',
      passwordHash,
      name: '김대행',
      role: 'owner',
      organizationId: org.id,
    },
  });
  console.log(`✅ Owner 생성: ${owner.email}`);

  const admin = await prisma.user.create({
    data: {
      email: 'lee@agency.com',
      passwordHash,
      name: '이마케터',
      role: 'admin',
      organizationId: org.id,
    },
  });
  console.log(`✅ Admin 생성: ${admin.email}`);

  const editor = await prisma.user.create({
    data: {
      email: 'park@agency.com',
      passwordHash,
      name: '박에디터',
      role: 'editor',
      organizationId: org.id,
    },
  });
  console.log(`✅ Editor 생성: ${editor.email}`);

  // 3. 구독 생성
  const now = new Date();
  const trialEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  await prisma.subscription.create({
    data: {
      organizationId: org.id,
      planType: 'growth',
      status: 'active',
      monthlyPrice: 99000,
      currentPeriodStart: now,
      currentPeriodEnd: trialEnd,
    },
  });
  console.log('✅ 구독 생성: Growth 플랜');

  // 4. 네이버 광고 계정 (encrypted 값은 더미)
  const account1 = await prisma.naverAccount.create({
    data: {
      organizationId: org.id,
      customerId: 'naver-123456',
      customerName: '안티그래비티 공식몰',
      apiKeyEncrypted: 'dummy-encrypted-api-key',
      secretKeyEncrypted: 'dummy-encrypted-secret-key',
      connectionStatus: 'connected',
      dailyBudget: 500000,
      monthlySpend: 8500000,
      commissionRate: 0.15,
      lastSyncAt: now,
    },
  });
  console.log(`✅ 네이버 계정 생성: ${account1.customerName}`);

  const account2 = await prisma.naverAccount.create({
    data: {
      organizationId: org.id,
      customerId: 'naver-789012',
      customerName: '클라이언트A 쇼핑몰',
      apiKeyEncrypted: 'dummy-encrypted-api-key-2',
      secretKeyEncrypted: 'dummy-encrypted-secret-key-2',
      connectionStatus: 'connected',
      dailyBudget: 300000,
      monthlySpend: 4200000,
      commissionRate: 0.12,
      lastSyncAt: now,
    },
  });
  console.log(`✅ 네이버 계정 생성: ${account2.customerName}`);

  // 5. 캠페인
  const campaign1 = await prisma.campaign.create({
    data: {
      naverAccountId: account1.id,
      organizationId: org.id,
      naverCampaignId: 'camp-001',
      name: '브랜드 검색광고',
      status: 'active',
      campaignType: 'BRAND_SEARCH',
      dailyBudget: 200000,
      totalCost: 3500000,
      impressions: 125000,
      clicks: 8500,
      conversions: 320,
    },
  });

  const campaign2 = await prisma.campaign.create({
    data: {
      naverAccountId: account1.id,
      organizationId: org.id,
      naverCampaignId: 'camp-002',
      name: '쇼핑 검색광고',
      status: 'active',
      campaignType: 'SHOPPING',
      dailyBudget: 150000,
      totalCost: 2100000,
      impressions: 95000,
      clicks: 6200,
      conversions: 180,
    },
  });
  console.log('✅ 캠페인 2개 생성');

  // 6. 광고그룹
  const adGroup1 = await prisma.adGroup.create({
    data: {
      campaignId: campaign1.id,
      organizationId: org.id,
      naverAdGroupId: 'ag-001',
      name: '핵심 키워드 그룹',
      dailyBudget: 100000,
    },
  });

  const adGroup2 = await prisma.adGroup.create({
    data: {
      campaignId: campaign2.id,
      organizationId: org.id,
      naverAdGroupId: 'ag-002',
      name: '쇼핑 키워드 그룹',
      dailyBudget: 80000,
    },
  });
  console.log('✅ 광고그룹 2개 생성');

  // 7. 키워드
  const keywordData = [
    { text: '마케팅 대행', bid: 5200, rank: 3, qi: 8, imp: 45000, click: 3200, conv: 120 },
    { text: '네이버 광고 대행사', bid: 8500, rank: 1, qi: 9, imp: 32000, click: 2800, conv: 95 },
    { text: '검색광고 최적화', bid: 3800, rank: 5, qi: 7, imp: 18000, click: 1200, conv: 45 },
    { text: 'SEO 대행', bid: 4500, rank: 2, qi: 8, imp: 28000, click: 2100, conv: 78 },
    { text: '퍼포먼스 마케팅', bid: 6200, rank: 4, qi: 7, imp: 22000, click: 1800, conv: 62 },
  ];

  for (const kw of keywordData) {
    const keyword = await prisma.keyword.create({
      data: {
        adGroupId: adGroup1.id,
        organizationId: org.id,
        naverKeywordId: `kw-${kw.text.slice(0, 5)}`,
        keywordText: kw.text,
        currentBid: kw.bid,
        targetRank: kw.rank,
        bidStrategy: 'target_rank',
        qualityIndex: kw.qi,
        impressions: kw.imp,
        clicks: kw.click,
        cpc: Math.round(kw.bid * 0.8),
        ctr: kw.click / kw.imp,
        conversions: kw.conv,
        cost: kw.click * Math.round(kw.bid * 0.8),
      },
    });

    // 입찰 이력 샘플
    await prisma.bidHistory.create({
      data: {
        keywordId: keyword.id,
        organizationId: org.id,
        oldBid: Math.round(kw.bid * 0.9),
        newBid: kw.bid,
        reason: 'AI 자동 최적화',
        changedBy: 'ai',
        currentRank: kw.rank,
        targetRank: kw.rank,
      },
    });
  }
  console.log(`✅ 키워드 ${keywordData.length}개 + 입찰이력 생성`);

  // 8. 알림 샘플
  const notifications = [
    { type: 'bid_change' as const, priority: 'normal' as const, title: '입찰가 자동 조정', message: '"마케팅 대행" 키워드 입찰가가 4,800원 → 5,200원으로 조정되었습니다.' },
    { type: 'budget_alert' as const, priority: 'high' as const, title: '일 예산 80% 소진', message: '브랜드 검색광고 캠페인의 일 예산이 80%를 초과했습니다.' },
    { type: 'anomaly_detected' as const, priority: 'urgent' as const, title: '이상 클릭 감지', message: '최근 1시간 동안 비정상적인 클릭 패턴이 감지되었습니다. 확인이 필요합니다.' },
    { type: 'report_sent' as const, priority: 'low' as const, title: '주간 보고서 발송', message: '3월 1주차 주간 보고서가 client@company.com으로 발송되었습니다.' },
    { type: 'system_notice' as const, priority: 'normal' as const, title: '시스템 업데이트', message: 'AI 입찰 최적화 엔진이 v2.1로 업데이트되었습니다.' },
  ];

  for (const notif of notifications) {
    await prisma.notification.create({
      data: {
        userId: owner.id,
        organizationId: org.id,
        ...notif,
      },
    });
  }
  console.log(`✅ 알림 ${notifications.length}개 생성`);

  // 9. 감사 로그 샘플
  const expiresAt = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
  await prisma.auditLog.create({
    data: {
      userId: owner.id,
      organizationId: org.id,
      action: 'LOGIN',
      entityType: 'User',
      entityId: owner.id,
      ipAddress: '127.0.0.1',
      expiresAt,
    },
  });
  await prisma.auditLog.create({
    data: {
      userId: owner.id,
      organizationId: org.id,
      action: 'CREATE',
      entityType: 'Campaign',
      entityId: campaign1.id,
      newValues: { name: campaign1.name },
      expiresAt,
    },
  });
  console.log('✅ 감사 로그 2개 생성');

  console.log('\n🎉 시드 데이터 생성 완료!');
  console.log('───────────────────────────');
  console.log('로그인 정보:');
  console.log('  Owner:  admin@agency.com / password123');
  console.log('  Admin:  lee@agency.com / password123');
  console.log('  Editor: park@agency.com / password123');
}

main()
  .catch((e) => {
    console.error('❌ 시드 실패:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
