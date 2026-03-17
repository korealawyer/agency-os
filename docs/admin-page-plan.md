# 🛡️ Agency OS 관리자(Admin) 페이지 구성 계획

> 작성일: 2026-03-17 | v3 (최종 검토 보완)

## 배경

현재 Agency OS는 **조직(Organization) 단위의 멀티테넌트 SaaS**이나, 플랫폼 전체를 관리하는 **시스템 관리자(Super Admin) 페이지가 없습니다.** 기존 `dashboard/settings`는 개별 조직의 설정만 다루고 있어, 전체 조직/사용자/구독/시스템 상태를 한눈에 보는 관리 콘솔이 필요합니다.

---

## 핵심 설계 결정

### 1. 슈퍼 관리자 vs 조직 관리자

| 구분 | 조직 관리자 (기존) | 슈퍼 관리자 (신규) |
|------|-------------------|-------------------|
| 스코프 | 자기 조직만 | 전체 플랫폼 |
| Role | `owner`, `admin` | 새 `super_admin` 역할 추가 |
| Prisma 클라이언트 | `prisma` (조직 필터) | `internalPrisma` (횡단 쿼리) |
| 라우트 | `/dashboard/*` | `/admin/*` (별도 레이아웃) |

> ⚠️ `UserRole` enum에 `super_admin`을 추가해야 합니다. DB 마이그레이션이 필요합니다.

### 2. 라우트 구조: `/admin/*` (대시보드와 완전 분리)

```
src/app/admin/
├── layout.tsx                ← 관리자 전용 사이드바 + 인증 가드
├── page.tsx                  ← 1. 관리자 홈 (시스템 개요)
├── organizations/page.tsx    ← 2. 전체 조직 관리
├── users/page.tsx            ← 3. 전체 사용자 관리
├── subscriptions/page.tsx    ← 4. 구독/결제 관리
├── naver-accounts/page.tsx   ← 5. 네이버 계정 통합 관리
├── profitability/page.tsx    ← 6. 전체 수익성 관리 ★v3
├── data-sync/page.tsx        ← 7. 데이터 동기화 관리
├── ai-monitoring/page.tsx    ← 8. AI 액션 통합 모니터링 ★v3
├── reports/page.tsx           ← 9. 리포트 통합 관리 ★v3
├── click-fraud/page.tsx      ← 10. 전체 부정클릭 통합 모니터링
├── system/page.tsx           ← 11. 시스템 상태 (DB, API, Cron)
├── security/page.tsx         ← 12. 보안 대시보드
├── audit/page.tsx            ← 13. 전체 감사 로그
├── announcements/page.tsx    ← 14. 공지사항/시스템 알림
├── plan-config/page.tsx      ← 15. 플랜별 기능/한도 설정
└── analytics/page.tsx        ← 16. 플랫폼 분석 (MRR, 이탈율 등)
```

---

## 스키마 모델 ↔ 관리자 페이지 커버리지 맵

> 모든 Prisma 모델이 관리자 페이지에서 조회/관리 가능한지 확인

| Prisma 모델 | 관리자 페이지 | 비고 |
|-------------|-------------|------|
| `Organization` | ✅ 2. 조직 관리 | CRUD |
| `User` | ✅ 3. 사용자 관리 | 추가/삭제/역할변경 |
| `Subscription` | ✅ 4. 구독 관리 | 플랜 변경/상태 |
| `NaverAccount` | ✅ 5. 네이버 계정 관리 | 연결 상태/API 키 |
| `Campaign` | ✅ 1. 홈 KPI + 5. 네이버 계정 | 읽기 전용 집계 |
| `AdGroup` | ✅ 1. 홈 KPI | 읽기 전용 집계 |
| `Keyword` | ✅ 1. 홈 KPI | 읽기 전용 집계 |
| `Ad` | ✅ 1. 홈 KPI | 읽기 전용 집계 |
| `BidHistory` | ✅ 8. AI 모니터링 | 입찰 변경 이력 조회 |
| `RankSnapshot` | ✅ 1. 홈 KPI | 읽기 전용 |
| `Profitability` | ✅ 6. 수익성 관리 ★v3 | 전체 조직 수익 뷰 |
| `ReportTemplate` | ✅ 9. 리포트 관리 ★v3 | 기본 템플릿 관리 |
| `Report` | ✅ 9. 리포트 관리 ★v3 | 전체 발송 이력 |
| `CompetitiveIntel` | ✅ 1. 홈 KPI | 읽기 전용 집계 |
| `Notification` | ✅ 14. 공지사항 | 시스템 공지 생성 |
| `AiActionLog` | ✅ 8. AI 모니터링 ★v3 | 전체 AI 활동 뷰 |
| `AuditLog` | ✅ 13. 감사 로그 | 전체 조직 조회 |
| `ClickFraudEvent` | ✅ 10. 부정클릭 | 전체 조직 조회 |
| `BlockedIp` | ✅ 10. 부정클릭 | 글로벌 차단 IP |
| `ClickFraudDailySummary` | ✅ 10. 부정클릭 | 일간 집계 |

