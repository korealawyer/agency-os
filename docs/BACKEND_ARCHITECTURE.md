# Agency OS 백엔드 아키텍처 문서

> **작성일**: 2026-03-13  
> **목표**: Supabase(도쿄)에서 시작 → AWS RDS Seoul 이전 시 코드 변경 0줄

---

## 1. 아키텍처 개요

```
┌─────────────────────────────────────────────────────────────┐
│                        브라우저                              │
│  Next.js 16 App Router (React 19, SSR)                      │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐    │
│  │ 대시보드   │  │ 캠페인    │  │ 키워드    │  │ 설정     │    │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘    │
│       │              │              │              │          │
│       ▼              ▼              ▼              ▼          │
│  ┌──────────────────────────────────────────────────────┐    │
│  │              fetch('/api/...')                        │    │
│  └──────────────────────┬───────────────────────────────┘    │
└─────────────────────────┼───────────────────────────────────┘
                          │
┌─────────────────────────┼───────────────────────────────────┐
│                   서버 (API Layer)                           │
│  ┌──────────────────────┴───────────────────────────────┐   │
│  │         Next.js API Routes (/app/api/*)               │   │
│  │  ┌─────────┐  ┌─────────┐  ┌─────────┐              │   │
│  │  │ NextAuth│  │ API     │  │ 미들웨어 │              │   │
│  │  │ v5      │  │ Helpers │  │ (경로보호)│              │   │
│  │  └────┬────┘  └────┬────┘  └─────────┘              │   │
│  └───────┼────────────┼─────────────────────────────────┘   │
│          │            │                                      │
│  ┌───────┴────────────┴─────────────────────────────────┐   │
│  │              Prisma ORM (Client)                      │   │
│  │  ┌───────────────────────────────────────────────┐   │   │
│  │  │ prisma.user.findMany()                         │   │   │
│  │  │ prisma.campaign.create()                       │   │   │
│  │  │ prisma.keyword.update()                        │   │   │
│  │  └───────────────────────────────────────────────┘   │   │
│  └──────────────────────┬───────────────────────────────┘   │
└─────────────────────────┼───────────────────────────────────┘
                          │ DATABASE_URL
                          ▼
┌─────────────────────────────────────────────────────────────┐
│  PostgreSQL                                                  │
│  ┌────────────────────┐    ┌────────────────────┐           │
│  │  지금: Supabase    │ →→ │  나중: AWS RDS     │           │
│  │  (도쿄, 무료)      │    │  (서울, 유료)      │           │
│  └────────────────────┘    └────────────────────┘           │
│  이전 방법: .env의 DATABASE_URL 한 줄 변경                    │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. 왜 이 스택인가? (PRD 대비 변경사항)

| 항목 | PRD 권장 | 실제 선택 | 이유 |
|------|---------|----------|------|
| **ORM** | Drizzle | **Prisma** | `DATABASE_URL` 변경만으로 DB 이전 가능. 자동 마이그레이션 생성 |
| **인증** | Supabase Auth | **NextAuth.js v5** | Supabase 종속 제거. 어떤 DB에서든 동작 |
| **RLS** | Supabase RLS | **API 레벨 필터링** | `WHERE organization_id = ?` 로 동일 효과. RDS 호환 |
| **실시간** | Supabase Realtime | **폴링 (추후 WebSocket)** | Phase 1에서는 불필요. 나중에 AWS AppSync 등 대체 가능 |
| **DB** | Supabase PG | **Supabase PG → AWS RDS** | 동일 PostgreSQL. pg_dump로 이전 |

> **Supabase에서 사용하는 것**: PostgreSQL **만** 사용 (무료 DB 서버로만 취급)  
> **Supabase에서 안 사용하는 것**: Auth, RLS, Realtime, Storage, Edge Functions

---

## 3. 환경변수 (.env)

```bash
# ──── 데이터베이스 ────
# 지금 (Supabase 도쿄 무료)
# ⚠️ connection_limit=5: Serverless 환경에서 커넥션 풀 고갈 방지 (Supabase 무료 최대 60개)
DATABASE_URL="postgresql://postgres.[프로젝트ID]:[비밀번호]@aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=5"
DIRECT_URL="postgresql://postgres.[프로젝트ID]:[비밀번호]@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres"

# 나중 (AWS RDS 서울) — 이 2줄만 바꾸면 이전 완료
# DATABASE_URL="postgresql://admin:비밀번호@agency-os-db.xxxxx.ap-northeast-2.rds.amazonaws.com:5432/agencyos"
# DIRECT_URL="postgresql://admin:비밀번호@agency-os-db.xxxxx.ap-northeast-2.rds.amazonaws.com:5432/agencyos"

# ──── 인증 (NextAuth.js) ────
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="openssl rand -base64 32 로 생성한 랜덤 문자열"

# ──── 암호화 (API 키 저장용) ────
ENCRYPTION_KEY="openssl rand -hex 32 로 생성한 64자리 hex 문자열"

# ──── 캐싱 & Rate Limiting (Upstash Redis) ────
# Upstash 콘솔(https://console.upstash.com)에서 생성. 무료 티어: 10,000 req/day
UPSTASH_REDIS_URL="https://xxxx.upstash.io"
UPSTASH_REDIS_TOKEN="AxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxQ="

# ──── 비동기 메시지 큐 (Upstash QStash) ────
# 보고서 발송, 크롤링 등 장시간 작업의 비동기 처리용
# Upstash 콘솔에서 생성. 무료 티어: 500 msg/day
QSTASH_TOKEN="ey..."
QSTASH_CURRENT_SIGNING_KEY="sig_..."
QSTASH_NEXT_SIGNING_KEY="sig_..."

# ──── Cron 보안 ────
CRON_SECRET="openssl rand -base64 32 로 생성한 랜덤 문자열"
```

---

## 4. 패키지 의존성

```bash
# 프로덕션 의존성
npm install prisma @prisma/client    # ORM
npm install next-auth@5              # 인증 (v5 — App Router 지원)
npm install bcryptjs                  # 비밀번호 해싱
npm install @upstash/redis            # 캐싱 (Serverless Redis)
npm install @upstash/ratelimit        # Rate Limiting (분산 환경 호환)
npm install zod                       # 입력 유효성 검사

# 개발 의존성
npm install -D @types/bcryptjs
```

> **⚠️ @auth/prisma-adapter 미사용 이유**:  
> PrismaAdapter는 OAuth 등 DB 세션 전략에서 사용됩니다. 우리는 **Credentials Provider + JWT 세션** 전략이므로 Adapter가 불필요합니다.  
> Adapter를 사용하면 Credentials에서 세션 생성이 안 되는 알려진 제약이 있습니다.

**설치 후 package.json 추가분:**
```json
{
  "dependencies": {
    "@prisma/client": "^6.0.0",
    "@upstash/ratelimit": "^2.0.0",
    "@upstash/redis": "^1.34.0",
    "bcryptjs": "^2.4.3",
    "next-auth": "^5.0.0",
    "zod": "^3.23.0"
  },
  "devDependencies": {
    "@types/bcryptjs": "^2.4.6",
    "prisma": "^6.0.0"
  },
  "prisma": {
    "seed": "npx tsx prisma/seed.ts"
  }
}
```

---

## 5. Prisma 스키마 (전체)

> 기존 `drizzle_schema.ts` (862줄)을 Prisma 형식으로 변환  
> **[P1 개선]**: 시계열 테이블(BidHistory, RankSnapshot, AuditLog, ClickFraudEvent)의 PK를 **UUIDv7**로 전환  
> **[P2 개선]**: Keyword에 `version` 컬럼(Optimistic Locking), 중복 인덱스 정리, 누락 인덱스 추가

```prisma
// prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")  // Supabase pgBouncer 우회용 (마이그레이션 시)
}

// ============================================================
// ENUMS
// ============================================================

enum UserRole {
  owner
  admin
  editor
  viewer
}

enum PlanType {
  personal
  starter
  growth
  scale
  enterprise
}

enum SubscriptionStatus {
  trialing
  active
  past_due
  canceled
  paused
}

enum ConnectionStatus {
  connected
  disconnected
  error
  pending
}

enum BidStrategy {
  target_rank
  target_cpc
  target_roas
  max_conversion
  time_based
  manual
}

enum CampaignStatus {
  active
  paused
  ended
  draft
}

enum CampaignType {
  WEB_SITE
  SHOPPING
  BRAND_SEARCH
  PERFORMANCE_MAX
}

enum MatchType {
  exact
  phrase
  broad
}

enum DeviceType {
  pc
  mobile
}

enum NotificationType {
  bid_change
  report_sent
  api_error
  budget_alert
  system_notice
  anomaly_detected
  competitor_change
  churn_prediction
}

enum NotificationPriority {
  urgent
  high
  normal
  low
}

enum AiActionType {
  bid_adjustment
  keyword_recommendation
  report_generation
  anomaly_alert
  creative_suggestion
}

enum AuditAction {
  CREATE
  UPDATE
  DELETE
  LOGIN
  EXPORT
}

enum ChangedBy {
  ai
  manual
  system
}

enum ScheduleType {
  weekly
  monthly
}

enum FraudStatus {
  pending
  confirmed
  dismissed
}

enum BlockReason {
  rule_based
  ml_detected
  manual
}

// ============================================================
// 핵심 엔티티
// ============================================================

/// 조직 (멀티 테넌시 핵심)
model Organization {
  id              String    @id @default(uuid())
  name            String    @db.VarChar(200)
  planType        PlanType  @default(starter) @map("plan_type")
  totalAdSpend    Decimal   @default(0) @map("total_ad_spend") @db.Decimal(15, 2)
  businessNumber  String?   @map("business_number") @db.VarChar(20)
  contactEmail    String?   @map("contact_email") @db.VarChar(255)
  maxAccounts     Int       @default(5) @map("max_accounts")
  isActive        Boolean   @default(true) @map("is_active")
  createdAt       DateTime  @default(now()) @map("created_at") @db.Timestamptz
  updatedAt       DateTime  @updatedAt @map("updated_at") @db.Timestamptz
  deletedAt       DateTime? @map("deleted_at") @db.Timestamptz

  // Relations
  users               User[]
  subscriptions        Subscription[]
  naverAccounts        NaverAccount[]
  campaigns            Campaign[]
  adGroups             AdGroup[]
  keywords             Keyword[]
  bidHistory           BidHistory[]
  rankSnapshots        RankSnapshot[]
  profitability        Profitability[]
  reportTemplates      ReportTemplate[]
  reports              Report[]
  competitiveIntel     CompetitiveIntel[]
  notifications        Notification[]
  aiActionLogs         AiActionLog[]
  auditLogs            AuditLog[]
  clickFraudEvents     ClickFraudEvent[]
  blockedIps           BlockedIp[]
  clickFraudSummaries  ClickFraudDailySummary[]

  @@map("organizations")
}

/// 사용자
model User {
  id             String    @id @default(uuid())
  email          String    @unique @db.VarChar(255)
  passwordHash   String    @map("password_hash")
  name           String    @db.VarChar(100)
  role           UserRole  @default(viewer)
  organizationId String    @map("organization_id")
  avatarUrl      String?   @map("avatar_url")
  phone          String?   @db.VarChar(20)
  isActive       Boolean   @default(true) @map("is_active")
  lastLoginAt    DateTime? @map("last_login_at") @db.Timestamptz
  createdAt      DateTime  @default(now()) @map("created_at") @db.Timestamptz
  updatedAt      DateTime  @updatedAt @map("updated_at") @db.Timestamptz
  deletedAt      DateTime? @map("deleted_at") @db.Timestamptz

  // Relations
  organization  Organization   @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  notifications Notification[]
  aiActionLogs  AiActionLog[]
  auditLogs     AuditLog[]

  @@index([organizationId], name: "idx_users_org")
  @@index([email], name: "idx_users_email")
  @@map("users")
}

/// 구독
model Subscription {
  id                 String             @id @default(uuid())
  organizationId     String             @map("organization_id")
  planType           PlanType           @map("plan_type")
  status             SubscriptionStatus @default(trialing)
  monthlyPrice       Int                @map("monthly_price")
  currentPeriodStart DateTime           @map("current_period_start") @db.Timestamptz
  currentPeriodEnd   DateTime           @map("current_period_end") @db.Timestamptz
  paymentProvider    String?            @map("payment_provider") @db.VarChar(50)
  paymentProviderId  String?            @map("payment_provider_id") @db.VarChar(255)
  canceledAt         DateTime?          @map("canceled_at") @db.Timestamptz
  createdAt          DateTime           @default(now()) @map("created_at") @db.Timestamptz
  updatedAt          DateTime           @updatedAt @map("updated_at") @db.Timestamptz

  organization Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)

  @@index([organizationId], name: "idx_subs_org")
  @@index([status], name: "idx_subs_status")
  @@map("subscriptions")
}

// ============================================================
// 네이버 광고 엔티티
// ============================================================

/// 네이버 광고 계정
model NaverAccount {
  id                 String           @id @default(uuid())
  organizationId     String           @map("organization_id")
  customerId         String           @map("customer_id") @db.VarChar(100)
  customerName       String           @map("customer_name") @db.VarChar(200)
  apiKeyEncrypted    String           @map("api_key_encrypted")
  secretKeyEncrypted String           @map("secret_key_encrypted")
  connectionStatus   ConnectionStatus @default(pending) @map("connection_status")
  lastSyncAt         DateTime?        @map("last_sync_at") @db.Timestamptz
  dailyBudget        Int?             @map("daily_budget")
  monthlySpend       Decimal          @default(0) @map("monthly_spend") @db.Decimal(15, 2)
  commissionRate     Decimal?         @map("commission_rate") @db.Decimal(5, 4)
  isActive           Boolean          @default(true) @map("is_active")
  createdAt          DateTime         @default(now()) @map("created_at") @db.Timestamptz
  updatedAt          DateTime         @updatedAt @map("updated_at") @db.Timestamptz
  deletedAt          DateTime?        @map("deleted_at") @db.Timestamptz

  organization       Organization              @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  campaigns          Campaign[]
  profitability      Profitability[]
  competitiveIntel   CompetitiveIntel[]
  clickFraudEvents   ClickFraudEvent[]
  blockedIps         BlockedIp[]
  clickFraudSummaries ClickFraudDailySummary[]

  @@unique([customerId, organizationId], name: "idx_naver_acc_customer")
  @@index([organizationId], name: "idx_naver_acc_org")
  @@map("naver_accounts")
}

/// 캠페인
model Campaign {
  id              String          @id @default(uuid())
  naverAccountId  String          @map("naver_account_id")
  organizationId  String          @map("organization_id")
  naverCampaignId String          @map("naver_campaign_id") @db.VarChar(100)
  name            String          @db.VarChar(255)
  status          CampaignStatus  @default(active)
  campaignType    CampaignType?   @map("campaign_type")
  dailyBudget     Int?            @map("daily_budget")
  totalCost       Decimal         @default(0) @map("total_cost") @db.Decimal(15, 2)
  impressions     Int             @default(0)
  clicks          Int             @default(0)
  conversions     Int             @default(0)
  lastSyncAt      DateTime?       @map("last_sync_at") @db.Timestamptz
  createdAt       DateTime        @default(now()) @map("created_at") @db.Timestamptz
  updatedAt       DateTime        @updatedAt @map("updated_at") @db.Timestamptz
  deletedAt       DateTime?       @map("deleted_at") @db.Timestamptz

  naverAccount    NaverAccount     @relation(fields: [naverAccountId], references: [id], onDelete: Cascade)
  organization    Organization     @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  adGroups        AdGroup[]
  clickFraudEvents ClickFraudEvent[]

  // ⚠️ [P2 반정규화 주의] organizationId는 NaverAccount에서 파생 가능하나
  // 쿼리 최적화를 위한 의도적 반정규화. NaverAccount의 조직 이전 시
  // 반드시 Campaign.organizationId도 함께 갱신해야 합니다.

  @@index([naverAccountId], name: "idx_camps_account")
  // [P2 정리] idx_camps_org 삭제 — idx_camps_org_status의 좌측 프리픽스이므로 중복
  @@index([status], name: "idx_camps_status")
  @@index([organizationId, status], name: "idx_camps_org_status")
  @@index([organizationId, deletedAt, status], name: "idx_camps_org_deleted_status")
  @@map("campaigns")
}

/// 광고그룹
model AdGroup {
  id              String    @id @default(uuid())
  campaignId      String    @map("campaign_id")
  organizationId  String    @map("organization_id")
  naverAdGroupId  String    @map("naver_ad_group_id") @db.VarChar(100)
  name            String    @db.VarChar(255)
  isActive        Boolean   @default(true) @map("is_active")
  dailyBudget     Int?      @map("daily_budget")
  createdAt       DateTime  @default(now()) @map("created_at") @db.Timestamptz
  updatedAt       DateTime  @updatedAt @map("updated_at") @db.Timestamptz
  deletedAt       DateTime? @map("deleted_at") @db.Timestamptz

  campaign      Campaign      @relation(fields: [campaignId], references: [id], onDelete: Cascade)
  organization  Organization  @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  keywords      Keyword[]
  ads           Ad[]

  @@index([campaignId], name: "idx_adgroups_campaign")
  @@index([organizationId], name: "idx_adgroups_org")
  @@map("ad_groups")
}

/// 키워드
model Keyword {
  id              String      @id @default(uuid())
  adGroupId       String      @map("ad_group_id")
  organizationId  String      @map("organization_id")
  naverKeywordId  String      @map("naver_keyword_id") @db.VarChar(100)
  keywordText     String      @map("keyword_text") @db.VarChar(500)
  currentBid      Int         @default(0) @map("current_bid")
  targetRank      Int?        @map("target_rank")
  bidStrategy     BidStrategy @default(manual) @map("bid_strategy")
  matchType       MatchType   @default(exact) @map("match_type")
  qualityIndex    Int?        @map("quality_index")
  impressions     Int         @default(0)
  clicks          Int         @default(0)
  cpc             Int         @default(0)
  ctr             Decimal     @default(0) @db.Decimal(5, 4)
  conversions     Int         @default(0)
  cost            Decimal     @default(0) @db.Decimal(15, 2)
  isAutoManaged   Boolean     @default(false) @map("is_auto_managed")
  version         Int         @default(1)     // [P2] Optimistic Locking용 버전 컬럼
  lastSyncAt      DateTime?   @map("last_sync_at") @db.Timestamptz
  createdAt       DateTime    @default(now()) @map("created_at") @db.Timestamptz
  updatedAt       DateTime    @updatedAt @map("updated_at") @db.Timestamptz
  deletedAt       DateTime?   @map("deleted_at") @db.Timestamptz

  adGroup         AdGroup        @relation(fields: [adGroupId], references: [id], onDelete: Cascade)
  organization    Organization   @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  bidHistory      BidHistory[]
  rankSnapshots   RankSnapshot[]
  clickFraudEvents ClickFraudEvent[]

  @@index([adGroupId, deletedAt], name: "idx_kw_adgroup_deleted")  // [P2 추가] 광고그룹 상세 → 키워드 목록
  @@index([organizationId, bidStrategy], name: "idx_kw_org_strategy")
  @@index([keywordText], name: "idx_kw_text")
  // [리뷰 반영 D-5] LIKE '%keyword%' 검색 최적화 → pg_trgm GIN 인덱스는 Raw Migration으로 별도 추가 (§20.5 참조)
  @@index([organizationId, deletedAt], name: "idx_kw_org_deleted")
  @@index([organizationId, deletedAt, isAutoManaged], name: "idx_kw_org_deleted_auto")  // [리뷰 반영 B-2-3] Phase 3 자동입찰 키워드 조회용
  @@map("keywords")
}

/// 광고 소재
model Ad {
  id             String    @id @default(uuid())
  adGroupId      String    @map("ad_group_id")
  organizationId String    @map("organization_id")
  naverAdId      String    @map("naver_ad_id") @db.VarChar(100)
  title          String?   @db.VarChar(255)
  description    String?
  displayUrl     String?   @map("display_url") @db.VarChar(500)
  landingUrl     String?   @map("landing_url")
  isActive       Boolean   @default(true) @map("is_active")
  createdAt      DateTime  @default(now()) @map("created_at") @db.Timestamptz
  updatedAt      DateTime  @updatedAt @map("updated_at") @db.Timestamptz
  deletedAt      DateTime? @map("deleted_at") @db.Timestamptz

  adGroup      AdGroup @relation(fields: [adGroupId], references: [id], onDelete: Cascade)
  // Note: organizationId는 비정규화 필드 (쿼리 최적화용). Organization relation 없이 인덱스만 사용.

  @@index([adGroupId, deletedAt], name: "idx_ads_adgroup_deleted")  // [P2 추가] 광고그룹 상세 → 소재 목록
  @@index([organizationId], name: "idx_ads_org")
  @@map("ads")
}

// ============================================================
// Agency OS 비즈니스 엔티티
// ============================================================

/// 입찰 이력 — [P1] UUIDv7 PK (시간순 정렬, 인덱스 팽창 방지)
model BidHistory {
  id             String    @id @default(dbgenerated("gen_random_uuid()"))  // ⚠️ 프로덕션: DB 트리거로 UUIDv7 생성
  keywordId      String    @map("keyword_id")
  organizationId String    @map("organization_id")
  oldBid         Int       @map("old_bid")
  newBid         Int       @map("new_bid")
  reason         String    @db.VarChar(500)
  changedBy      ChangedBy @default(ai) @map("changed_by")
  currentRank    Int?      @map("current_rank")
  targetRank     Int?      @map("target_rank")
  changedAt      DateTime  @default(now()) @map("changed_at") @db.Timestamptz

  keyword      Keyword      @relation(fields: [keywordId], references: [id], onDelete: Cascade)
  organization Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)

  @@index([keywordId, changedAt(sort: Desc)], name: "idx_bidh_keyword_date_desc")  // [P2] DESC 방향 명시
  @@index([organizationId, changedAt, changedBy], name: "idx_bidh_org_date_by")
  @@map("bid_history")
}

/// 순위 스냅샷 — [P1] UUIDv7 PK
model RankSnapshot {
  id             String     @id @default(dbgenerated("gen_random_uuid()"))  // ⚠️ 프로덕션: UUIDv7
  keywordId      String     @map("keyword_id")
  organizationId String     @map("organization_id")
  rank           Int?
  page           Int?
  device         DeviceType @default(pc)
  capturedAt     DateTime   @default(now()) @map("captured_at") @db.Timestamptz

  keyword      Keyword      @relation(fields: [keywordId], references: [id], onDelete: Cascade)
  organization Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)

  @@index([keywordId, device, capturedAt(sort: Desc)], name: "idx_rank_kw_device_date_desc")  // [P2] 디바이스별 최근 순위
  @@index([organizationId], name: "idx_rank_org")
  @@map("rank_snapshots")
}

/// 수익성
model Profitability {
  id             String   @id @default(uuid())
  organizationId String   @map("organization_id")
  accountId      String   @map("account_id")
  adSpend        Decimal  @map("ad_spend") @db.Decimal(15, 2)
  agencyFee      Decimal  @map("agency_fee") @db.Decimal(15, 2)
  backMargin     Decimal  @default(0) @map("back_margin") @db.Decimal(15, 2)
  laborCost      Decimal  @default(0) @map("labor_cost") @db.Decimal(15, 2)
  netProfit      Decimal  @map("net_profit") @db.Decimal(15, 2)
  marginRate     Decimal  @map("margin_rate") @db.Decimal(5, 4)
  period         DateTime @db.Date
  createdAt      DateTime @default(now()) @map("created_at") @db.Timestamptz
  updatedAt      DateTime @updatedAt @map("updated_at") @db.Timestamptz

  organization Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  naverAccount NaverAccount @relation(fields: [accountId], references: [id], onDelete: Cascade)

  @@index([organizationId, period], name: "idx_profit_org_period")
  @@index([accountId], name: "idx_profit_account")
  @@unique([organizationId, accountId, period], name: "uq_profit_org_account_period")  // [추가] 중복 삽입 방지
  @@map("profitability")
}

/// 리포트 템플릿
model ReportTemplate {
  id              String       @id @default(uuid())
  organizationId  String       @map("organization_id")
  name            String       @db.VarChar(200)
  description     String?
  logoUrl         String?      @map("logo_url")
  kpiConfig       Json         @default("{}") @map("kpi_config")
  layoutConfig    Json         @default("{}") @map("layout_config")
  scheduleType    ScheduleType? @default(weekly) @map("schedule_type")
  recipientEmails Json         @default("[]") @map("recipient_emails")
  naverAccountIds Json         @default("[]") @map("naver_account_ids")
  isDefault       Boolean      @default(false) @map("is_default")
  createdAt       DateTime     @default(now()) @map("created_at") @db.Timestamptz
  updatedAt       DateTime     @updatedAt @map("updated_at") @db.Timestamptz

  organization Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  reports      Report[]

  @@index([organizationId], name: "idx_rpt_tmpl_org")
  @@map("report_templates")
}

/// 리포트
model Report {
  id             String    @id @default(uuid())
  organizationId String    @map("organization_id")
  templateId     String?   @map("template_id")
  title          String    @db.VarChar(255)
  periodStart    DateTime  @map("period_start") @db.Date
  periodEnd      DateTime  @map("period_end") @db.Date
  fileUrl        String?   @map("file_url")
  sentAt         DateTime? @map("sent_at") @db.Timestamptz
  sentTo         Json      @default("[]") @map("sent_to")
  createdAt      DateTime  @default(now()) @map("created_at") @db.Timestamptz

  organization Organization    @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  template     ReportTemplate? @relation(fields: [templateId], references: [id], onDelete: SetNull)

  @@index([organizationId], name: "idx_reports_org")
  @@index([periodStart, periodEnd], name: "idx_reports_period")
  @@map("reports")
}

/// 경쟁 인텔리전스
model CompetitiveIntel {
  id               String    @id @default(uuid())
  organizationId   String    @map("organization_id")
  naverAccountId   String?   @map("naver_account_id")
  keywordText      String    @map("keyword_text") @db.VarChar(500)
  top5Ads          Json      @default("[]") @map("top5_ads")
  estimatedBidLow  Int?      @map("estimated_bid_low")
  estimatedBidHigh Int?      @map("estimated_bid_high")
  competitorCount  Int       @default(0) @map("competitor_count")
  crawledAt        DateTime  @default(now()) @map("crawled_at") @db.Timestamptz

  organization Organization  @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  naverAccount NaverAccount? @relation(fields: [naverAccountId], references: [id], onDelete: SetNull)

  @@index([organizationId, keywordText], name: "idx_ci_org_kw")
  @@index([crawledAt], name: "idx_ci_crawled")
  @@map("competitive_intel")
}

/// 알림
model Notification {
  id             String               @id @default(uuid())
  userId         String               @map("user_id")
  organizationId String               @map("organization_id")
  type           NotificationType
  priority       NotificationPriority @default(normal)
  title          String               @db.VarChar(255)
  message        String
  metadata       Json                 @default("{}")
  isRead         Boolean              @default(false) @map("is_read")
  readAt         DateTime?            @map("read_at") @db.Timestamptz
  channels       Json                 @default("[\"in_app\"]")
  createdAt      DateTime             @default(now()) @map("created_at") @db.Timestamptz

  user         User         @relation(fields: [userId], references: [id], onDelete: Cascade)
  organization Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)

  // [P2 정리] idx_notif_user_read 삭제 — idx_notif_user_read_created의 좌측 프리픽스이므로 중복
  @@index([userId, isRead, createdAt], name: "idx_notif_user_read_created")  // 커버링 인덱스: 읽지않은 알림 시간순 조회
  @@index([organizationId], name: "idx_notif_org")
  @@index([createdAt], name: "idx_notif_created")
  @@index([isRead, readAt], name: "idx_notif_read_readat")  // [리뷰 반영 B-2-3] Cron 읽음 알림 삭제용 인덱스
  @@map("notifications")
}

/// AI 액션 로그
model AiActionLog {
  id             String       @id @default(uuid())
  userId         String?      @map("user_id")
  organizationId String       @map("organization_id")
  actionType     AiActionType @map("action_type")
  entityType     String       @map("entity_type") @db.VarChar(50)
  entityId       String?      @map("entity_id")
  inputData      Json         @default("{}") @map("input_data")
  outputData     Json         @default("{}") @map("output_data")
  confidence     Decimal?     @db.Decimal(3, 2)
  isApproved     Boolean?     @map("is_approved")
  approvedAt     DateTime?    @map("approved_at") @db.Timestamptz
  createdAt      DateTime     @default(now()) @map("created_at") @db.Timestamptz

  user         User?        @relation(fields: [userId], references: [id], onDelete: SetNull)
  organization Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)

  @@index([organizationId], name: "idx_ai_log_org")
  @@index([actionType], name: "idx_ai_log_type")
  @@index([entityType, entityId], name: "idx_ai_log_entity")
  @@map("ai_action_logs")
}

/// 감사 로그 — [P1] UUIDv7 PK
model AuditLog {
  id             String      @id @default(dbgenerated("gen_random_uuid()"))  // ⚠️ 프로덕션: UUIDv7
  userId         String?     @map("user_id")
  organizationId String      @map("organization_id")
  action         AuditAction
  entityType     String      @map("entity_type") @db.VarChar(100)
  entityId       String?     @map("entity_id")
  oldValues      Json?       @map("old_values")
  newValues      Json?       @map("new_values")
  ipAddress      String?     @map("ip_address") @db.VarChar(45)
  userAgent      String?     @map("user_agent")
  createdAt      DateTime    @default(now()) @map("created_at") @db.Timestamptz
  expiresAt      DateTime?   @map("expires_at") @db.Timestamptz

  user         User?        @relation(fields: [userId], references: [id], onDelete: SetNull)
  organization Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)

  // [P2 정리] idx_audit_org 삭제 — idx_audit_org_date_action의 좌측 프리픽스
  @@index([entityType, entityId], name: "idx_audit_entity")
  @@index([createdAt], name: "idx_audit_created")
  @@index([expiresAt], name: "idx_audit_expires")
  @@index([organizationId, createdAt, action], name: "idx_audit_org_date_action")
  @@map("audit_logs")
}

// ============================================================
// 부정클릭 방지
// ============================================================

model ClickFraudEvent {
  id                String      @id @default(dbgenerated("gen_random_uuid()"))  // [P1] UUIDv7
  organizationId    String      @map("organization_id")
  naverAccountId    String      @map("naver_account_id")
  keywordId         String?     @map("keyword_id")
  campaignId        String?     @map("campaign_id")
  clickTimestamp    DateTime    @map("click_timestamp") @db.Timestamptz
  ipHash            String      @map("ip_hash") @db.VarChar(64)
  userAgent         String?     @map("user_agent")
  deviceFingerprint String?     @map("device_fingerprint") @db.VarChar(64)
  geoCountry        String?     @map("geo_country") @db.VarChar(2)
  geoRegion         String?     @map("geo_region") @db.VarChar(20)
  sessionId         String?     @map("session_id") @db.VarChar(64)
  landingUrl        String?     @map("landing_url")
  dwellTimeMs       Int?        @map("dwell_time_ms")
  fraudScore        Decimal     @default(0) @map("fraud_score") @db.Decimal(3, 2)
  triggeredRules    Json        @default("[]") @map("triggered_rules")
  status            FraudStatus @default(pending)
  actionTaken       String?     @map("action_taken") @db.VarChar(20)
  createdAt         DateTime    @default(now()) @map("created_at") @db.Timestamptz
  updatedAt         DateTime    @updatedAt @map("updated_at") @db.Timestamptz

  organization Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  naverAccount NaverAccount @relation(fields: [naverAccountId], references: [id], onDelete: Cascade)
  keyword      Keyword?     @relation(fields: [keywordId], references: [id], onDelete: SetNull)
  campaign     Campaign?    @relation(fields: [campaignId], references: [id], onDelete: SetNull)

  @@index([organizationId], name: "idx_cfe_org")
  @@index([naverAccountId], name: "idx_cfe_account")
  @@index([ipHash, clickTimestamp], name: "idx_cfe_ip_time")
  @@index([deviceFingerprint], name: "idx_cfe_fingerprint")  // [P2 추가] 핑거프린트 기반 사기 탐지
  @@index([status], name: "idx_cfe_status")
  @@index([organizationId, status, clickTimestamp], name: "idx_cfe_org_status_time")
  @@map("click_fraud_events")
}

model BlockedIp {
  id             String      @id @default(uuid())
  organizationId String      @map("organization_id")
  naverAccountId String      @map("naver_account_id")
  ipHash         String      @map("ip_hash") @db.VarChar(64)
  ipMasked       String?     @map("ip_masked") @db.VarChar(15)
  blockReason    BlockReason @map("block_reason")
  triggeredRules Json        @default("[]") @map("triggered_rules")
  fraudCount     Int         @default(0) @map("fraud_count")
  estimatedLoss  Decimal     @default(0) @map("estimated_loss") @db.Decimal(12, 2)
  isActive       Boolean     @default(true) @map("is_active")
  blockedAt      DateTime    @default(now()) @map("blocked_at") @db.Timestamptz
  expiresAt      DateTime?   @map("expires_at") @db.Timestamptz
  unblockedAt    DateTime?   @map("unblocked_at") @db.Timestamptz
  createdAt      DateTime    @default(now()) @map("created_at") @db.Timestamptz

  organization Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  naverAccount NaverAccount @relation(fields: [naverAccountId], references: [id], onDelete: Cascade)

  @@index([organizationId], name: "idx_blocked_org")
  @@index([naverAccountId], name: "idx_blocked_account")
  @@index([ipHash], name: "idx_blocked_ip")
  // [리뷰 반영 D-10] Boolean 단독 인덱스(isActive) 제거 → 선택도 50%로 Seq Scan과 차이 없음
  // 필요 시 @@index([organizationId, isActive]) 복합 인덱스로 대체
  @@index([organizationId, isActive], name: "idx_blocked_org_active")
  @@unique([organizationId, ipHash], name: "uq_blocked_org_ip")  // [추가] 중복 차단 방지
  @@map("blocked_ips")
}

model ClickFraudDailySummary {
  id               String   @id @default(uuid())
  organizationId   String   @map("organization_id")
  naverAccountId   String   @map("naver_account_id")
  summaryDate      DateTime @map("summary_date") @db.Date
  totalClicks      Int      @default(0) @map("total_clicks")
  fraudClicks      Int      @default(0) @map("fraud_clicks")
  fraudRate        Decimal  @default(0) @map("fraud_rate") @db.Decimal(5, 2)
  estimatedLoss    Decimal  @default(0) @map("estimated_loss") @db.Decimal(12, 2)
  blockedIpsCount  Int      @default(0) @map("blocked_ips_count")
  refundRequested  Decimal  @default(0) @map("refund_requested") @db.Decimal(12, 2)
  refundApproved   Decimal  @default(0) @map("refund_approved") @db.Decimal(12, 2)
  createdAt        DateTime @default(now()) @map("created_at") @db.Timestamptz

  organization Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  naverAccount NaverAccount @relation(fields: [naverAccountId], references: [id], onDelete: Cascade)

  @@index([organizationId, summaryDate], name: "idx_cfds_org_date")
  @@index([naverAccountId], name: "idx_cfds_account")
  // [리뷰 반영 D-3] 복합 Unique 추가 — Cron 집계 시 upsert 정상 동작 + 중복 삽입 방지
  @@unique([organizationId, naverAccountId, summaryDate], name: "uq_cfds_org_account_date")
  @@map("click_fraud_daily_summary")
}
```

---

## 6. 핵심 코드 파일

### 6.1 Prisma Client 싱글톤

```typescript
// src/lib/db.ts
import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

// ──── [P0] 멀티테넌트 격리 미들웨어 ────
// ⚠️ Supabase RLS를 사용하지 않으므로, 애플리케이션 레벨에서 organization_id 필터를 강제
// → 개발자가 실수로 필터를 빠뜨리면 즉시 에러 발생 (다른 조직 데이터 유출 원천 차단)
// [리뷰 반영] READ + WRITE 모두 organizationId 필수 검증
const MULTI_TENANT_MODELS = new Set([
  'Campaign', 'Keyword', 'NaverAccount', 'AdGroup', 'Ad',
  'BidHistory', 'RankSnapshot', 'Notification', 'AuditLog',
  'Profitability', 'Report', 'ReportTemplate', 'CompetitiveIntel',
  'ClickFraudEvent', 'BlockedIp', 'ClickFraudDailySummary',
  'AiActionLog', 'Subscription',
]);

const READ_ACTIONS = new Set([
  'findMany', 'findFirst', 'findFirstOrThrow', 'count', 'aggregate', 'groupBy',
]);

// [리뷰 반영 A-1-1] findUnique/findUniqueOrThrow 차단 — organizationId를 WHERE에 넣을 수 없으므로
// 멀티테넌트 모델에서는 findFirst({ where: { id, organizationId } }) 패턴을 강제합니다.
const BLOCKED_ACTIONS = new Set(['findUnique', 'findUniqueOrThrow']);