---

## 페이지별 상세 구성

### 📊 1. 관리자 홈 — `/admin`

플랫폼 전체 현황을 한눈에 보는 KPI 대시보드

| KPI 카드 | 데이터 소스 |
|----------|-----------|
| 총 조직/활성 조직 | `Organization.count()` |
| 총 사용자/활성 사용자 | `User.count()` |
| 총 MRR | `Subscription.sum(monthlyPrice)` |
| 총 관리 광고비 | `Organization.sum(totalAdSpend)` |
| 네이버 계정 연결 현황 | `NaverAccount` 상태별 |
| AI 액션 승인율 | `AiActionLog` 집계 |
| 부정클릭 탐지 현황 | `ClickFraudEvent` 최근 |
| 총 순이익 / 마진율 | `Profitability` 합산 ★v3 |

추가 위젯: 최근 가입 조직 5건, 시스템 경고 배너, 적자 조직 알림

---

### 🏢 2. 조직 관리 — `/admin/organizations`

| 컬럼 | 설명 |
|------|------|
| 조직명 | 클릭 시 상세 패널 |
| 플랜 | Personal ~ Enterprise |
| 총 광고비 / 수수료 수익 | 월간 합계 |
| 계정·멤버 수 | - |
| 상태 / 생성일 | - |

기능: 조직 CRUD, 플랜 변경, soft delete, 조직별 수익 분석

---

### 👥 3. 사용자 관리 — `/admin/users`

| 컬럼 | 설명 |
|------|------|
| 이름 / 이메일 / 조직 | - |
| 역할 | super_admin/owner/admin/editor/viewer |
| 마지막 로그인 / 상태 | - |

기능: 사용자 **추가·삭제(soft delete)**, 역할 변경, 비밀번호 초기화, 비활성화/강제 로그아웃, 장기 미접속 필터 (30/60/90일)

---

### 💳 4. 구독 관리 — `/admin/subscriptions`

플랜별 분포 파이 차트, 상태별 집계, MRR 추이 차트, 구독 편집, 결제 실패/연체 조직 알림

---

### 🔗 5. 네이버 계정 통합 관리 — `/admin/naver-accounts`

전체 조직의 네이버 광고 계정 모니터링. 연결 상태, 동기화 시간, 수수료율, API 키 상태 관리

---

### 💰 6. 수익성 통합 관리 — `/admin/profitability` ★v3 신규

> 기존 `/dashboard/profitability`는 자기 조직 고객만 보임. 관리자는 **전체 조직의 수익성**을 파악해야 함

| 항목 | 설명 |
|------|------|
| 전체 플랫폼 매출/비용/순이익 | `Profitability` 합산 |
| 조직별 수익 랭킹 | 마진율 순 정렬 |
| 적자 조직 경고 | 마진율 < 0인 조직 하이라이트 |
| 수수료 수익 트렌드 | 월별 추이 차트 |
| 정산 현황 | 조직별 미수금/완료 상태 |

**기능:**
- 조직별 수수료율 일괄 조정
- 적자 조직 알림 자동 생성
- 수익성 리포트 내보내기 (Excel/CSV)

---

### 🔄 7. 데이터 동기화 관리 — `/admin/data-sync`

Cron 작업(`sync-naver`, `cleanup`, `create-partitions`) 모니터링, 실행 이력, 수동 트리거, 실패 알림

---

### 🤖 8. AI 액션 통합 모니터링 — `/admin/ai-monitoring` ★v3 신규

> 기존 AI 코파일럿/자동화는 조직별 동작. 관리자는 **전체 플랫폼의 AI 활동**을 모니터링해야 함

| 항목 | 설명 |
|------|------|
| AI 액션 총 건수 | `AiActionLog.count()` |
| 유형별 분포 | bid_adjustment / keyword_recommendation 등 |
| 승인율 / 실행률 | `isApproved` 비율 |
| 조직별 AI 사용량 | 조직별 AI 액션 횟수 |
| 입찰 변경 이력 | `BidHistory` — AI vs Manual 비율 |
| AI 추천 정확도 | 승인 후 성과 변화 추적 |

**기능:**
- 글로벌 AI 안전장치 기본값 설정 (입찰가 상하한, 속도 제한)
- 특정 조직 AI 기능 비활성화 (긴급 차단)
- AI 액션 로그 상세 조회 + CSV 내보내기

---

### 📄 9. 리포트 통합 관리 — `/admin/reports` ★v3 신규

> 기존 `/dashboard/reports`는 조직별 템플릿/발송만 관리. 관리자는 **전체 리포트 현황**을 파악해야 함

| 항목 | 설명 |
|------|------|
| 전체 리포트 발송 이력 | `Report` 전체 목록 |
| 템플릿 통계 | `ReportTemplate` 사용 빈도 |
| 발송 성공/실패율 | 조직별 리포트 전달 현황 |
| 기본 템플릿 관리 | 플랫폼 기본 제공 템플릿 CRUD |