// [리뷰 반영 C-1] WRITE 작업에도 organizationId 검증 추가
const WRITE_ACTIONS_WITH_WHERE = new Set([
  'update', 'updateMany', 'delete', 'deleteMany', 'upsert',
]);

const WRITE_ACTIONS_WITH_DATA = new Set([
  'create', 'createMany',
]);

prisma.$use(async (params, next) => {
  // 빠른 탈출 — 멀티테넌트 모델이 아니면 즉시 통과 (성능 최적화)
  if (!MULTI_TENANT_MODELS.has(params.model ?? '')) return next(params);

  const where = params.args?.where;
  const data = params.args?.data;

  // [리뷰 반영 A-1-1] findUnique/findUniqueOrThrow 차단
  // → organizationId를 unique where에 넣을 수 없어 다른 조직 데이터 접근 가능
  // → findFirst({ where: { id, organizationId } }) 패턴을 대신 사용하세요.
  if (BLOCKED_ACTIONS.has(params.action)) {
    throw new Error(
      `[SECURITY] ${params.model}.${params.action}() 사용 금지. ` +
      `멀티테넌트 모델에서는 findFirst({ where: { id, organizationId } })를 사용하세요.`
    );
  }

  // READ: WHERE에 organizationId 필수
  if (READ_ACTIONS.has(params.action)) {
    if (!where?.organizationId) {
      throw new Error(
        `[SECURITY] ${params.model}.${params.action}(): organizationId 필터가 누락되었습니다. ` +
        `멀티테넌트 모델은 반드시 organizationId를 WHERE 조건에 포함해야 합니다.`
      );
    }
  }

  // [리뷰 반영 C-1] WRITE (update/delete): WHERE에 organizationId 필수
  if (WRITE_ACTIONS_WITH_WHERE.has(params.action)) {
    if (!where?.organizationId) {
      throw new Error(
        `[SECURITY] ${params.model}.${params.action}(): WRITE 작업에 organizationId WHERE 조건이 누락되었습니다. ` +
        `다른 조직의 데이터가 변조될 수 있습니다.`
      );
    }
  }

  // [리뷰 반영 C-1] WRITE (create): DATA에 organizationId 필수
  if (WRITE_ACTIONS_WITH_DATA.has(params.action)) {
    // createMany는 data가 배열일 수 있음
    const dataItems = Array.isArray(data) ? data : [data];
    for (const item of dataItems) {
      if (!item?.organizationId) {
        throw new Error(
          `[SECURITY] ${params.model}.${params.action}(): CREATE 작업에 organizationId가 누락되었습니다. ` +
          `모든 멀티테넌트 데이터는 반드시 조직에 귀속되어야 합니다.`
        );
      }
    }
  }

  return next(params);
});

export default prisma;

// ──── [리뷰 반영 A-1-2] 내부 전용 PrismaClient (미들웨어 미적용) ────
// Cron 작업, 마이그레이션, 시드 등 조직 횡단 작업에만 사용
// ⚠️ API Route에서 사용 금지 — 멀티테넌트 격리가 우회됩니다
const globalForInternalPrisma = globalThis as unknown as { internalPrisma: PrismaClient };
export const internalPrisma = globalForInternalPrisma.internalPrisma ?? new PrismaClient();
if (process.env.NODE_ENV !== 'production') globalForInternalPrisma.internalPrisma = internalPrisma;
```

> **왜 싱글톤인가?** Next.js 개발 모드에서 Hot Reload마다 새 PrismaClient가 생성되어 DB 연결이 고갈됨. 전역 변수에 캐싱하여 방지.
>
> **왜 미들웨어인가?** Supabase RLS를 포기했으므로, 애플리케이션 레벨에서 `organization_id` 필터를 **강제**합니다. 이 미들웨어가 없으면 단 하나의 API에서 필터가 빠져도 **다른 조직의 데이터가 노출**됩니다.

---

### 6.2 NextAuth.js 설정

```typescript
// src/lib/auth.config.ts
import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import prisma from './db';

export const { handlers, auth, signIn, signOut } = NextAuth({
  // ⚠️ PrismaAdapter 미사용: Credentials + JWT 조합에서는 Adapter 불필요
  // Adapter는 OAuth (Google 등) 사용 시에만 필요
  session: {
    strategy: 'jwt',          // JWT = 서버리스 호환 (세션 테이블 불필요)
    maxAge: 8 * 60 * 60,      // ⚠️ 8시간 후 만료 (기본 30일은 토큰 탈취 시 위험)
    updateAge: 60 * 60,       // 1시간마다 토큰 갱신
  },
  
  providers: [
    Credentials({
      name: 'credentials',
      credentials: {
        email: { label: '이메일', type: 'email' },
        password: { label: '비밀번호', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;
        
        const user = await prisma.user.findUnique({
          where: { email: credentials.email as string },
          include: { organization: true },
        });
        
        if (!user || !user.isActive) return null;
        
        const isValid = await bcrypt.compare(
          credentials.password as string,
          user.passwordHash
        );
        if (!isValid) return null;
        
        // 마지막 로그인 시간 업데이트
        await prisma.user.update({
          where: { id: user.id },
          data: { lastLoginAt: new Date() },
        });
        
        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          organizationId: user.organizationId,
          organizationName: user.organization.name,
        };
      },
    }),
  ],
  
  callbacks: {
    async jwt({ token, user, trigger }) {
      // 최초 로그인 시 user 객체가 전달됨
      // [P2 개선] organizationName 제거 — JWT는 Base64 디코딩만으로 내용 확인 가능하므로 민감 데이터 최소화
      if (user) {
        token.id = user.id;
        token.role = (user as any).role;
        token.organizationId = (user as any).organizationId;
      }
      // [리뷰 반영 A-1-8] 세션 갱신 시(updateAge마다) DB에서 role 재확인
      // → 관리자가 멤버 role을 변경해도 최대 1시간 내 반영 (maxAge 8시간 대기 방지)
      if (trigger === 'update' || !user) {
        const dbUser = await prisma.user.findFirst({
          where: { id: token.id as string },
          select: { role: true, isActive: true },
        });
        if (!dbUser || !dbUser.isActive) return null; // 비활성 사용자 강제 로그아웃
        token.role = dbUser.role;
      }
      return token;
    },
    async session({ session, token }) {
      // 세션에 사용자 정보 포함 (프론트엔드에서 접근 가능)
      session.user.id = token.id as string;
      session.user.role = token.role as string;
      session.user.organizationId = token.organizationId as string;
      // [P2] organizationName은 JWT에서 제거 — 필요 시 API로 조회
      return session;
    },
  },
  
  pages: {
    signIn: '/login',  // 기존 로그인 페이지 재사용
  },
});
```

---

### 6.3 NextAuth API Route

```typescript
// src/app/api/auth/[...nextauth]/route.ts
import { handlers } from '@/lib/auth.config';

export const { GET, POST } = handlers;
```

---

### 6.4 회원가입 API

```typescript
// src/app/api/auth/signup/route.ts
import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import prisma from '@/lib/db';
import { withErrorHandler, apiError, safeParseBody, validateBody } from '@/lib/api-helpers';

// [리뷰 반영 M-1] Zod 스키마로 유효성 검사 통합
const signupSchema = z.object({
  name: z.string().min(1, '이름은 필수입니다').max(100),
  email: z.string().email('유효하지 않은 이메일 형식입니다').max(255),
  password: z.string().min(8, '비밀번호는 8자 이상이어야 합니다').max(100),
  agency: z.string().max(200).optional(),
});

export async function POST(request: Request) {
  return withErrorHandler(async () => {
    // [P0 개선] safeParseBody로 JSON 파싱 에러 방어
    const { data: body, error: parseError } = await safeParseBody(request);
    if (parseError) return apiError(parseError, 400);

    // [리뷰 반영 M-1] Zod 유효성 검사 (수동 if 체크 → Zod 통합)
    const { data: validated, error: validError } = validateBody(signupSchema, body);
    if (validError) return apiError(validError, 400);
    const { name, email, password, agency } = validated;

  // [리뷰 반영 C-2] bcrypt 해싱을 트랜잭션 외부에서 먼저 수행 (CPU 작업)
  // 하지만 중복 확인은 트랜잭션 내부에서 수행하여 Race Condition 방지
  const passwordHash = await bcrypt.hash(password, 12);

  const result = await prisma.$transaction(async (tx) => {
    // [리뷰 반영 C-2] 트랜잭션 내부에서 중복 확인 → atomicity 보장
    // 기존: findUnique → bcrypt(200ms 갭) → transaction → create 순서였으나,
    // 동시 요청 시 두 요청 모두 findUnique를 통과하여 고아 Organization이 생성될 수 있었음
    const existing = await tx.user.findUnique({ where: { email } });
    if (existing) {
      throw new Error('DUPLICATE_EMAIL');
    }

    const org = await tx.organization.create({
      data: {
        name: agency || `${name}의 조직`,
        planType: 'starter',
        maxAccounts: 5,
      },
    });

    const user = await tx.user.create({
      data: {
        email,
        passwordHash,
        name,
        role: 'owner',
        organizationId: org.id,
      },
    });

    return { user, org };
  });

  return NextResponse.json({
    success: true,
    user: {
      id: result.user.id,
      name: result.user.name,
      email: result.user.email,
      role: result.user.role,
      organization: result.org.name,
    },
  });
  });  // withErrorHandler 닫기
}
```

> **[리뷰 반영 C-2] Race Condition 수정 요약**:
> 1. `findUnique` → `bcrypt.hash(200ms)` → `$transaction` 순서에서, 동시 요청 시 두 요청 모두 중복 확인을 통과하는 문제 수정
> 2. `bcrypt.hash`는 CPU 작업이므로 트랜잭션 외부에서 먼저 수행 (DB 커넥션 점유 시간 최소화)
> 3. 중복 확인(`findUnique`)은 **트랜잭션 내부**로 이동하여 **atomicity** 보장
> 4. `DUPLICATE_EMAIL` 에러는 `withErrorHandler`에서 적절한 HTTP 응답으로 변환

---

---

### 6.5 API 헬퍼 유틸리티

```typescript
// src/lib/api-helpers.ts
import { NextResponse } from 'next/server';
import { auth } from './auth.config';

// 인증된 사용자 정보 가져오기
export async function getSessionUser() {
  const session = await auth();
  if (!session?.user) return null;
  return {
    id: session.user.id,
    email: session.user.email!,
    name: session.user.name!,
    role: session.user.role as string,
    organizationId: session.user.organizationId as string,
  };
}

// 인증 필수 체크 → 실패 시 401 반환
export async function requireAuth() {
  const user = await getSessionUser();
  if (!user) {
    return { user: null, error: NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 }) };
  }
  return { user, error: null };
}

// 표준 성공 응답
export function apiResponse(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}

// 표준 에러 응답
export function apiError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}
```

---

### 6.6 미들웨어 (경로 보호 + Rate Limiting)

```typescript
// src/middleware.ts
import { auth } from '@/lib/auth.config';
import { NextResponse } from 'next/server';
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

// ──── Upstash Redis Rate Limiter (분산 환경 호환) ────
// ⚠️ 인메모리 Map 대신 Redis 사용 → 다중 인스턴스에서도 정확한 제한
const redis = Redis.fromEnv();

// [P0 개선] IP + userId 이중 Rate Limiting
const apiRateLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(60, '1 m'),  // 60 req/min
  prefix: 'rl:api',
});

const loginRateLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(5, '5 m'),   // 5 req/5min (brute force 방지)
  prefix: 'rl:login',
});

// [P0 추가] 회원가입 Rate Limiting — 무제한 가입 공격 방지
const signupRateLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(3, '1 h'),   // 3 req/1h per IP
  prefix: 'rl:signup',
});

// [P0 추가] 인증된 사용자 전용 Rate Limiting (프록시/VPN 우회 방어)
const userRateLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(120, '1 m'),  // 120 req/min per user
  prefix: 'rl:user',
});