**기능:**
- 플랫폼 기본 리포트 템플릿 생성/편집
- 리포트 발송 실패 건 재발송
- 전체 리포트 검색 (조직, 기간, 상태 필터)

---

### 🛡️ 10. 부정클릭 통합 모니터링 — `/admin/click-fraud`

전체 조직 부정클릭 KPI, 조직별 비율 순위, 트렌드 차트, 글로벌 차단 IP 관리

---

### 🖥️ 11. 시스템 상태 — `/admin/system`

DB·API·Cron 헬스체크, 에러 로그, 서버 환경, 응답 시간 모니터링

---

### 🔐 12. 보안 대시보드 — `/admin/security`

로그인 실패 이력, 의심 활동, 활성 세션, 비밀번호 정책, 2FA 현황

---

### 📋 13. 감사 로그 — `/admin/audit`

전체 조직 감사 로그 통합 조회 (조직/사용자/액션 필터, CSV 내보내기)

---

### 📢 14. 공지사항 — `/admin/announcements`

공지사항 CRUD, 대상/채널 지정, 예약 발송, 유지보수 모드 on/off

---

### ⚙️ 15. 플랜별 기능 설정 — `/admin/plan-config`

플랜별 계정 수/키워드 수/AI 기능/API 제한/리포트/가격 동적 관리

---

### 📈 16. 플랫폼 분석 — `/admin/analytics`

MRR/ARR 추이, 가입·이탈율, 플랜 전환 퍼널, 코호트 분석, LTV 추정

---

## v3에서 추가된 항목 (총 3개)

| ★ 추가 항목 | 누락 원인 | 데이터 소스 |
|------------|----------|------------|
| **수익성 통합 관리** | `Profitability` 모델이 관리자 뷰에 미반영 | `Profitability` 테이블 |
| **AI 액션 통합 모니터링** | `AiActionLog` + `BidHistory` 조직 횡단 뷰 없음 | `AiActionLog`, `BidHistory` |
| **리포트 통합 관리** | `ReportTemplate` + `Report` 관리자 뷰 없음 | `ReportTemplate`, `Report` |

---

## 변경 사항 총정리

### 스키마 변경

```diff
 enum UserRole {
+  super_admin
   owner
   admin
   editor
   viewer
 }
```

추가 검토:
- `Notification`에 `isGlobal` Boolean 추가 (전체 공지용)
- `Organization`에 `planConfig` Json 추가 (유연한 플랜 설정)

### API 라우트 (15개 신규)

| API Route | 설명 |
|-----------|------|
| `GET /api/admin/overview` | 전체 KPI 집계 |
| `GET/POST/PATCH/DELETE /api/admin/organizations` | 조직 CRUD |
| `GET/POST/PATCH/DELETE /api/admin/users` | 사용자 CRUD |
| `GET/PATCH /api/admin/subscriptions` | 구독 관리 |
| `GET /api/admin/naver-accounts` | 네이버 계정 조회 |
| `GET /api/admin/profitability` | 전체 수익성 조회 ★v3 |
| `GET/POST /api/admin/data-sync` | 동기화 관리 |
| `GET /api/admin/ai-monitoring` | AI 액션 통합 조회 ★v3 |
| `GET /api/admin/reports` | 리포트 통합 조회 ★v3 |
| `GET /api/admin/click-fraud` | 부정클릭 통합 |
| `GET /api/admin/system` | 시스템 헬스체크 |
| `GET /api/admin/security` | 보안 이벤트 |
| `GET /api/admin/audit` | 전체 감사 로그 |
| `CRUD /api/admin/announcements` | 공지사항 |
| `GET/PATCH /api/admin/plan-config` | 플랜 설정 |

### 프론트엔드 (17개 신규 파일)

- `src/app/admin/layout.tsx` + 16개 페이지
- `src/components/AdminSidebar.tsx`

### 구현 우선순위

| Phase | 작업 | 규모 |
|-------|------|------|
| **1** | 스키마 + 인증 가드 + 관리자 레이아웃 | 소 |
| **2** | 홈 + 조직 + 사용자 관리 | 중 |
| **3** | 구독 + 네이버 계정 + 수익성 통합 | 중 |
| **4** | AI 모니터링 + 리포트 관리 + 데이터 동기화 | 중 |
| **5** | 부정클릭 통합 + 시스템 + 보안 + 감사로그 | 중 |
| **6** | 공지사항 + 플랜 설정 + 플랫폼 분석 | 중 |

### 검증 방법

1. `npx next build` 빌드 성공
2. `super_admin` 로그인 → `/admin` 접근 가능
3. 일반 사용자 → `/admin` 접근 차단 (403/리다이렉트)
4. 각 페이지 데이터 표시 및 CRUD 동작 확인
5. 사용자 추가/삭제/역할 변경 DB 반영 확인
6. 데이터 동기화 수동 트리거 동작 확인