export default auth(async (req) => {
  const isLoggedIn = !!req.auth;
  const { pathname } = req.nextUrl;
  // [리뷰 반영 M-7] IP Spoofing 방어 강화
  // x-forwarded-for는 프록시 체인에서 조작 가능하므로 x-real-ip와 교차 검증
  // Vercel 환경에서는 x-real-ip가 더 신뢰성 높음
  const ip = req.headers.get('x-real-ip') 
    || req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() 
    || 'unknown';

  // [보안] Cron 엔드포인트는 CRON_SECRET 검증만 허용 (미들웨어에서 조기 차단)
  if (pathname.startsWith('/api/cron')) {
    const authHeader = req.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.next();
  }

  // Rate Limiting (전체 API — IP 기반)
  if (pathname.startsWith('/api')) {
    const { success } = await apiRateLimit.limit(ip);
    if (!success) {
      return NextResponse.json(
        { error: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.' },
        { status: 429 }
      );
    }
  }

  // [P0 추가] 인증된 사용자 — userId 기반 Rate Limiting 병행
  // → 프록시/VPN으로 IP를 변경해도 userId로 추적
  if (isLoggedIn && pathname.startsWith('/api')) {
    const userId = (req.auth as any)?.user?.id;
    if (userId) {
      const { success } = await userRateLimit.limit(`user:${userId}`);
      if (!success) {
        return NextResponse.json(
          { error: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.' },
          { status: 429 }
        );
      }
    }
  }

  // 로그인 Rate Limiting (더 엄격)
  if (pathname === '/api/auth/callback/credentials') {
    const { success } = await loginRateLimit.limit(`login:${ip}`);
    if (!success) {
      return NextResponse.json(
        { error: '로그인 시도가 너무 많습니다. 5분 후 다시 시도해주세요.' },
        { status: 429 }
      );
    }
  }

  // [P0 추가] 회원가입 Rate Limiting — 무제한 가입 공격 방지
  if (pathname === '/api/auth/signup') {
    const { success } = await signupRateLimit.limit(`signup:${ip}`);
    if (!success) {
      return NextResponse.json(
        { error: '회원가입 시도가 너무 많습니다. 1시간 후 다시 시도해주세요.' },
        { status: 429 }
      );
    }
  }

  // 대시보드 경로 보호
  if (pathname.startsWith('/dashboard') && !isLoggedIn) {
    return NextResponse.redirect(new URL('/login', req.url));
  }

  // API 경로 보호 (인증/회원가입/헬스체크/Cron 제외)
  // [리뷰 반영 A-1-3] /api/health → 로드밸런서 헬스체크 허용, /api/cron → 자체 CRON_SECRET 검증
  if (pathname.startsWith('/api') && 
      !pathname.startsWith('/api/auth') && 
      !pathname.startsWith('/api/health') &&
      !pathname.startsWith('/api/cron') &&
      !isLoggedIn) {
    return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
  }

  // [P1 개선] 보안 헤더 완비 — XSS, Clickjacking, MITM, 정보 유출 방어
  const response = NextResponse.next();
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set(
    'Strict-Transport-Security',
    'max-age=31536000; includeSubDomains; preload'  // HSTS — HTTP 접근 차단
  );
  response.headers.set(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      // [리뷰 반영 C-3] unsafe-eval 제거 — eval() 기반 XSS 공격 차단
      // Next.js 프로덕션 빌드에서는 unsafe-eval 불필요
      // 개발 모드에서는 next.config.ts에서 CSP를 비활성화하거나 nonce 기반으로 전환
      "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      "img-src 'self' data: blob: https:",
      "connect-src 'self' https://*.upstash.io https://*.supabase.com",
      "frame-ancestors 'none'",
    ].join('; ')
  );
  response.headers.set(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(), payment=(self)'
  );
  return response;
});

export const config = {
  matcher: ['/dashboard/:path*', '/api/:path*', '/api/health'],  // [리뷰 반영 M-5] health check 경로 추가
};
```

> **⚠️ 이전 버전 대비 변경사항**:
> 1. **[P0] 회원가입 Rate Limiting 추가**: `POST /api/auth/signup` — IP당 1시간 3회 제한
> 2. **[P0] userId 기반 이중 Rate Limiting**: 인증 사용자는 **IP + userId** 이중 체크 → **프록시/VPN** 우회 방어
> 3. **[P1] 보안 헤더 완비**: `Content-Security-Policy`, `Strict-Transport-Security`(HSTS), `Referrer-Policy`, `Permissions-Policy` 추가
> 4. **[보안] Cron 엔드포인트 보호**: `/api/cron/*` 경로는 `CRON_SECRET` 검증 후에만 접근 허용

---

## 7. API 엔드포인트 명세

### 7.1 대시보드 (`/api/dashboard`)

```typescript
// src/app/api/dashboard/route.ts
// GET — 대시보드 KPI 집계 (캐싱 적용 + 쿼리 최적화)
import prisma from '@/lib/db';
import { requireAuth, apiResponse } from '@/lib/api-helpers';
import { cachedQuery } from '@/lib/cache';

export async function GET() {
  const { user, error } = await requireAuth();
  if (error) return error;

  const orgId = user!.organizationId;

  // ⚠️ Redis 캐싱 (60초 TTL) — 대시보드는 읽기 전용, 실시간성 불필요
  const kpi = await cachedQuery(`dashboard:${orgId}`, 60, async () => {
    // ✅ 최적화: campaigns 테이블 2회 스캔 → 1회로 통합
    // [P2 개선] FILTER 절 → WHERE로 이동 (PostgreSQL 옵티마이저 인덱스 활용률 향상)
    const [campaignKPI, activeKeywords] = await Promise.all([
      prisma.$queryRaw<[{ active_campaigns: bigint; total_clicks: bigint; total_impressions: bigint; total_conversions: bigint; total_ad_spend: number }]>`
        SELECT 
          COUNT(*) AS active_campaigns,
          COALESCE(SUM(clicks), 0) AS total_clicks,
          COALESCE(SUM(impressions), 0) AS total_impressions,
          COALESCE(SUM(conversions), 0) AS total_conversions,
          COALESCE(SUM(total_cost), 0) AS total_ad_spend
        FROM campaigns
        WHERE organization_id = ${orgId} 
          AND deleted_at IS NULL 
          AND status = 'active'
      `,
      prisma.keyword.count({
        where: { organizationId: orgId, deletedAt: null },
      }),
    ]);

    const c = campaignKPI[0];
    return {
      totalAdSpend: c.total_ad_spend,
      activeCampaigns: Number(c.active_campaigns),
      totalClicks: Number(c.total_clicks),
      totalImpressions: Number(c.total_impressions),
      totalConversions: Number(c.total_conversions),
      activeKeywords,
    };
  });

  return apiResponse({ kpi });
}
```

> **개선 요약**: `campaigns` 2회 스캔 → 1회 통합 + Redis 60초 캐싱 + 쓰기 시 자동 무효화

### 7.2 캠페인 (`/api/campaigns`)

**목록/생성** — `src/app/api/campaigns/route.ts`

| Method | 설명 | Request/Query | Response |
|--------|------|-------------|----------|
| `GET` | 캠페인 목록 조회 | `?status=active&sort=totalCost&page=1&limit=20` | `{ data: Campaign[], total, page, limit }` |
| `POST` | 캠페인 생성 | `{ naverAccountId, name, status, dailyBudget, campaignType }` | `{ campaign: Campaign }` |

**개별 조회/수정/삭제** — `src/app/api/campaigns/[id]/route.ts`

| Method | 설명 | Request Body | Response |
|--------|------|-------------|----------|
| `GET` | 캠페인 상세 조회 (광고그룹 포함) | — | `{ campaign: Campaign & { adGroups: AdGroup[] } }` |
| `PUT` | 캠페인 수정 | `{ name?, status?, dailyBudget? }` | `{ campaign: Campaign }` |
| `DELETE` | 캠페인 소프트 삭제 | — | `{ success: true }` |

---

### 7.3 키워드 (`/api/keywords`)

**목록/생성** — `src/app/api/keywords/route.ts`

| Method | 설명 | Request/Query | Response |
|--------|------|-------------|----------|
| `GET` | 키워드 목록 (검색/필터/페이지네이션) | `?q=변호사&strategy=target_rank&page=1&limit=50` | `{ data: Keyword[], total, page, limit }` |
| `POST` | 키워드 추가 | `{ adGroupId, keywordText, currentBid, matchType, bidStrategy }` | `{ keyword: Keyword }` |

**개별 조회/수정/삭제** — `src/app/api/keywords/[id]/route.ts`

| Method | 설명 | Request Body | Response |
|--------|------|-------------|----------|
| `GET` | 키워드 상세 (입찰이력, 순위스냅샷 포함) | — | `{ data: Keyword & { bidHistory, rankSnapshots } }` |
| `PUT` | 입찰가 변경 (BidHistory 자동 기록) | `{ newBid, reason }` | `{ data: { keyword: Keyword, bidHistory: BidHistory } }` |
| `DELETE` | 키워드 소프트 삭제 | — | `{ success: true }` |

> **[리뷰 반영 B-2-2]** 키워드 상세 GET에서 입찰이력/순위스냅샷은 다음과 같이 **최신 N건만 포함**하여 무제한 응답 크기를 방지합니다:
> ```typescript
> include: {
>   bidHistory: { orderBy: { changedAt: 'desc' }, take: 20 },
>   rankSnapshots: { orderBy: { capturedAt: 'desc' }, take: 30 },
> }
> ```
> 전체 이력이 필요한 경우 `/api/keywords/[id]/bid-history?page=1&limit=50` 별도 엔드포인트를 활용하세요.

**일괄 작업** — `src/app/api/keywords/bulk/route.ts`

| Method | 설명 | Request Body | Response |
|--------|------|-------------|----------|
| `PATCH` | 일괄 입찰가 변경 | `{ ids: string[], newBid, reason }` | `{ updated: number }` |
| `DELETE` | 일괄 삭제 | `{ ids: string[] }` | `{ deleted: number }` |

**입찰가 변경 시 자동 기록 예시 ([P2] version 기반 Optimistic Locking 적용):**
```typescript
// PUT /api/keywords/[id] — 입찰가 변경
import { ConflictError } from '@/lib/api-helpers';
import { createAuditLogAsync } from '@/lib/audit';

const result = await prisma.$transaction(async (tx) => {
  const keyword = await tx.keyword.findUnique({ where: { id: keywordId } });
  if (!keyword) throw new Error('NOT_FOUND');
  
  // ✅ [P2 개선] Optimistic Locking: version 컬럼 기반으로 동시 수정 감지
  // updatedAt 비교 대신 정수 version을 사용하여 Phantom Read 위험 제거
  const updated = await tx.keyword.updateMany({
    where: {
      id: keywordId,
      version: keyword.version,  // 동시성 제어 — 다른 요청이 먼저 수정했다면 count=0
    },
    data: { 
      currentBid: newBid,
      version: { increment: 1 },  // version + 1 → 다음 수정 시 충돌 감지
    },
  });
  
  if (updated.count === 0) {
    throw new ConflictError('keyword');
    // → 409 Conflict 응답 → 클라이언트가 재시도
  }
  
  // 1. 이력 기록
  const history = await tx.bidHistory.create({
    data: {
      keywordId,
      organizationId: user.organizationId,
      oldBid: keyword.currentBid,
      newBid,
      reason: reason || '수동 변경',
      changedBy: 'manual',
    },
  });
  
  // 2. [P2 개선] 감사 로그 비동기 기록 — 트랜잭션 밖에서 처리
  // 감사 로그 실패가 비즈니스 로직을 롤백시키면 안 됨
  
  // 3. 캐시 무효화 (태그 기반)
  await invalidateCache(
    `dashboard:${user.organizationId}`,
    `keywords:${user.organizationId}`
  );
  
  return { keyword: { ...keyword, currentBid: newBid, version: keyword.version + 1 }, bidHistory: history };
});

// [P2] 감사 로그 비동기 기록 (Fire-and-Forget)
createAuditLogAsync({
  userId: user.id,
  organizationId: user.organizationId,
  action: 'UPDATE',
  entityType: 'keyword',
  entityId: keywordId,
  oldValues: { currentBid: keyword.currentBid },
  newValues: { currentBid: newBid },
}).catch(e => console.warn('Audit log failed:', e));
```

> **개선 요약**:  
> 1. **[P2] version 기반 Optimistic Locking**: `version` 정수 컬럼 사용으로 `updatedAt` 보다 정확한 동시 수정 감지  
> 2. **[P2] 감사 로그 비동기 분리**: 트랜잭션 밖 Fire-and-Forget로 처리  
> 3. **[P0] 캐시 무효화 태그 기반**: `invalidateCache(tag1, tag2)` 형태로 변경

---

### 7.4 계정 관리 (`/api/accounts`)

**목록/생성** — `src/app/api/accounts/route.ts`

| Method | 설명 | Request/Query | Response |
|--------|------|-------------|----------|
| `GET` | 네이버 광고 계정 목록 | `?status=connected` | `{ data: NaverAccount[] }` |
| `POST` | 계정 연동 추가 | `{ customerId, customerName, apiKey, secretKey }` | `{ account: NaverAccount }` |

**개별 조회/수정/삭제** — `src/app/api/accounts/[id]/route.ts`

| Method | 설명 | Request Body | Response |
|--------|------|-------------|----------|
| `GET` | 계정 상세 (캠페인 수, 월 지출 포함) | — | `{ account: NaverAccount & { _count } }` |
| `PUT` | 계정 정보 수정 | `{ customerName?, dailyBudget?, commissionRate? }` | `{ account: NaverAccount }` |
| `DELETE` | 계정 연동 해제 (소프트 삭제) | — | `{ success: true }` |

**연동 테스트** — `src/app/api/accounts/[id]/test/route.ts`

| Method | 설명 | Response |
|--------|------|----------|
| `POST` | API 키로 네이버 연동 테스트 | `{ connected: boolean, error?: string }` |

> **⚠️ 보안**: `apiKey`와 `secretKey`는 `ENCRYPTION_KEY`로 AES-256-GCM 암호화 후 저장 (§12.3 참조)

---

### 7.5 알림 (`/api/notifications`)

**목록** — `src/app/api/notifications/route.ts`

| Method | 설명 | Request/Query | Response |
|--------|------|-------------|----------|
| `GET` | 알림 목록 | `?unread=true&page=1&limit=20` | `{ data: Notification[], total, unreadCount }` |
| `PATCH` | 알림 읽음 처리 | `{ ids: string[] }` | `{ updated: number }` |
| `DELETE` | 알림 삭제 | `{ ids: string[] }` | `{ deleted: number }` |

**전체 읽음** — `src/app/api/notifications/read-all/route.ts`

| Method | 설명 | Response |
|--------|------|----------|
| `PATCH` | 모든 알림 읽음 처리 | `{ updated: number }` |

---

### 7.6 설정 (`/api/settings`)

**조직 설정** — `src/app/api/settings/route.ts`

| Method | 설명 | Request Body | Response |
|--------|------|-------------|----------|
| `GET` | 조직 설정 조회 | — | `{ organization: Organization }` |
| `PUT` | 조직 설정 수정 | `{ name?, businessNumber?, contactEmail?, maxAccounts? }` | `{ organization: Organization }` |

**멤버 관리** — `src/app/api/settings/members/route.ts`

| Method | 설명 | Request Body | Response |
|--------|------|-------------|----------|
| `GET` | 멤버 목록 | — | `{ members: User[] }` |
| `POST` | 멤버 초대 | `{ email, name, role }` | `{ user: User }` |

**개별 멤버** — `src/app/api/settings/members/[id]/route.ts`

| Method | 설명 | Request Body | Response |
|--------|------|-------------|----------|
| `PUT` | 역할 변경 | `{ role }` | `{ user: User }` |
| `DELETE` | 멤버 제거 | — | `{ success: true }` |

> **권한**: `owner`만 멤버 초대/삭제 가능, `admin`은 역할 변경만 가능

---

### 7.7 수익성 (`/api/profitability`)

**목록** — `src/app/api/profitability/route.ts`

| Method | 설명 | Request/Query | Response |
|--------|------|-------------|----------|
| `GET` | 수익성 목록 | `?period=2026-01&accountId=xxx` | `{ data: Profitability[], summary }` |
| `POST` | 수익성 데이터 입력 | `{ accountId, adSpend, agencyFee, backMargin, laborCost, period }` | `{ profitability: Profitability }` |

**자동 계산 로직:**
```typescript
// netProfit = agencyFee + backMargin - laborCost
// marginRate = netProfit / agencyFee
const netProfit = agencyFee + backMargin - laborCost;
const marginRate = agencyFee > 0 ? netProfit / agencyFee : 0;
```

---

### 7.8 보고서 (`/api/reports`)

**목록/생성** — `src/app/api/reports/route.ts`

| Method | 설명 | Request/Query | Response |
|--------|------|-------------|----------|
| `GET` | 보고서 목록 | `?page=1&limit=10` | `{ data: Report[], total }` |
| `POST` | 보고서 생성 | `{ templateId, title, periodStart, periodEnd }` | `{ report: Report }` |

**개별 조회** — `src/app/api/reports/[id]/route.ts`

| Method | 설명 | Response |
|--------|------|----------|
| `GET` | 보고서 상세 (데이터 집계 포함) | `{ report: Report, data: AggregatedKPI }` |
| `DELETE` | 보고서 삭제 | `{ success: true }` |

**발송** — `src/app/api/reports/[id]/send/route.ts`

| Method | 설명 | Request Body | Response |
|--------|------|-------------|----------|
| `POST` | 보고서 발송 (비동기 큐) | `{ recipients: string[] }` | `{ queued: true, estimatedDelivery: string }` |

> **[P1 개선] 비동기 전환**: 이메일 발송을 **Upstash QStash**로 비동기 처리. 기존 동기 방식은 다수 수신자 시 API 응답 지연 30초+ 발생 가능.
> ```typescript
> // POST /api/reports/[id]/send/route.ts
> import { Client } from '@upstash/qstash';
> const qstash = new Client({ token: process.env.QSTASH_TOKEN! });
>
> await qstash.publishJSON({
>   url: `${process.env.NEXTAUTH_URL}/api/workers/send-report`,
>   body: { reportId, recipients },
>   retries: 3,
> });
> return apiResponse({ queued: true, estimatedDelivery: '5분 이내' });
> ```

**템플릿** — `src/app/api/reports/templates/route.ts`

| Method | 설명 | Request/Query | Response |
|--------|------|-------------|----------|
| `GET` | 리포트 템플릿 목록 | — | `{ templates: ReportTemplate[] }` |
| `POST` | 템플릿 생성 | `{ name, kpiConfig, layoutConfig, scheduleType }` | `{ template: ReportTemplate }` |
| `PUT` | 템플릿 수정 | `{ id, name?, kpiConfig?, layoutConfig? }` | `{ template: ReportTemplate }` |

---

### 7.9 경쟁 분석 (`/api/competitive`)

**목록** — `src/app/api/competitive/route.ts`

| Method | 설명 | Request/Query | Response |
|--------|------|-------------|----------|
| `GET` | 경쟁 인텔리전스 목록 | `?keyword=변호사&page=1&limit=20` | `{ data: CompetitiveIntel[], total }` |
| `POST` | 경쟁 분석 요청 (비동기 큐) | `{ keywordTexts: string[], naverAccountId? }` | `{ queued: number, jobId: string }` |

> **[P1 개선] 비동기 처리**: 크롤링은 수초~수분 소요되므로 **QStash 백그라운드 워커**로 처리.
> ```typescript
> // POST 핸들러
> await qstash.publishJSON({
>   url: `${process.env.NEXTAUTH_URL}/api/workers/crawl-competitive`,
>   body: { keywordTexts, naverAccountId, organizationId },
>   retries: 2,
> });
> ```

**개별 조회** — `src/app/api/competitive/[id]/route.ts`

| Method | 설명 | Response |
|--------|------|----------|
| `GET` | 경쟁 분석 상세 (top5 광고, 입찰 추정가) | `{ intel: CompetitiveIntel }` |

---

### 7.10 자동화 (`/api/automation`)

**자동입찰 규칙** — `src/app/api/automation/rules/route.ts`

| Method | 설명 | Request/Query | Response |
|--------|------|-------------|----------|
| `GET` | 자동입찰 규칙 목록 | — | `{ rules: AutoBidRule[] }` |
| `POST` | 규칙 생성 | `{ keywordIds, strategy, targetRank?, maxBid?, schedule }` | `{ rule: AutoBidRule }` |
| `PUT` | 규칙 수정 | `{ id, strategy?, targetRank?, isActive? }` | `{ rule: AutoBidRule }` |

**실행 이력** — `src/app/api/automation/history/route.ts`

| Method | 설명 | Request/Query | Response |
|--------|------|-------------|----------|
| `GET` | 자동입찰 실행 이력 | `?page=1&limit=20` | `{ data: BidHistory[], total }` 여기서 `changedBy='ai'` 필터 |

> **⚠️ Phase 3 기능**: 현재는 규칙 CRUD만 구현. 실제 자동입찰 엔진은 Phase 3에서 스케줄러와 함께 구현

---

### 7.11 시뮬레이터 (`/api/simulator`)

**시뮬레이션 실행** — `src/app/api/simulator/route.ts`

| Method | 설명 | Request Body | Response |
|--------|------|-------------|----------|
| `POST` | 입찰 시뮬레이션 실행 | `{ keywordId, bidAmounts: int[], days: int }` | `{ results: SimulationResult[] }` |

**시뮬레이션 이력** — `src/app/api/simulator/history/route.ts`

| Method | 설명 | Request/Query | Response |
|--------|------|-------------|----------|
| `GET` | 이전 시뮬레이션 이력 | `?page=1&limit=10` | `{ data: SimulationHistory[] }` |

```typescript
// SimulationResult 타입
interface SimulationResult {
  bidAmount: number;
  estimatedRank: number;
  estimatedClicks: number;
  estimatedCost: number;
  estimatedConversions: number;
  estimatedRoas: number;
}
```

---

### 7.12 코파일럿/AI (`/api/copilot`)

**AI 추천** — `src/app/api/copilot/route.ts`

| Method | 설명 | Request Body | Response |
|--------|------|-------------|----------|
| `POST` | AI 추천 요청 | `{ type: AiActionType, context: {} }` | `{ recommendations: AiRecommendation[] }` |

**추천 승인/거절** — `src/app/api/copilot/[id]/route.ts`

| Method | 설명 | Request Body | Response |
|--------|------|-------------|----------|
| `PATCH` | 추천 승인/거절 | `{ isApproved: boolean }` | `{ actionLog: AiActionLog }` |

**AI 액션 이력** — `src/app/api/copilot/history/route.ts`

| Method | 설명 | Request/Query | Response |
|--------|------|-------------|----------|
| `GET` | AI 액션 이력 | `?type=bid_adjustment&page=1&limit=20` | `{ data: AiActionLog[], total }` |

> **⚠️ Phase 3 기능**: 현재는 CRUD만 구현. AI 엔진 / LLM 연동은 Phase 3에서

---

### 7.13 감사 로그 (`/api/audit-log`)

**조회** — `src/app/api/audit-log/route.ts`

| Method | 설명 | Request/Query | Response |
|--------|------|-------------|----------|
| `GET` | 감사 로그 조회 | `?page=1&limit=20&action=UPDATE&entityType=keyword` | `{ data: AuditLog[], total, page, limit }` |

**내보내기** — `src/app/api/audit-log/export/route.ts`

| Method | 설명 | Request/Query | Response |
|--------|------|-------------|----------|
| `GET` | 감사 로그 CSV 내보내기 | `?from=2026-01-01&to=2026-03-13` | `text/csv` 파일 다운로드 |

---

### 7.14 부정클릭 방지 (`/api/click-fraud`)

> 스키마 모델: `ClickFraudEvent`, `BlockedIp`, `ClickFraudDailySummary`

**대시보드 요약** — `src/app/api/click-fraud/route.ts`

| Method | 설명 | Request/Query | Response |
|--------|------|-------------|----------|
| `GET` | 부정클릭 대시보드 (일별 요약) | `?from=2026-03-01&to=2026-03-13&accountId=xxx` | `{ summary: ClickFraudDailySummary[], totals }` |

**이벤트 목록** — `src/app/api/click-fraud/events/route.ts`

| Method | 설명 | Request/Query | Response |
|--------|------|-------------|----------|
| `GET` | 부정클릭 이벤트 목록 | `?status=pending&page=1&limit=20` | `{ data: ClickFraudEvent[], total }` |

**이벤트 상태 변경** — `src/app/api/click-fraud/events/[id]/route.ts`

| Method | 설명 | Request Body | Response |
|--------|------|-------------|----------|
| `PATCH` | 부정클릭 확인/해제 | `{ status: 'confirmed' \| 'dismissed' }` | `{ event: ClickFraudEvent }` |

**차단 IP 관리** — `src/app/api/click-fraud/blocked-ips/route.ts`

| Method | 설명 | Request/Query | Response |
|--------|------|-------------|----------|
| `GET` | 차단 IP 목록 | `?active=true&page=1&limit=20` | `{ data: BlockedIp[], total }` |
| `POST` | IP 수동 차단 | `{ ipHash, naverAccountId, blockReason }` | `{ blockedIp: BlockedIp }` |

**차단 해제** — `src/app/api/click-fraud/blocked-ips/[id]/route.ts`

| Method | 설명 | Response |
|--------|------|----------|
| `DELETE` | IP 차단 해제 | `{ success: true }` |

**환불 요청** — `src/app/api/click-fraud/refund/route.ts`

| Method | 설명 | Request Body | Response |
|--------|------|-------------|----------|
| `POST` | 네이버 환불 요청 | `{ eventIds: string[], estimatedLoss }` | `{ requested: number }` |

---

### 7.15 구독/빌링 (`/api/subscription`)

> 스키마 모델: `Subscription`

**현재 구독** — `src/app/api/subscription/route.ts`

| Method | 설명 | Response |
|--------|------|----------|
| `GET` | 현재 구독 상태 조회 | `{ subscription: Subscription, plan: PlanDetails }` |

**플랜 변경** — `src/app/api/subscription/change/route.ts`

| Method | 설명 | Request Body | Response |
|--------|------|-------------|----------|
| `POST` | 플랜 업/다운그레이드 | `{ planType: PlanType }` | `{ subscription: Subscription }` |

**취소** — `src/app/api/subscription/cancel/route.ts`

| Method | 설명 | Response |
|--------|------|----------|
| `POST` | 구독 취소 | `{ subscription: Subscription, canceledAt }` |

**플랜 정보** — `src/app/api/subscription/plans/route.ts`

| Method | 설명 | Response |
|--------|------|----------|
| `GET` | 사용 가능한 플랜 목록 | `{ plans: PlanDetails[] }` |

```typescript
// PlanDetails 타입
interface PlanDetails {
  type: PlanType;
  name: string;
  monthlyPrice: number;
  maxAccounts: number;
  features: string[];
}

const PLANS: PlanDetails[] = [
  { type: 'personal', name: '개인', monthlyPrice: 0, maxAccounts: 1, features: ['기본 대시보드', '수동 입찰'] },
  { type: 'starter', name: '스타터', monthlyPrice: 49000, maxAccounts: 5, features: ['자동입찰', '리포트'] },
  { type: 'growth', name: '성장', monthlyPrice: 99000, maxAccounts: 20, features: ['AI 추천', '부정클릭 방지'] },
  { type: 'scale', name: '스케일', monthlyPrice: 199000, maxAccounts: 50, features: ['전용 매니저', 'API 액세스'] },
  { type: 'enterprise', name: '엔터프라이즈', monthlyPrice: 0, maxAccounts: 999, features: ['맞춤 견적', 'SLA'] },
];
```

> **⚠️ Phase 4 기능**: 실제 결제 연동 (토스페이먼츠)은 Phase 4에서 구현

---

### 7.16 광고그룹 및 소재 (`/api/ad-groups`, `/api/ads`)

> 스키마 모델: `AdGroup`, `Ad`

**광고그룹 목록** — `src/app/api/ad-groups/route.ts`

| Method | 설명 | Request/Query | Response |
|--------|------|-------------|----------|
| `GET` | 광고그룹 목록 | `?campaignId=xxx&page=1&limit=20` | `{ data: AdGroup[], total }` |

**광고그룹 상세** — `src/app/api/ad-groups/[id]/route.ts`

| Method | 설명 | Response |
|--------|------|----------|
| `GET` | 광고그룹 상세 (키워드, 소재 포함) | `{ adGroup: AdGroup & { keywords, ads } }` |
| `PUT` | 광고그룹 수정 | `{ name?, isActive?, dailyBudget? }` → `{ adGroup: AdGroup }` |

**소재 목록** — `src/app/api/ads/route.ts`

| Method | 설명 | Request/Query | Response |
|--------|------|-------------|----------|
| `GET` | 소재 목록 | `?adGroupId=xxx` | `{ data: Ad[] }` |

**소재 상세** — `src/app/api/ads/[id]/route.ts`

| Method | 설명 | Request Body | Response |
|--------|------|-------------|----------|
| `GET` | 소재 상세 | — | `{ ad: Ad }` |
| `PUT` | 소재 수정 | `{ title?, description?, landingUrl? }` | `{ ad: Ad }` |

> **참고**: AdGroup/Ad 데이터는 주로 네이버 API에서 동기화됩니다. 직접 생성은 네이버 API 연동 (Phase 2) 이후 활성화.

---

### 7.17 입찰이력 및 순위 (`/api/bid-history`, `/api/rank-snapshots`)

> 스키마 모델: `BidHistory`, `RankSnapshot`

**입찰 이력** — `src/app/api/bid-history/route.ts`

| Method | 설명 | Request/Query | Response |
|--------|------|-------------|----------|
| `GET` | 입찰 이력 조회 | `?keywordId=xxx&from=2026-03-01&to=2026-03-13&page=1&limit=50` | `{ data: BidHistory[], total }` |

**순위 스냅샷** — `src/app/api/rank-snapshots/route.ts`

| Method | 설명 | Request/Query | Response |
|--------|------|-------------|----------|
| `GET` | 순위 이력 조회 | `?keywordId=xxx&device=pc&from=2026-03-01` | `{ data: RankSnapshot[] }` |

> **참고**: 이 데이터는 주로 시스템에서 자동 생성됩니다. Phase 2 네이버 API 동기화 시 자동 기록.

---

## 8. 데이터 흐름: 하드코딩 → DB 전환

현재 프론트엔드의 하드코딩 데이터가 API로 교체되는 과정:

```
현재 (하드코딩):
  dashboard/page.tsx → const accounts = [{...}, {...}]  ← 정적 배열

전환 후 (API):
  dashboard/page.tsx → fetch('/api/dashboard') → Prisma → PostgreSQL
```

| 페이지 | 현재 데이터 소스 | 전환 후 | API |
|--------|---------------|--------|-----|
| 대시보드 KPI | `kpiByPeriod` 상수 | `prisma.campaign.aggregate()` | `GET /api/dashboard` |
| 계정 현황 | `accounts` 배열 | `prisma.naverAccount.findMany()` | `GET /api/accounts` |
| 캠페인 목록 | `campaignGroups` 상수 | `prisma.campaign.findMany()` | `GET /api/campaigns` |
| 키워드 테이블 | `keywordsRaw` 상수 | `prisma.keyword.findMany()` | `GET /api/keywords` |
| 알림 리스트 | `notifications` 배열 | `prisma.notification.findMany()` | `GET /api/notifications` |
| 설정 > 조직 | `localStorage` | `prisma.organization.findUnique()` | `GET /api/settings` |
| 설정 > 멤버 | `initialMembers` 상수 | `prisma.user.findMany()` | `GET /api/settings/members` |
| 감사 로그 | `activityLogs` 배열 | `prisma.auditLog.findMany()` | `GET /api/audit-log` |
| 로그인 | `DEMO_USERS` 배열 | `NextAuth + prisma.user` | `POST /api/auth/signin` |
| 수익성 | `profitData` 상수 | `prisma.profitability.findMany()` | `GET /api/profitability` |
| 보고서 | `reportList` 상수 | `prisma.report.findMany()` | `GET /api/reports` |
| 경쟁 분석 | `competitorData` 상수 | `prisma.competitiveIntel.findMany()` | `GET /api/competitive` |
| 자동화 규칙 | `automationRules` 상수 | `prisma.keyword.findMany({ isAutoManaged })` | `GET /api/automation/rules` |
| 시뮬레이터 | 계산 로직만 | `prisma.keyword + 시뮬레이션 엔진` | `POST /api/simulator` |
| AI 코파일럿 | — (미구현) | `prisma.aiActionLog + LLM` | `POST /api/copilot` |

---

## 9. DB 이전 절차 (Supabase → AWS RDS Seoul)

### Step 1: AWS RDS 인스턴스 생성
```bash
# AWS CLI 또는 콘솔에서 생성
# 리전: ap-northeast-2 (서울)
# 엔진: PostgreSQL 16
# 인스턴스: db.t3.micro (처음에는 ₩30,000/월)
```

### Step 2: 데이터 이전
```bash
# Supabase에서 덤프
pg_dump "postgresql://postgres.[프로젝트ID]:[비밀번호]@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres" \
  --no-owner --no-acl > backup.sql

# AWS RDS에 복원
psql "postgresql://admin:[비밀번호]@agency-os-db.xxxxx.ap-northeast-2.rds.amazonaws.com:5432/agencyos" \
  < backup.sql
```

### Step 3: 환경변수 변경 (이것만 하면 끝)
```diff
# .env
- DATABASE_URL="postgresql://postgres.xxx:비밀번호@aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true"
- DIRECT_URL="postgresql://postgres.xxx:비밀번호@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres"
+ DATABASE_URL="postgresql://admin:비밀번호@agency-os-db.xxxxx.ap-northeast-2.rds.amazonaws.com:5432/agencyos"
+ DIRECT_URL="postgresql://admin:비밀번호@agency-os-db.xxxxx.ap-northeast-2.rds.amazonaws.com:5432/agencyos"
```

### Step 4: 검증
```bash
npx prisma db pull   # RDS 스키마 확인
npm run build        # 빌드 정상 확인
```

**코드 변경: 0줄. 앱 재시작만 하면 완료.**

---

## 10. 파일 구조 요약

```
agency-os/
├── prisma/
│   ├── schema.prisma              # DB 스키마 (위 §5 전체 내용)
│   └── seed.ts                    # 초기 데이터 (§13 참조)
├── src/
│   ├── types/
│   │   └── next-auth.d.ts         # NextAuth 타입 확장 (§14.1 참조)
│   ├── lib/
│   │   ├── db.ts                  # Prisma Client 싱글톤
│   │   ├── auth.config.ts         # NextAuth.js 설정
│   │   ├── api-helpers.ts         # requireAuth, withErrorHandler, paginatedResponse
│   │   ├── validations.ts         # Zod 스키마 (§12.3 참조)
│   │   ├── encryption.ts          # AES-256-GCM 암호화/복호화 (§14.3 참조)
│   │   └── audit.ts               # 감사 로그 자동 기록 유틸
│   ├── middleware.ts              # 경로 보호 + Rate Limiting + 보안 헤더
│   ├── app/
│   │   └── api/
│   │       ├── auth/
│   │       │   ├── [...nextauth]/route.ts   # NextAuth 핸들러
│   │       │   └── signup/route.ts          # 회원가입
│   │       ├── dashboard/route.ts           # 대시보드 KPI
│   │       ├── accounts/                    # §7.4
│   │       │   ├── route.ts                 # 계정 목록/생성
│   │       │   └── [id]/
│   │       │       ├── route.ts             # 계정 조회/수정/삭제
│   │       │       └── test/route.ts        # 연동 테스트
│   │       ├── campaigns/                   # §7.2
│   │       │   ├── route.ts                 # 캠페인 목록/생성
│   │       │   └── [id]/route.ts            # 캠페인 조회/수정/삭제
│   │       ├── ad-groups/                   # §7.16
│   │       │   ├── route.ts                 # 광고그룹 목록
│   │       │   └── [id]/route.ts            # 광고그룹 상세/수정
│   │       ├── keywords/                    # §7.3
│   │       │   ├── route.ts                 # 키워드 목록/생성
│   │       │   ├── [id]/route.ts            # 키워드 조회/수정/삭제
│   │       │   └── bulk/route.ts            # 일괄 작업
│   │       ├── ads/                         # §7.16
│   │       │   ├── route.ts                 # 소재 목록
│   │       │   └── [id]/route.ts            # 소재 상세/수정
│   │       ├── bid-history/route.ts         # §7.17 입찰 이력
│   │       ├── rank-snapshots/route.ts      # §7.17 순위 스냅샷
│   │       ├── profitability/route.ts       # §7.7 수익성
│   │       ├── reports/                     # §7.8
│   │       │   ├── route.ts                 # 보고서 목록/생성
│   │       │   ├── [id]/
│   │       │   │   ├── route.ts             # 보고서 조회/삭제
│   │       │   │   └── send/route.ts        # 보고서 발송
│   │       │   └── templates/route.ts       # 템플릿 CRUD
│   │       ├── competitive/                 # §7.9
│   │       │   ├── route.ts                 # 경쟁 분석 목록/요청
│   │       │   └── [id]/route.ts            # 경쟁 상세
│   │       ├── automation/                  # §7.10
│   │       │   ├── rules/route.ts           # 자동입찰 규칙
│   │       │   └── history/route.ts         # 실행 이력
│   │       ├── simulator/                   # §7.11
│   │       │   ├── route.ts                 # 시뮬레이션 실행
│   │       │   └── history/route.ts         # 이력
│   │       ├── copilot/                     # §7.12
│   │       │   ├── route.ts                 # AI 추천
│   │       │   ├── [id]/route.ts            # 승인/거절
│   │       │   └── history/route.ts         # AI 이력
│   │       ├── click-fraud/                 # §7.14
│   │       │   ├── route.ts                 # 대시보드 요약
│   │       │   ├── events/
│   │       │   │   ├── route.ts             # 이벤트 목록
│   │       │   │   └── [id]/route.ts        # 상태 변경
│   │       │   ├── blocked-ips/
│   │       │   │   ├── route.ts             # 차단 IP 목록/추가
│   │       │   │   └── [id]/route.ts        # 차단 해제
│   │       │   └── refund/route.ts          # 환불 요청
│   │       ├── subscription/                # §7.15
│   │       │   ├── route.ts                 # 현재 구독 상태
│   │       │   ├── change/route.ts          # 플랜 변경
│   │       │   ├── cancel/route.ts          # 구독 취소
│   │       │   └── plans/route.ts           # 플랜 목록
│   │       ├── notifications/               # §7.5
│   │       │   ├── route.ts                 # 알림 목록/읽음
│   │       │   └── read-all/route.ts        # 전체 읽음
│   │       ├── settings/                    # §7.6
│   │       │   ├── route.ts                 # 조직 설정
│   │       │   └── members/
│   │       │       ├── route.ts             # 멤버 목록/초대
│   │       │       └── [id]/route.ts        # 멤버 수정/삭제
│   │       └── audit-log/                   # §7.13
│   │           ├── route.ts                 # 감사 로그 조회
│   │           └── export/route.ts          # CSV 내보내기
│   └── utils/
│       └── auth.ts                # [수정] NextAuth 연동으로 교체 (§15.3 참조)
└── .env                           # DATABASE_URL 등
```

---

## 11. Phase별 로드맵

| Phase | 내용 | 시기 |
|:-----:|------|:----:|
| **1 (지금)** | Prisma + NextAuth + API Routes + Seed | 이번 작업 |
| **2** | 네이버 검색광고 API 연동 | 다음 |
| **3** | AI 자동입찰 엔진 + 스케줄러 | Phase 2 이후 |
| **4** | 결제 + 알림 채널 | Phase 3 이후 |
| **이전** | DATABASE_URL 변경 → AWS RDS Seoul | 고객 확보 후 |

### Phase 1 상세 (현재)

| 작업 | 설명 | 파일 |
|------|------|------|
| Prisma 초기화 | `npx prisma init`, 스키마 작성 | `prisma/schema.prisma` |
| DB 마이그레이션 | `npx prisma migrate dev --name init` | `prisma/migrations/` |
| Prisma Client | 싱글톤 패턴 설정 | `src/lib/db.ts` |
| NextAuth 설정 | Credentials + JWT 전략 | `src/lib/auth.config.ts` |
| API Routes | 13개 라우트 그룹 구현 | `src/app/api/*/route.ts` |
| 시드 데이터 | 데모 조직/사용자/캠페인 | `prisma/seed.ts` |
| 프론트엔드 연동 | `fetch()` → API 호출로 교체 | 기존 page.tsx 파일들 |
| NextAuth 타입 | Session/JWT 타입 확장 | `src/types/next-auth.d.ts` |

### Phase 2 상세 (네이버 검색광고 API)

| 작업 | 설명 |
|------|------|
| HMAC-SHA256 인증 | 네이버 API 요청 시그니처 생성 (`X-Timestamp`, `X-API-KEY`, `X-Customer`, `X-Signature`) |
| API 래퍼 클래스 | `NaverAdApiClient` — 캠페인/키워드/입찰 API 래핑 |
| 동기화 전략 | 풀 동기화 (1일 1회) + 증분 동기화 (1시간마다), `lastSyncAt` 기준 |
| 에러 재시도 | 지수 백오프 (429 Too Many Requests → 1초, 2초, 4초 대기 후 재시도) |
| 연동 테스트 | `/api/accounts/[id]/test` 엔드포인트에서 실 API 호출 |

### Phase 3 상세 (AI 자동입찰)

| 작업 | 설명 |
|------|------|
| 스케줄러 | Vercel Cron (`vercel.json`) 또는 AWS EventBridge + Lambda |
| 입찰 알고리즘 | 목표 순위 도달까지 입찰가 자동 조정 (±10% 점진적 변경) |
| 이상 탐지 | 급격한 CPC 변동, CTR 이상 감지 → 알림 생성 |
| AI 추천 엔진 | 키워드 추천, 예산 최적화, 소재 제안 (Phase 3 후반) |

### Phase 4 상세 (결제 + 알림)

| 작업 | 설명 |
|------|------|
| 토스페이먼츠 | 정기결제 (빌링키), 웹훅으로 결제 상태 동기화 |
| 이메일 알림 | Resend 또는 AWS SES 연동. 리포트 발송, 이상 알림 |
| 슬랙 알림 | Slack Incoming Webhook으로 실시간 알림 전송 |
| 인앱 알림 | WebSocket (Pusher 또는 Ably) → 실시간 알림 UI |

---

## 12. 에러 핸들링 패턴

### 12.1 글로벌 에러 래퍼

```typescript
// src/lib/api-helpers.ts 에 추가
import { Prisma } from '@prisma/client';

// [P2 추가] Optimistic Locking 충돌 에러
export class ConflictError extends Error {
  constructor(entity = 'record') {
    super(`${entity}이(가) 다른 요청에 의해 이미 수정되었습니다. 다시 시도해주세요.`);
    this.name = 'ConflictError';
  }
}

// [P0 추가] 안전한 JSON 파싱 — 잘못된 JSON 본문 시 500 대신 400 반환
export async function safeParseBody(request: Request) {
  try {
    const data = await request.json();
    return { data, error: null };
  } catch {
    return { data: null, error: '잘못된 JSON 형식입니다.' };
  }
}

export async function withErrorHandler(
  handler: () => Promise<Response>
): Promise<Response> {
  try {
    return await handler();
  } catch (error) {
    // [리뷰 반영 A-1-9] 회원가입 이메일 중복 에러 매핑
    if (error instanceof Error && error.message === 'DUPLICATE_EMAIL') {
      return apiError('이미 사용 중인 이메일입니다.', 409);
    }

    // [P2] Optimistic Locking 충돌
    if (error instanceof ConflictError) {
      return apiError(error.message, 409);
    }

    // Prisma 에러 처리
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      switch (error.code) {
        case 'P2002': // Unique constraint violation
          return apiError('이미 존재하는 데이터입니다.', 409);
        case 'P2025': // Record not found
          return apiError('데이터를 찾을 수 없습니다.', 404);
        case 'P2003': // Foreign key constraint failure
          return apiError('참조하는 데이터가 존재하지 않습니다.', 400);
        default:
          console.error(`Prisma Error [${error.code}]:`, error.message);
          return apiError('데이터베이스 오류', 500);
      }
    }
    
    // Prisma 유효성 검사 에러
    if (error instanceof Prisma.PrismaClientValidationError) {
      return apiError('잘못된 데이터 형식입니다.', 400);
    }
    
    // 일반 에러
    console.error('Unhandled Error:', error);
    return apiError('서버 내부 오류가 발생했습니다.', 500);
  }
}
```

### 12.2 API Route에서의 사용 패턴

```typescript
// src/app/api/campaigns/route.ts
export async function GET() {
  return withErrorHandler(async () => {
    const { user, error } = await requireAuth();
    if (error) return error;

    const campaigns = await prisma.campaign.findMany({
      where: { organizationId: user!.organizationId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
    });

    return apiResponse({ data: campaigns });
  });
}
```

### 12.3 입력 유효성 검사 (Zod)

```bash
npm install zod
```

```typescript
// src/lib/validations.ts
import { z } from 'zod';

export const createCampaignSchema = z.object({
  naverAccountId: z.string().uuid('유효하지 않은 계정 ID'),
  name: z.string().min(1, '이름은 필수입니다').max(255),
  status: z.enum(['active', 'paused', 'draft']).default('draft'),
  dailyBudget: z.number().int().positive('예산은 0보다 커야 합니다').optional(),
  campaignType: z.enum(['WEB_SITE', 'SHOPPING', 'BRAND_SEARCH', 'PERFORMANCE_MAX']).optional(),
});

export const updateBidSchema = z.object({
  newBid: z.number().int().min(70, '최소 입찰가는 70원입니다').max(100000),
  reason: z.string().max(500).optional(),
});

export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

// 사용 예
export function validateBody<T>(schema: z.Schema<T>, data: unknown) {
  const result = schema.safeParse(data);
  if (!result.success) {
    const errors = result.error.issues.map(i => `${i.path.join('.')}: ${i.message}`);
    return { data: null, error: errors.join(', ') };
  }
  return { data: result.data, error: null };
}
```

---

## 13. 시드 데이터

```typescript
// prisma/seed.ts
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

// [P2 추가] 프로덕션 환경 시드 실행 방지
if (process.env.NODE_ENV === 'production') {
  console.error('❌ 프로덕션 환경에서는 시드를 실행할 수 없습니다.');
  process.exit(1);
}

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 시드 데이터 생성 시작...');

  // 1. 조직
  const org = await prisma.organization.upsert({
    where: { id: 'org-demo-001' },
    update: {},
    create: {
      id: 'org-demo-001',
      name: '안티그래비티 마케팅',
      planType: 'growth',
      maxAccounts: 10,
      contactEmail: 'admin@agency.com',
    },
  });

  // 2. 사용자
  const passwordHash = await bcrypt.hash('password', 12);
  
  const owner = await prisma.user.upsert({
    where: { email: 'admin@agency.com' },
    update: {},
    create: {
      id: 'user-owner-001',
      email: 'admin@agency.com',
      passwordHash,
      name: '김대행',
      role: 'owner',
      organizationId: org.id,
    },
  });

  await prisma.user.upsert({
    where: { email: 'lee@agency.com' },
    update: {},
    create: {
      id: 'user-admin-001',
      email: 'lee@agency.com',
      passwordHash,
      name: '이마케터',
      role: 'admin',
      organizationId: org.id,
    },
  });

  // 3. 네이버 광고 계정 (API 키는 빈 값 — 실제 연동 전)
  const account = await prisma.naverAccount.upsert({
    where: { id: 'naver-acc-001' },
    update: {},
    create: {
      id: 'naver-acc-001',
      organizationId: org.id,
      customerId: 'demo-customer-001',
      customerName: '데모 광고주 A',
      apiKeyEncrypted: '',
      secretKeyEncrypted: '',
      connectionStatus: 'disconnected',
      dailyBudget: 500000,
    },
  });

  // 4. 캠페인 (3개)
  const campaigns = await Promise.all([
    prisma.campaign.upsert({
      where: { id: 'camp-001' },
      update: {},
      create: {
        id: 'camp-001',
        naverAccountId: account.id,
        organizationId: org.id,
        naverCampaignId: 'naver-camp-001',
        name: '브랜드 키워드 캠페인',
        status: 'active',
        campaignType: 'WEB_SITE',
        dailyBudget: 200000,
        totalCost: 1500000,
        impressions: 50000,
        clicks: 2500,
        conversions: 150,
      },
    }),
    prisma.campaign.upsert({
      where: { id: 'camp-002' },
      update: {},
      create: {
        id: 'camp-002',
        naverAccountId: account.id,
        organizationId: org.id,
        naverCampaignId: 'naver-camp-002',
        name: '일반 키워드 캠페인',
        status: 'active',
        campaignType: 'WEB_SITE',
        dailyBudget: 300000,
        totalCost: 2800000,
        impressions: 120000,
        clicks: 6000,
        conversions: 300,
      },
    }),
  ]);

  // 5. 광고그룹
  const adGroup = await prisma.adGroup.upsert({
    where: { id: 'adgroup-001' },
    update: {},
    create: {
      id: 'adgroup-001',
      campaignId: campaigns[0].id,
      organizationId: org.id,
      naverAdGroupId: 'naver-ag-001',
      name: '브랜드 키워드 그룹',
    },
  });

  // 6. 키워드 (5개)
  const keywordData = [
    { id: 'kw-001', text: '변호사 상담', bid: 3500, rank: 2, strategy: 'target_rank' as const },
    { id: 'kw-002', text: '법률 사무소', bid: 2800, rank: 3, strategy: 'target_cpc' as const },
    { id: 'kw-003', text: '이혼 전문 변호사', bid: 5200, rank: 1, strategy: 'target_rank' as const },
    { id: 'kw-004', text: '형사 변호사', bid: 4100, rank: 4, strategy: 'manual' as const },
    { id: 'kw-005', text: '상속 변호사', bid: 2200, rank: 5, strategy: 'manual' as const },
  ];

  for (const kw of keywordData) {
    await prisma.keyword.upsert({
      where: { id: kw.id },
      update: {},
      create: {
        id: kw.id,
        adGroupId: adGroup.id,
        organizationId: org.id,
        naverKeywordId: `naver-${kw.id}`,
        keywordText: kw.text,
        currentBid: kw.bid,
        targetRank: kw.rank,
        bidStrategy: kw.strategy,
        matchType: 'exact',
        impressions: Math.floor(Math.random() * 10000),
        clicks: Math.floor(Math.random() * 500),
        conversions: Math.floor(Math.random() * 50),
      },
    });
  }

  // 7. 알림 샘플
  await prisma.notification.createMany({
    data: [
      {
        userId: owner.id,
        organizationId: org.id,
        type: 'bid_change',
        priority: 'normal',
        title: '입찰가 자동 조정',
        message: '"변호사 상담" 키워드 입찰가가 3,200원 → 3,500원으로 조정되었습니다.',
      },
      {
        userId: owner.id,
        organizationId: org.id,
        type: 'budget_alert',
        priority: 'high',
        title: '일일 예산 80% 도달',
        message: '브랜드 키워드 캠페인의 일일 예산 소진율이 80%에 도달했습니다.',
      },
    ],
    skipDuplicates: true,
  });

  console.log('✅ 시드 데이터 생성 완료!');
  console.log(`   조직: ${org.name}`);
  console.log(`   사용자: 2명 (admin@agency.com / lee@agency.com, 비밀번호: password)`);
  console.log(`   캠페인: ${campaigns.length}개, 키워드: ${keywordData.length}개`);
}

main()
  .catch((e) => {
    console.error('❌ 시드 실패:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
```

```bash
# 시드 실행
npx prisma db seed
```

---

## 14. 보안 및 유틸리티

### 14.1 NextAuth 타입 확장

```typescript
// src/types/next-auth.d.ts
import 'next-auth';

declare module 'next-auth' {
  interface User {
    role: string;
    organizationId: string;
    // [P2] organizationName 제거 — JWT에 민감데이터 최소화
  }

  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      role: string;
      organizationId: string;
      // [P2] organizationName은 필요 시 /api/settings로 조회
    };
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string;
    role: string;
    organizationId: string;
    // [P2] organizationName 제거
  }
}
```

### 14.2 역할 기반 접근 제어 (RBAC)

```typescript
// src/lib/api-helpers.ts 에 추가
type Role = 'owner' | 'admin' | 'editor' | 'viewer';

const ROLE_HIERARCHY: Record<Role, number> = {
  owner: 4,
  admin: 3,
  editor: 2,
  viewer: 1,
};

export async function requireRole(minRole: Role) {
  const { user, error } = await requireAuth();
  if (error) return { user: null, error };

  const userLevel = ROLE_HIERARCHY[user!.role as Role] || 0;
  const requiredLevel = ROLE_HIERARCHY[minRole];

  if (userLevel < requiredLevel) {
    return {
      user: null,
      error: apiError(`최소 ${minRole} 권한이 필요합니다.`, 403),
    };
  }
  return { user, error: null };
}

// 사용 예:
// const { user, error } = await requireRole('admin');
// if (error) return error;
```

### 14.3 API 키 암호화

```typescript
// src/lib/encryption.ts
import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const KEY = Buffer.from(process.env.ENCRYPTION_KEY!, 'hex'); // 64자 hex → 32바이트

export function encrypt(text: string): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, KEY, iv);
  
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const authTag = cipher.getAuthTag().toString('hex');
  
  // iv:authTag:encrypted 형식으로 저장
  return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

export function decrypt(encryptedText: string): string {
  const [ivHex, authTagHex, encrypted] = encryptedText.split(':');
  
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const decipher = crypto.createDecipheriv(ALGORITHM, KEY, iv);
  decipher.setAuthTag(authTag);
  
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}
```

### 14.4 소프트 삭제 패턴

```typescript
// 삭제 시 — deletedAt 필드 설정
export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  return withErrorHandler(async () => {
    const { user, error } = await requireAuth();
    if (error) return error;

    await prisma.campaign.update({
      where: { id: params.id, organizationId: user!.organizationId },
      data: { deletedAt: new Date() },
    });

    return apiResponse({ success: true });
  });
}

// 조회 시 — deletedAt: null 필터를 항상 포함
// 모든 findMany/findFirst 쿼리에 적용:
prisma.campaign.findMany({
  where: { organizationId: orgId, deletedAt: null },
});
```

### 14.5 페이지네이션 표준 응답

```typescript
// src/lib/api-helpers.ts 에 추가
export function paginatedResponse<T>(
  data: T[],
  total: number,
  page: number,
  limit: number,
) {
  return NextResponse.json({
    data,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      hasNext: page * limit < total,
      hasPrev: page > 1,
    },
  });
}
```

### 14.6 감사 로그 자동 기록 유틸

```typescript
// src/lib/audit.ts
import prisma from './db';
import { AuditAction } from '@prisma/client';

interface AuditParams {
  userId?: string;
  organizationId: string;
  action: AuditAction;
  entityType: string;
  entityId?: string;
  oldValues?: Record<string, unknown>;
  newValues?: Record<string, unknown>;
  ipAddress?: string;
}

export async function createAuditLog(params: AuditParams) {
  return prisma.auditLog.create({
    data: {
      ...params,
      expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90일 후 만료
    },
  });
}

/**
 * [P2 추가] 비동기 감사 로그 기록 (Fire-and-Forget)
 * ─ 트랜잭션 밖에서 호출하여 감사 로그 실패가 비즈니스 로직에 영향을 주지 않습니다.
 */
export async function createAuditLogAsync(params: AuditParams): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        ...params,
        expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
      },
    });
  } catch (e) {
    console.warn('[AuditLog] async write failed:', e);
  }
}

// 사용 예:
// 트랜잭션 내부에서 사용 시: await createAuditLog({ ... })
// 트랜잭션 외부(Fire-and-Forget): createAuditLogAsync({ ... }).catch(console.warn)
```

---

## 15. 프론트엔드 마이그레이션 가이드

현재 프론트엔드는 하드코딩 데이터를 사용합니다. API 연동 시 아래 패턴으로 교체합니다.

### 15.1 교체 패턴

**BEFORE (하드코딩):**
```typescript
// src/app/dashboard/page.tsx
const accounts = [
  { id: '1', name: '데모 광고주 A', spend: 1500000 },
  { id: '2', name: '데모 광고주 B', spend: 2800000 },
];

export default function DashboardPage() {
  return <AccountList accounts={accounts} />;
}
```

**AFTER (API 연동 — Server Component, [P2 개선] 직접 쿼리):**
```typescript
// src/app/dashboard/page.tsx
// ⚠️ [P2] Server Component에서 자기 서버 API를 HTTP로 호출하는 것은 안티 패턴입니다.
// → 네트워크 라운드트립, 쿠키 전달 복잡도, Cold Start 병목을 유발합니다.
// → Prisma 쿼리 함수를 직접 import해서 사용하세요.
import { auth } from '@/lib/auth.config';
import { redirect } from 'next/navigation';
import prisma from '@/lib/db';
import { cachedQuery } from '@/lib/cache';

async function getDashboardData(orgId: string) {
  // ✅ [P2] Prisma를 직접 호출 — HTTP 라운드트립 없음
  return cachedQuery(`dashboard:${orgId}`, 60, async () => {
    const [campaignKPI, keywordCount] = await Promise.all([
      prisma.$queryRaw`
        SELECT COUNT(*) AS active, COALESCE(SUM(clicks), 0) AS clicks
        FROM campaigns
        WHERE organization_id = ${orgId} AND deleted_at IS NULL AND status = 'active'
      `,
      prisma.keyword.count({ where: { organizationId: orgId, deletedAt: null } }),
    ]);
    return { campaignKPI, keywordCount };
  }, ['dashboard:' + orgId]);
}

export default async function DashboardPage() {
  const session = await auth();
  if (!session) redirect('/login');

  const kpi = await getDashboardData(session.user.organizationId);
  return <DashboardView kpi={kpi} />;
}
```

**AFTER (API 연동 — Client Component with SWR):**
```typescript
// src/app/dashboard/keywords/page.tsx
'use client';
import useSWR from 'swr';

const fetcher = (url: string) => fetch(url).then(r => r.json());

export default function KeywordsPage() {
  const { data, error, isLoading, mutate } = useSWR('/api/keywords?page=1&limit=50', fetcher);

  if (isLoading) return <Skeleton />;
  if (error) return <ErrorMessage />;

  return (
    <KeywordTable 
      keywords={data.data} 
      pagination={data.pagination}
      onBidChange={async (id, newBid) => {
        await fetch(`/api/keywords/${id}`, {
          method: 'PUT',
          body: JSON.stringify({ newBid, reason: '수동 변경' }),
        });
        mutate();  // 데이터 갱신
      }}
    />
  );
}
```

### 15.2 마이그레이션 순서 (권장)

| 순서 | 페이지 | 난이도 | 이유 |
|:---:|--------|:---:|------|
| 1 | 로그인/회원가입 | ★☆☆ | NextAuth 교체만 하면 됨 |
| 2 | 설정 (조직/멤버) | ★☆☆ | 단순 CRUD |
| 3 | 대시보드 KPI | ★★☆ | 읽기 전용, aggregate 쿼리 |
| 4 | 감사 로그 | ★☆☆ | 읽기 전용, 페이지네이션 |
| 5 | 알림 | ★★☆ | 읽기 + 상태 변경 |
| 6 | 캠페인 목록 | ★★☆ | CRUD + 필터 |
| 7 | 키워드 관리 | ★★★ | CRUD + 입찰가 변경 + 이력 |
| 8 | 수익성 | ★★☆ | 자동 계산 로직 |
| 9 | 보고서 | ★★★ | 템플릿 + 발송 |
| 10 | 경쟁 분석 | ★★☆ | 읽기 + 크롤링 요청 |
| 11 | 시뮬레이터 | ★★☆ | 시뮬레이션 엔진 연동 |
| 12 | 자동화 | ★★★ | Phase 3 스케줄러 필요 |
| 13 | 코파일럿 | ★★★ | Phase 3 AI 엔진 필요 |

### 15.3 `src/utils/auth.ts` 마이그레이션

현재 `src/utils/auth.ts`는 데모용 localStorage 인증입니다. NextAuth 교체 시:

```diff
// src/utils/auth.ts — 교체할 내용

- import { login as localLogin, logout as localLogout, getCurrentUser } from './auth';
+ import { signIn, signOut } from 'next-auth/react';
+ import { useSession } from 'next-auth/react';

// 로그인
- const result = localLogin(email, password);
+ const result = await signIn('credentials', { email, password, redirect: false });

// 로그아웃  
- localLogout();
+ await signOut({ callbackUrl: '/login' });

// 현재 사용자
- const user = getCurrentUser();
+ const { data: session } = useSession();
+ const user = session?.user;
```

**필요한 래퍼 설정:**
```typescript
// src/app/layout.tsx — SessionProvider 추가
import { SessionProvider } from 'next-auth/react';

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <SessionProvider>{children}</SessionProvider>
      </body>
    </html>
  );
}
```

---

## 16. 첫 배포 체크리스트

### Phase 1 배포 전 필수 확인

```bash
# ──── 1. 패키지 설치 ────
npm install prisma @prisma/client next-auth@5 bcryptjs zod
npm install -D @types/bcryptjs

# ──── 2. 환경변수 설정 ────
cp .env.example .env
# DATABASE_URL, DIRECT_URL, NEXTAUTH_URL, NEXTAUTH_SECRET, ENCRYPTION_KEY 설정

# ──── 3. Prisma 초기화 ────
npx prisma generate        # Prisma Client 생성
npx prisma migrate dev --name init  # 마이그레이션 실행
npx prisma db seed          # 시드 데이터 투입

# ──── 4. 빌드 확인 ────
npm run build              # 빌드 에러 없는지 확인
npm run dev                # 개발 서버 실행하여 테스트
```

### 배포 환경별 체크리스트

| 항목 | 개발 (로컬) | 스테이징 | 프로덕션 |
|------|:---:|:---:|:---:|
| `DATABASE_URL` | Supabase 도쿄 | Supabase 도쿄 | **AWS RDS 서울** |
| `NEXTAUTH_SECRET` | 아무 문자열 | 랜덤 생성 | **랜덤 생성 (고유값)** |
| `ENCRYPTION_KEY` | 아무 64자 Hex | 랜덤 생성 | **랜덤 생성 (보관 필수)** |
| `NEXTAUTH_URL` | `http://localhost:3000` | 스테이징 URL | **프로덕션 URL** |
| Rate Limiting | 인메모리 | 인메모리 | **Redis (Upstash)** |
| 로깅 | `console.log` | `console.log` | **외부 서비스 (Sentry 등)** |
| 시드 데이터 | ✅ 필요 | ✅ 필요 | ❌ 불필요 |

### 환경변수 생성 스크립트

```bash
# NEXTAUTH_SECRET 생성
openssl rand -base64 32

# ENCRYPTION_KEY 생성 (64자리 hex)
openssl rand -hex 32
```

### package.json 스크립트 추가

```jsonc
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint",
    "db:generate": "prisma generate",
    "db:migrate": "prisma migrate dev",
    "db:migrate:deploy": "prisma migrate deploy",  // 프로덕션 마이그레이션
    "db:seed": "prisma db seed",
    "db:studio": "prisma studio",                   // DB GUI 브라우저
    "db:reset": "prisma migrate reset"               // DB 초기화 (개발용)
  }
}
```

---

## 17. 모델-API 매핑 전체 요약

| # | Prisma 모델 | API 경로 | §참조 |
|:-:|------------|----------|:-----:|
| 1 | `Organization` | `/api/settings` | §7.6 |
| 2 | `User` | `/api/settings/members`, `/api/auth` | §7.6 |
| 3 | `Subscription` | `/api/subscription` | §7.15 |
| 4 | `NaverAccount` | `/api/accounts` | §7.4 |
| 5 | `Campaign` | `/api/campaigns` | §7.2 |
| 6 | `AdGroup` | `/api/ad-groups` | §7.16 |
| 7 | `Keyword` | `/api/keywords` | §7.3 |
| 8 | `Ad` | `/api/ads` | §7.16 |
| 9 | `BidHistory` | `/api/bid-history` | §7.17 |
| 10 | `RankSnapshot` | `/api/rank-snapshots` | §7.17 |
| 11 | `Profitability` | `/api/profitability` | §7.7 |
| 12 | `ReportTemplate` | `/api/reports/templates` | §7.8 |
| 13 | `Report` | `/api/reports` | §7.8 |
| 14 | `CompetitiveIntel` | `/api/competitive` | §7.9 |
| 15 | `Notification` | `/api/notifications` | §7.5 |
| 16 | `AiActionLog` | `/api/copilot` | §7.12 |
| 17 | `AuditLog` | `/api/audit-log` | §7.13 |
| 18 | `ClickFraudEvent` | `/api/click-fraud/events` | §7.14 |
| 19 | `BlockedIp` | `/api/click-fraud/blocked-ips` | §7.14 |
| 20 | `ClickFraudDailySummary` | `/api/click-fraud` | §7.14 |

> ✅ **21개 Prisma 모델 전체에 대응하는 API가 정의되었습니다.**

---

## 18. 캐싱 전략

> **원칙**: 모든 읽기 API는 Redis 캐싱을 검토하고, 모든 쓰기 API는 관련 캐시를 무효화한다.

### 18.1 캐싱 유틸리티

```typescript
// src/lib/cache.ts
import { Redis } from '@upstash/redis';
import crypto from 'crypto';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_URL!,
  token: process.env.UPSTASH_REDIS_TOKEN!,
});

// ──── [P0] 캐시 키 해시 유틸리티 ────
// 쿼리 파라미터 순서에 상관없이 동일한 캐시 키 생성
export function cacheKey(prefix: string, params: Record<string, unknown>): string {
  const sorted = Object.keys(params).sort().reduce((acc, key) => {
    acc[key] = params[key];
    return acc;
  }, {} as Record<string, unknown>);
  const hash = crypto.createHash('md5').update(JSON.stringify(sorted)).digest('hex').slice(0, 12);
  return `${prefix}:${hash}`;
}

/**
 * 캐시된 쿼리 실행. 캐시 히트 시 DB를 건드리지 않음.
 * @param key - 캐시 키 (예: `dashboard:org-001`)
 * @param ttlSeconds - TTL (초)
 * @param queryFn - 캐시 미스 시 실행할 쿼리 함수
 * @param tags - [P0 추가] 무효화 태그 (예: ['campaigns:org-001', 'dashboard:org-001'])
 */
export async function cachedQuery<T>(
  key: string,
  ttlSeconds: number,
  queryFn: () => Promise<T>,
  tags?: string[],
): Promise<T> {
  try {
    const cached = await redis.get<T>(key);
    if (cached !== null && cached !== undefined) return cached;
  } catch (e) {
    // Redis 장애 시 DB로 폴백 (가용성 우선)
    console.warn('Redis cache read failed, falling back to DB:', e);
  }

  // [리뷰 반영 A-1-5] Mutex Lock으로 Cache Stampede (Thundering Herd) 방지
  // → 캐시 만료 직후 동시 20개 요청이 모두 DB를 때리는 문제 차단
  const lockKey = `lock:${key}`;
  let acquired = false;
  try {
    acquired = !!(await redis.set(lockKey, '1', { ex: 10, nx: true }));
  } catch (e) {
    console.warn('Redis lock failed, falling back to direct query:', e);
  }

  if (!acquired) {
    // Lock 미획득 → 짧은 대기 후 캐시 재확인 (Spin Wait, 최대 3회)
    for (let retry = 0; retry < 3; retry++) {
      await new Promise(r => setTimeout(r, 200));
      try {
        const cached = await redis.get<T>(key);
        if (cached !== null && cached !== undefined) return cached;
      } catch { /* 폴백 */ }
    }
  }

  // Lock 획득 또는 Spin Wait 실패 → DB 직접 쿼리
  const result = await queryFn();

  try {
    await redis.set(key, result, { ex: ttlSeconds });
    // [P0] 태그별 SET에 키 등록 → 나중에 태그로 일괄 무효화 가능
    if (tags?.length) {
      const pipeline = redis.pipeline();
      for (const tag of tags) {
        pipeline.sadd(`tag:${tag}`, key);
        pipeline.expire(`tag:${tag}`, ttlSeconds * 2);  // 태그 SET TTL = 캐시 TTL × 2
      }
      await pipeline.exec();
    }
  } catch (e) {
    console.warn('Redis cache write failed:', e);
  } finally {
    // [리뷰 반영 A-1-5] Lock 해제
    if (acquired) {
      try { await redis.del(lockKey); } catch { /* 무시 */ }
    }
  }

  return result;
}

/**
 * [P0 개선] 태그 기반 캐시 무효화.
 * ⚠️ 기존 KEYS 명령(O(N) 전체 스캔, Redis 블로킹) 제거 → 태그 SET 기반으로 교체
 * @param tags - 무효화할 태그 목록 (예: ['campaigns:org-001', 'dashboard:org-001'])
 */
export async function invalidateCache(...tags: string[]): Promise<void> {
  try {
    const pipeline = redis.pipeline();
    const allKeys: string[] = [];

    // 1. 각 태그의 SET에서 관련 캐시 키 조회
    for (const tag of tags) {
      const keys = await redis.smembers(`tag:${tag}`);
      allKeys.push(...keys, `tag:${tag}`);
    }

    // 2. 조회된 키 + 태그 SET 일괄 삭제
    if (allKeys.length > 0) {
      pipeline.del(...allKeys);
    }

    await pipeline.exec();
  } catch (e) {
    console.warn('Cache invalidation failed:', e);
  }
}

/**
 * [P0 추가] 단일 키 직접 삭제 (태그 없는 간단한 캐시용)
 */
export async function deleteCache(key: string): Promise<void> {
  try {
    await redis.del(key);
  } catch (e) {
    console.warn('Cache delete failed:', e);
  }
}
```

### 18.2 캐싱 정책

```
캐싱 계층:
  ┌─ L1: Next.js Route Cache (ISR) ────── 정적 페이지 (로그인, 소개 등)
  ├─ L2: Redis (Upstash) ──────────────── KPI, 목록 데이터
  └─ L3: PostgreSQL ───────────────────── 원본 데이터 (Single Source of Truth)
```

| API 엔드포인트 | TTL | 캐시 키 패턴 | 비고 |
|--------------|:---:|------------|------|
| `GET /api/dashboard` | 60초 | `dashboard:{orgId}` | 읽기 전용 KPI |
| `GET /api/campaigns` | 30초 | `campaigns:{orgId}:{queryHash}` | 필터/정렬 포함 |
| `GET /api/keywords` | 15초 | `keywords:{orgId}:{queryHash}` | 실시간 입찰 반영 필요 |
| `GET /api/settings` | 300초 | `settings:{orgId}` | 거의 변경 안 됨 |
| `GET /api/notifications` | ❌ | — | 실시간성 필요 |
| `GET /api/audit-log` | ❌ | — | 정확 데이터 필요 |

### 18.3 무효화 트리거

| 쓰기 API | 무효화 대상 캐시 |
|---------|---------------|
| `POST/PUT/DELETE /api/campaigns/*` | `dashboard:{orgId}`, `campaigns:{orgId}:*` |
| `PUT /api/keywords/*`, `PATCH /api/keywords/bulk` | `dashboard:{orgId}`, `keywords:{orgId}:*` |
| `PUT /api/settings` | `settings:{orgId}` |
| `POST /api/accounts` | `dashboard:{orgId}` |

> **⚠️ 장애 격리**: Redis 장애 시 `cachedQuery`는 자동으로 DB 직접 쿼리로 폴백합니다. 캐시는 성능 최적화 도구이지 **필수 의존성이 아닙니다.**

---

## 19. 동시성 제어 표준 패턴

### 19.1 Optimistic Locking (단일 엔티티 수정)

동일 엔티티에 대한 동시 수정(Lost Update)을 방지합니다.

```typescript
// src/lib/concurrency.ts
import { Prisma } from '@prisma/client';

/**
 * Optimistic Locking: updatedAt 비교로 동시 수정을 감지.
 * 다른 요청이 먼저 수정했다면 count=0 → ConflictError 발생.
 */
export class ConflictError extends Error {
  constructor(entity = 'record') {
    super(`${entity}이(가) 다른 요청에 의해 이미 수정되었습니다. 다시 시도해주세요.`);
    this.name = 'ConflictError';
  }
}

// withErrorHandler에 추가할 에러 분기
// if (error instanceof ConflictError) {
//   return apiError(error.message, 409);
// }
```

**적용 대상**:

| API | 패턴 | 이유 |
|-----|------|------|
| `PUT /api/keywords/[id]` | `updateMany` + `version` 조건 | 동시 입찰 변경 |
| `POST /api/subscription/change` | `updateMany` + `version` 조건 | 플랜 동시 변경 |
| Phase 3 자동입찰 | Advisory Lock + ID 정렬 | 다수 키워드 동시 처리 |

### 19.2 벌크 작업 트랜잭션

일괄 작업에서 부분 실패를 방지합니다.

```typescript
// PATCH /api/keywords/bulk — 일괄 입찰가 변경
export async function PATCH(req: Request) {
  return withErrorHandler(async () => {
    const { user, error } = await requireAuth();
    if (error) return error;

    // [P0] safeParseBody로 JSON 파싱 독립
    const { data: body, error: parseError } = await safeParseBody(req);
    if (parseError) return apiError(parseError, 400);
    const { ids, newBid, reason } = body;

    // [P2 개선] 배치 분할 트랜잭션 — 100개 이상일 때 커넥션 풀 고갈 방지
    const BATCH_SIZE = 50;
    const sortedIds = [...ids].sort();
    let totalUpdated = 0;

    for (let i = 0; i < sortedIds.length; i += BATCH_SIZE) {
      const batch = sortedIds.slice(i, i + BATCH_SIZE);

      const updated = await prisma.$transaction(async (tx) => {
        // [P2 개선] N+1 제거: findMany로 한 번에 조회
        const keywords = await tx.keyword.findMany({
          where: {
            id: { in: batch },
            organizationId: user!.organizationId,
            deletedAt: null,
          },
          orderBy: { id: 'asc' },  // 데드락 방지
        });

        if (keywords.length === 0) return 0;

        // [리뷰 반영 B-2-1] Raw SQL 단일 UPDATE — 개별 updateMany 루프(N회 RTT) 제거
        // → 모든 키워드가 동일한 newBid로 변경되므로 단일 쿼리로 처리
        const batchIds = keywords.map(kw => kw.id);
        const orgId = user!.organizationId;
        await tx.$executeRaw`
          UPDATE keywords 
          SET current_bid = ${newBid}, version = version + 1, updated_at = NOW()
          WHERE id = ANY(${batchIds}::uuid[]) 
            AND organization_id = ${orgId}::uuid AND deleted_at IS NULL
        `;

        // [P2 개선] createMany로 이력 일괄 삽입 (N회 → 1회)
        await tx.bidHistory.createMany({
          data: keywords.map(kw => ({
            keywordId: kw.id,
            organizationId: user!.organizationId,
            oldBid: kw.currentBid,
            newBid,
            reason: reason || '일괄 변경',
            changedBy: 'manual' as const,
          })),
        });

        return keywords.length;
      }, {
        timeout: 15000,  // 배치당 15초 (총 30초에서 배치당으로 축소)
      });

      totalUpdated += updated;
    }

    // [P0] 존 태그 기반 캐시 무효화
    await invalidateCache(
      `dashboard:${user!.organizationId}`,
      `keywords:${user!.organizationId}`
    );

    return apiResponse({ updated: totalUpdated });
  });
}
```

> **[P2 개선 요약]**:
> 1. **배치 분할**: 50개 단위 트랜잭션 → 커넥션 풀 고갈/WAL 크기 증가/Lock Escalation 방지
> 2. **N+1 제거**: `findUnique` N회 → `findMany` 1회
> 3. **createMany 일괄 삽입**: `bidHistory.create` N회 → `createMany` 1회
> 4. **version 기반 OL**: `updateMany` + `version` 조건으로 동시 수정 방지
>
> **[리뷰 반영 H-3] 추가 최적화 안내**:  
> 모든 키워드가 동일한 `newBid`로 변경되는 경우, 개별 `updateMany` 루프(N회 RTT) 대신 **Raw SQL 단일 쿼리**로 대체하면 성능이 크게 향상됩니다:
> ```typescript
> // Raw SQL 대안 (단일 UPDATE, version 기반 OL 유지)
> const result = await tx.$executeRaw`
>   UPDATE keywords 
>   SET current_bid = ${newBid}, version = version + 1, updated_at = NOW()
>   WHERE id = ANY(${batch}::uuid[]) 
>     AND organization_id = ${orgId} AND deleted_at IS NULL
>   RETURNING id
> `;
> ```
> Phase 3(자동입찰)에서는 키워드별 입찰가가 다를 수 있으므로, 해당 시점에 `unnest` 기반 벌크 UPDATE로 전환을 검토하세요.

### 19.3 데드락 방지 규칙

| 규칙 | 설명 |
|------|------|
| **ID 정렬 후 순차 처리** | 벌크 작업 시 항상 `ids.sort()` 후 처리 → 여러 요청이 동일 키워드를 포함해도 잠금 순서 동일 |
| **트랜잭션 타임아웃** | `$transaction({ timeout: 30000 })` 설정 → 30초 초과 시 자동 롤백 |
| **Advisory Lock (Phase 3)** | 자동입찰 엔진은 `pg_advisory_xact_lock(orgId_hash)` 사용 → 조직 단위 직렬화 |

---

## 20. 대용량 데이터 관리

### 20.1 데이터 보존 정책

| 테이블 | 예상 월간 증가량 | 보존 기간 | 관리 전략 |
|--------|:------------:|:-------:|---------|
| `audit_logs` | ~877,000건 | 90일 | 월별 파티셔닝 + 자동 삭제 |
| `bid_history` | ~864,000건 | 1년 | 월별 파티셔닝 |
| `rank_snapshots` | ~432,000건 | 6개월 | 월별 파티셔닝 |
| `click_fraud_events` | ~100,000건 | 1년 | 월별 파티셔닝 |
| `notifications` | ~10,000건 | 30일 (읽음) | 주기적 삭제 Job |
| 나머지 테이블 | 소량 | 영구 | 소프트 삭제 |

### 20.2 파티셔닝 (프로덕션 즉시 적용)

Prisma는 네이티브 파티셔닝을 지원하지 않으므로 **Raw SQL 마이그레이션**으로 적용합니다.

```sql
-- prisma/migrations/XXXXXX_partition_audit_logs/migration.sql

-- 1. 기존 테이블을 파티션 테이블로 재생성
ALTER TABLE audit_logs RENAME TO audit_logs_old;

CREATE TABLE audit_logs (
  id UUID NOT NULL,
  user_id UUID,
  organization_id UUID NOT NULL,
  action TEXT NOT NULL,
  entity_type VARCHAR(100) NOT NULL,
  entity_id TEXT,
  old_values JSONB,
  new_values JSONB,
  ip_address VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  PRIMARY KEY (id, created_at)  -- 파티션 키가 PK에 포함되어야 함
) PARTITION BY RANGE (created_at);

-- 2. 월별 파티션 생성 (3개월분)
CREATE TABLE audit_logs_2026_03 PARTITION OF audit_logs
  FOR VALUES FROM ('2026-03-01') TO ('2026-04-01');
CREATE TABLE audit_logs_2026_04 PARTITION OF audit_logs
  FOR VALUES FROM ('2026-04-01') TO ('2026-05-01');
CREATE TABLE audit_logs_2026_05 PARTITION OF audit_logs
  FOR VALUES FROM ('2026-05-01') TO ('2026-06-01');

-- 3. 기존 데이터 마이그레이션
INSERT INTO audit_logs SELECT * FROM audit_logs_old;
DROP TABLE audit_logs_old;

-- 4. 인덱스 재생성 (각 파티션에 자동 적용)
CREATE INDEX idx_audit_org_date_action ON audit_logs (organization_id, created_at, action);
```

> **[P2] 파티셔닝 마이그레이션 안전 가이드**:
> 1. **PK 변경 주의**: `PRIMARY KEY (id, created_at)` — 파티션 키가 PK에 포함되어야 하므로, 기존 `id`만으로 구성된 FK 참조가 **깨질 수 있습니다**.
> 2. **Prisma 호환성**: Prisma는 파티션 테이블을 일반 테이블처럼 취급합니다. `findUnique(id)`가 파티션 키 없이 호출되면 **모든 파티션을 스캔**합니다. → 파티셔닝 대상 테이블 조회에는 **항상 날짜 범위 조건을 포함**하세요.
> 3. **코드 컨벤션**: `// ⚠️ PARTITIONED TABLE: 날짜 조건 필수` 주석을 관련 쿼리에 붙여주세요.

### 20.3 자동 삭제 스케줄러

```typescript
// src/app/api/cron/cleanup/route.ts
// Vercel Cron 또는 외부 스케줄러에서 매일 02:00 UTC 호출

// [리뷰 반영 A-1-2] internalPrisma 사용 — 조직 횡단 작업이므로 멀티테넌트 미들웨어 우회
import { internalPrisma } from '@/lib/db';

export async function GET(req: Request) {
  // Cron 인증 (Vercel Cron Secret 또는 IP 화이트리스트)
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  const now = new Date();
  let totalDeletedAudit = 0;
  let totalDeletedNotif = 0;

  // [리뷰 반영 B-3-3] 배치 삭제 — 대량 DELETE로 인한 Lock Escalation/WAL 폭증 방지
  const BATCH_SIZE = 5000;

  // 1. 만료된 감사 로그 배치 삭제
  while (true) {
    const batch = await internalPrisma.$executeRaw`
      DELETE FROM audit_logs WHERE id IN (
        SELECT id FROM audit_logs WHERE expires_at < ${now} LIMIT ${BATCH_SIZE}
      )
    `;
    totalDeletedAudit += batch;
    if (batch < BATCH_SIZE) break;
    await new Promise(r => setTimeout(r, 100));  // 100ms 쿨다운 — 동시 INSERT 수용
  }

  // 2. 30일 이상 읽은 알림 배치 삭제
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  while (true) {
    const batch = await internalPrisma.$executeRaw`
      DELETE FROM notifications WHERE id IN (
        SELECT id FROM notifications WHERE is_read = true AND read_at < ${thirtyDaysAgo} LIMIT ${BATCH_SIZE}
      )
    `;
    totalDeletedNotif += batch;
    if (batch < BATCH_SIZE) break;
    await new Promise(r => setTimeout(r, 100));
  }

  return Response.json({
    deletedAuditLogs: totalDeletedAudit,
    deletedNotifications: totalDeletedNotif,
    executedAt: now.toISOString(),
  });
}
```

```json
// vercel.json — Cron 설정
{
  "crons": [
    {
      "path": "/api/cron/cleanup",
      "schedule": "0 2 * * *"
    }
  ]
}
```

### 20.4 파티션 자동 생성 (월별)

```typescript
// src/app/api/cron/create-partitions/route.ts
// 매월 25일에 다음 달 파티션을 미리 생성

export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  const nextMonth = new Date();
  nextMonth.setMonth(nextMonth.getMonth() + 1);
  const year = nextMonth.getFullYear();
  const month = String(nextMonth.getMonth() + 1).padStart(2, '0');
  
  const afterMonth = new Date(nextMonth);
  afterMonth.setMonth(afterMonth.getMonth() + 1);
  const afterYear = afterMonth.getFullYear();
  const afterMonthStr = String(afterMonth.getMonth() + 1).padStart(2, '0');

  const tables = ['audit_logs', 'bid_history', 'rank_snapshots', 'click_fraud_events'];

  // [P2 개선] 화이트리스트 검증 — $executeRawUnsafe SQL 인젝션 방지
  const ALLOWED_TABLES = new Set(['audit_logs', 'bid_history', 'rank_snapshots', 'click_fraud_events']);

  for (const table of tables) {
    if (!ALLOWED_TABLES.has(table)) {
      return Response.json({ error: `Invalid table: ${table}` }, { status: 400 });
    }
    const partitionName = `${table}_${year}_${month}`;
    // [리뷰 반영 A-1-2] internalPrisma 사용 — 조직 횡단 DDL 작업
    await internalPrisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS ${partitionName} PARTITION OF ${table}
      FOR VALUES FROM ('${year}-${month}-01') TO ('${afterYear}-${afterMonthStr}-01')
    `);
  }

  return Response.json({ created: `${year}-${month} partitions`, tables });
}
```

---

## 21. 추가 가이드라인 (전문가 리뷰 반영)

### 21.1 API 버저닝 전략 [P3]

Phase 2-4에서 Breaking Change 발생 시 기존 클라이언트 호환을 위해 API 버저닝을 도입합니다.

```
// 현재 (버전 없음)
/api/campaigns
/api/keywords

// Phase 2 이후 (버전 있음)
/api/v1/campaigns       ← 기존 API (호환 유지)
/api/v2/campaigns       ← 새 API (Breaking Change)
```

**구현 방법** (Next.js App Router):
```
src/app/api/v1/campaigns/route.ts    ← v1 엔드포인트
src/app/api/v2/campaigns/route.ts    ← v2 엔드포인트 (필요 시)
```

> **전환 시점**: Phase 2에서 네이버 API 연동 시 응답 구조가 변경될 때 도입.  
> Phase 1에서는 **클라이언트가 우리 프론트엔드뿐**이므로 아직 불필요.

---

### 21.2 커넥션 풀 사이징 가이드 [P3]

| 환경 | DB | pool_size | 근거 |
|------|:---:|:---------:|------|
| **개발 (Supabase 무료)** | Supabase Tokyo | `connection_limit=5` | 무료 티어 max_connections=60, pgBouncer 제한 |
| **스테이징 (RDS t3.micro)** | AWS RDS Seoul | `connection_limit=5` | max_connections=87, 서버리스 함수당 3 제한 |
| **프로덕션 (RDS t3.medium)** | AWS RDS Seoul | `connection_limit=3` | max_connections=150, 예상 동시 인스턴스 20 = 60 connections |

```bash
# 프로덕션 환경변수 예시
DATABASE_URL="postgresql://admin:pw@rds-host:5432/agencyos?pgbouncer=true&connection_limit=3"
```

**계산 공식**:
```
총 커넥션 = (Vercel 동시 인스턴스 수) × connection_limit
프로덕션 예시: 20 인스턴스 × 3 = 60 connections (< 150 max)
```

> **⚠️ PgBouncer**: AWS RDS에서는 **RDS Proxy**를 사용하여 커넥션 풀링을 서버리스 환경에 최적화.  
> `pool_mode=transaction` 필수 (세션 고정 방지).

---

### 21.3 JSON 컬럼 정규화 로드맵 [P1]

Phase 2 이전에 아래 JSON 컬럼들을 정규화하여 **FK 무결성 및 쿼리 최적화**를 확보합니다.

| 현재 (JSON) | 정규화 이후 | 이유 |
|-------------|-----------|------|
| `ReportTemplate.recipientEmails: Json` | `ReportRecipient(id, templateId, email)` 테이블 | 수신자별 발송 이력 추적 |
| `ReportTemplate.naverAccountIds: Json` | `ReportTemplateAccount(templateId, accountId)` 조인 테이블 | FK 무결성 검증 |
| `Notification.channels: Json` | `NotificationChannel(notifId, channel, sentAt?, status?)` 테이블 | 채널별 발송 상태 추적 |
| `CompetitiveIntel.top5Ads: Json` | `CompetitiveAd(intelId, rank, title, description, url)` 테이블 | 개별 광고 변화 시계열 분석 |

> **마이그레이션 우선순위**: `ReportTemplate` > `Notification` > `CompetitiveIntel`  
> (Phase 4 슬랙/이메일 알림 연동 전에 Notification 정규화 필수)

---

### 21.4 ClickFraudDailySummary 집계 전략 [추가]

`ClickFraudDailySummary`의 `totalClicks`, `fraudClicks`, `fraudRate` 등은 `ClickFraudEvent`에서 파생되는 **집계 데이터**입니다.

**집계 전략**:
```typescript
// src/app/api/cron/aggregate-fraud/route.ts
// 매일 03:00 UTC 실행
export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const dateStr = yesterday.toISOString().split('T')[0];

  // [리뷰 반영 A-1-2] internalPrisma 사용 — 조직 횡단 집계이므로 멀티테넌트 미들웨어 우회
  // [리뷰 반영 B-2-4] click_timestamp::date 캐스팅 제거 → 범위 조건으로 변경 (인덱스 활용)
  const summaries = await internalPrisma.$queryRaw`
    SELECT 
      organization_id,
      naver_account_id,
      COUNT(*) AS total_clicks,
      COUNT(*) FILTER (WHERE status = 'confirmed') AS fraud_clicks,
      ROUND(COUNT(*) FILTER (WHERE status = 'confirmed')::decimal / NULLIF(COUNT(*), 0), 4) AS fraud_rate
    FROM click_fraud_events
    WHERE click_timestamp >= ${dateStr}::date 
      AND click_timestamp < (${dateStr}::date + interval '1 day')
    GROUP BY organization_id, naver_account_id
  `;

  // [리뷰 반영 D-3] upsert에 복합 Unique 제약 사용 (@@unique에 맞춰 수정)
  for (const s of summaries) {
    await internalPrisma.clickFraudDailySummary.upsert({
      where: { uq_cfds_org_account_date: {
        organizationId: s.organization_id,
        naverAccountId: s.naver_account_id,
        summaryDate: new Date(dateStr),
      }},
      update: { totalClicks: s.total_clicks, fraudClicks: s.fraud_clicks, fraudRate: s.fraud_rate },
      create: {
        organizationId: s.organization_id,
        naverAccountId: s.naver_account_id,
        summaryDate: new Date(dateStr),
        totalClicks: s.total_clicks,
        fraudClicks: s.fraud_clicks,
        fraudRate: s.fraud_rate,
      },
    });
  }

  return Response.json({ aggregated: summaries.length, date: dateStr });
}
```

```json
// vercel.json에 추가
{
  "crons": [
    { "path": "/api/cron/cleanup", "schedule": "0 2 * * *" },
    { "path": "/api/cron/create-partitions", "schedule": "0 0 25 * *" },
    { "path": "/api/cron/aggregate-fraud", "schedule": "0 3 * * *" }
  ]
}
```

### 20.5 [리뷰 반영 D-1] UUIDv7 생성 함수 마이그레이션

> ⚠️ **필수 적용**: 시계열 테이블(BidHistory, RankSnapshot, AuditLog, ClickFraudEvent)의 PK에 `gen_random_uuid()`(UUIDv4)를 사용하면 **B-Tree 인덱스 리프 노드가 무작위 분산**되어 페이지 분할 빈발/버퍼 캐시 효율 저하가 발생합니다.
> UUIDv7은 상위 48bit에 타임스탬프를 포함하여 **시간순 INSERT = 순차적 인덱스 성장**을 보장합니다.

```sql
-- prisma/migrations/XXXXXX_add_uuidv7_function/migration.sql

-- PostgreSQL 13+ 호환 UUIDv7 생성 함수
CREATE OR REPLACE FUNCTION uuid_generate_v7()
RETURNS uuid AS $$
DECLARE
  unix_ts_ms bigint;
  uuid_bytes bytea;
BEGIN
  unix_ts_ms = (extract(epoch from clock_timestamp()) * 1000)::bigint;
  uuid_bytes = substring(int8send(unix_ts_ms) from 3);           -- 48-bit timestamp
  uuid_bytes = uuid_bytes || gen_random_bytes(10);                -- 80-bit random
  -- Set version 7
  uuid_bytes = set_byte(uuid_bytes, 6, (get_byte(uuid_bytes, 6) & 15) | 112);
  -- Set variant 2
  uuid_bytes = set_byte(uuid_bytes, 8, (get_byte(uuid_bytes, 8) & 63) | 128);
  RETURN encode(uuid_bytes, 'hex')::uuid;
END
$$ LANGUAGE plpgsql VOLATILE;

-- 시계열 테이블에 UUIDv7 기본값 적용
ALTER TABLE bid_history ALTER COLUMN id SET DEFAULT uuid_generate_v7();
ALTER TABLE rank_snapshots ALTER COLUMN id SET DEFAULT uuid_generate_v7();
ALTER TABLE audit_logs ALTER COLUMN id SET DEFAULT uuid_generate_v7();
ALTER TABLE click_fraud_events ALTER COLUMN id SET DEFAULT uuid_generate_v7();
```

> **Prisma 스키마 변경 없음**: `@default(dbgenerated("gen_random_uuid()"))` 선언은 그대로 유지하되, 실제 DB의 DEFAULT가 `uuid_generate_v7()`로 교체됨.
> `prisma migrate dev` 실행 시 위 SQL을 Raw Migration으로 추가하세요.

---

### 20.6 [리뷰 반영 D-5] 키워드 부분 문자열 검색용 GIN 인덱스

> B-Tree 인덱스는 `LIKE '%keyword%'` 같은 좌측 와일드카드 검색에서 **인덱스를 사용하지 않습니다.**
> 키워드 수가 100,000개 이상이면 Full Table Scan으로 3초+ 응답 지연이 발생합니다.

```sql
-- prisma/migrations/XXXXXX_add_trgm_index/migration.sql

-- pg_trgm 확장 설치 (한 번만 실행)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- GIN 트라이그램 인덱스 — LIKE '%변호사%' 쿼리에서 GIN 스캔 활성화
CREATE INDEX idx_kw_text_trgm ON keywords 
USING gin (keyword_text gin_trgm_ops);
```

> **Supabase 호환성**: Supabase PostgreSQL에는 `pg_trgm`이 이미 설치되어 있으므로 추가 설정 불필요.  
> **AWS RDS**: 기본 제공되므로 `CREATE EXTENSION`만 실행하면 됩니다.

---

## 22. [리뷰 반영] 추가 도입 항목

### 22.1 [리뷰 반영 M-5] Health Check 엔드포인트

> 프로덕션 환경에서 DB 연결 상태와 Redis 상태를 모니터링하기 위한 필수 엔드포인트입니다.
> 로드밸런서 헬스체크, 업타임 모니터링, CD 파이프라인 검증에 활용됩니다.

`src/app/api/health/route.ts`

```typescript
import prisma from '@/lib/db';
import { Redis } from '@upstash/redis';

const redis = Redis.fromEnv();

export async function GET() {
  const checks: Record<string, { status: string; latency?: number }> = {};

  // 1. DB 연결 확인
  const dbStart = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.database = { status: 'ok', latency: Date.now() - dbStart };
  } catch (e) {
    checks.database = { status: 'error', latency: Date.now() - dbStart };
  }

  // 2. Redis 연결 확인
  const redisStart = Date.now();
  try {
    await redis.ping();
    checks.redis = { status: 'ok', latency: Date.now() - redisStart };
  } catch (e) {
    checks.redis = { status: 'error', latency: Date.now() - redisStart };
  }

  const allHealthy = Object.values(checks).every(c => c.status === 'ok');

  return Response.json(
    { status: allHealthy ? 'healthy' : 'degraded', checks, timestamp: new Date().toISOString() },
    { status: allHealthy ? 200 : 503 }
  );
}
```

| Method | 설명 | 인증 | Response |
|--------|------|:---:|----------|
| `GET` | 시스템 건강 상태 | 불필요 | `{ status: 'healthy'\|'degraded', checks, timestamp }` |

---

### 22.2 [리뷰 반영 D-7] 소프트 삭제 자동화 (Prisma Client Extensions)

> `deletedAt: null` 필터를 모든 쿼리에 수동으로 추가하면 누락 위험이 있습니다.
> Prisma Client Extensions로 **자동 필터링**을 적용하면 안전합니다.

```typescript
// src/lib/db.ts 에 추가 (기존 prisma 싱글톤 이후)

// [P2] 소프트 삭제 자동 필터 — deletedAt 이 있는 모델에 자동 적용
const SOFT_DELETE_MODELS = new Set([
  'User', 'NaverAccount', 'Campaign', 'AdGroup', 'Keyword', 'Ad',
]);

// Prisma 5.x+ Client Extensions
const extendedPrisma = prisma.$extends({
  query: {
    $allModels: {
      async findMany({ model, args, query }) {
        if (SOFT_DELETE_MODELS.has(model)) {
          args.where = { deletedAt: null, ...args.where };
        }
        return query(args);
      },
      async findFirst({ model, args, query }) {
        if (SOFT_DELETE_MODELS.has(model)) {
          args.where = { deletedAt: null, ...args.where };
        }
        return query(args);
      },
      async count({ model, args, query }) {
        if (SOFT_DELETE_MODELS.has(model)) {
          args.where = { deletedAt: null, ...args.where };
        }
        return query(args);
      },
    },
  },
});

// 기존 export를 extendedPrisma로 교체
export { extendedPrisma as prisma };
```

> **전환 시점**: Phase 2 진입 전에 적용 권장. 기존 `deletedAt: null` 수동 필터를 제거하면서 동시에 적용하세요.

---

### 22.3 [리뷰 반영 M-4] API 응답 포맷 통일 가이드

현재 API 응답 포맷이 일부 `{ data }`, 일부 `{ campaign }` 등으로 다릅니다.
**전역 표준**으로 아래 형식을 통일합니다.

```typescript
// 문서/목록 응답 (페이지네이션 포함)
{
  data: T[],
  pagination: { total, page, limit, totalPages, hasNext, hasPrev }
}

// 단일 엔티티 응답
{
  data: T
}

// 오류 응답
{
  error: string
}

// 성공 응답 (삭제 등 데이터 없음)
{
  success: true
}
```

> **적용 범위**: Phase 1에서 새로 만드는 API부터 이 형식을 적용하고, 기존 `{ campaign }` 형식은 프론트엔드 연동 시 점진적으로 `{ data }` 형식으로 통일.

---

### 22.4 [리뷰 반영 D-12] 트랜잭션 격리 수준 검토

| 상황 | 현재 (기본값) | 권장 | 이유 |
|------|:---:|:---:|------|
| Prisma `$transaction` | **Read Committed** | Read Committed | Prisma 기본값. Optimistic Locking과 병용으로 충분 |
| Phase 3 자동입찰 엔진 | Read Committed | **Repeatable Read** | 순위 조회 → 입찰가 계산 → 업데이트 간 **Phantom Read** 방지 |
| 결제 처리 (Phase 4) | Read Committed | **Serializable** | 이중 결제 방지 |

```typescript
// Phase 3 자동입찰 예시
await prisma.$transaction(async (tx) => {
  // ...
}, {
  isolationLevel: 'RepeatableRead',  // Phantom Read 방지
  timeout: 30000,
});
```
