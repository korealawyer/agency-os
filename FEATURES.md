# Agency OS 기능 구현 현황 (Feature List)

`prisma/schema.prisma`의 데이터베이스 모델과 실제 프론트엔드(`src/app`), 백엔드 API(`src/app/api`) 디렉토리 구조를 비교 대조하여 기능 구현 현황을 리스트화했습니다.

| 분류 | 기능(모듈) | 관련 DB 엔티티 (DB Table) | 프론트(UI) 경로 | 백엔드(API) 경로 | 진행 상태 | 
|---|---|---|---|---|---|
| 계정 관리 | 로그인 및 인증 | `User` | `(auth)/login` | `api/auth` | ✅ 구현 완료 |
| 계정 관리 | 조직 및 멤버 관리 | `Organization`, `User` | `dashboard/settings` | `api/members` | ✅ 구현 완료 |
| 검색광고 연동 | 네이버 광고 계정 연동 | `NaverAccount` | `dashboard/accounts` | `api/accounts` | ✅ 구현 완료 | 
| 검색광고 관리 | 캠페인 관리 | `Campaign` | `dashboard/campaigns` | `api/campaigns` | ✅ 구현 완료 |
| 검색광고 관리 | 광고 그룹 관리 | `AdGroup` | (키워드/캠페인에 종속) | `api/ad-groups` | ✅ 구현 완료 |
| 검색광고 관리 | 광고 소재 (Creatives) | `Ad` | `dashboard/ads` | `api/ads` | ✅ 구현 완료 |
| 검색광고 관리 | 광고 소재 A/B 테스트 | `Ad` (testGroupId, isControl) | `dashboard/ads` (A/B탭) | `api/ads` | ✅ 구현 완료 |
| 검색광고 관리 | 전환 퍼널 분석 | `Ad` (impressions→clicks→conversions) | `dashboard/ads` (퍼널탭) | `api/ads` | ✅ 구현 완료 |
| 검색광고 관리 | 키워드 조회 및 입찰 | `Keyword` | `dashboard/keywords` | `api/keywords` | ✅ 구현 완료 |
| AI 및 자동화 | 규칙/AI 기반 자동 입찰 | `BidHistory` | `dashboard/automation` | `api/cron` | ✅ 구현 완료 |
| AI 및 자동화 | 코파일럿 (AI 추천) | `AiActionLog` | `dashboard/copilot` | `api/copilot/actions` | ✅ 구현 완료 |
| AI 및 자동화 | 성과 시뮬레이터 | - | `dashboard/simulator` | `api/simulator` | ✅ 구현 완료 |
| 리포팅/분석 | 통합 메인 대시보드 | 종합 | `dashboard/page.tsx` | `api/dashboard` | ✅ 구현 완료 |
| 리포팅/분석 | KPI 기간 비교 (WoW/DoD) | 종합 | `dashboard/page.tsx` | `api/dashboard?period=` | ✅ 구현 완료 |
| 리포팅/분석 | 수익성 분석 (마진) | `Profitability` | `dashboard/profitability` | (통합API 활용) | ✅ 구현 완료 |
| 리포팅/분석 | 경쟁사 분석 및 순위 추적 | `CompetitiveIntel`, `RankSnapshot`| `dashboard/competitive` | `api/competitive` | ✅ 구현 완료 |
| 리포팅/분석 | 리포트 템플릿/발송 | `ReportTemplate`, `Report` | `dashboard/reports` | `api/reports` | ✅ 구현 완료 |
| 시스템 | 감사 로그 | `AuditLog` | `dashboard/audit-log` | `api/audit-logs` | ✅ 구현 완료 |
| 시스템 | 예산/시스템 알림 | `Notification` | `dashboard/notifications` | `api/notifications` | ✅ 구현 완료 |
| 수익 모델 | 정기 구독 및 플랜 결제 | `Subscription`, `PlanType`| `(marketing)/pricing` | `api/subscriptions` | ✅ 구현 완료 |
| 부정클릭 | 의심 클릭 로그 수집 | `ClickFraudEvent` | `dashboard/click-fraud` | `api/click-fraud/events` | ✅ 구현 완료 |
| 부정클릭 | 악성 IP 식별 및 차단 | `BlockedIp` | `dashboard/click-fraud` | `api/click-fraud/blocked-ips` | ✅ 구현 완료 |
| 부정클릭 | 일간 리포트 및 자동 환불요청 | `ClickFraudDailySummary` | `dashboard/click-fraud` | `api/click-fraud/summary` | ✅ 구현 완료 |
| 인프라 | 네이버 API 재시도 (Exponential Backoff) | - | - | `lib/naver-ads-api.ts` | ✅ 구현 완료 |
| 데이터 연동 | 네이버 광고 계정 DB 동기화 서비스 | `Campaign`, `AdGroup`, `Keyword` | - | `lib/naver-sync.ts` | ✅ 구현 완료 |
| 데이터 연동 | 계정 동기화 크론 엔드포인트 | - | - | `api/cron/sync-naver` | ✅ 구현 완료 |
| AI 및 자동화 | AI 채팅 어드바이저 (Copilot Chat) | `AiActionLog` | `dashboard/copilot` | `api/copilot/chat` | ✅ 구현 완료 |
| UI/UX | 다크 모드 | - | `globals.css` | - | ✅ 구현 완료 |
| UI/UX | DateRangePicker 컴포넌트 | - | `components/DateRangePicker` | - | ✅ 구현 완료 |
| UI/UX | 공통 Modal 컴포넌트 | - | `components/Modal` | - | ✅ 구현 완료 |
| UI/UX | Breadcrumb 네비게이션 | - | `components/Breadcrumb` | - | ✅ 구현 완료 |
| UI/UX | FunnelChart 컴포넌트 | - | `components/FunnelChart` | - | ✅ 구현 완료 |
| UI/UX | HeatmapChart 컴포넌트 | - | `components/HeatmapChart` | `api/dashboard/heatmap` | ✅ 구현 완료 |
| UI/UX | VirtualTable 가상 스크롤 | - | `components/VirtualTable` | - | ✅ 구현 완료 |
| 데이터 연동 | 전체 페이지 SWR API 훅 | - | `hooks/useApi.ts` (19 hooks) | 전체 API | ✅ 구현 완료 |
| 리포팅/분석 | 시간대별 성과 히트맵 | `BidHistory`, `Keyword` | `dashboard/page.tsx` | `api/dashboard/heatmap` | ✅ 구현 완료 |
| 성능 | 대량 데이터 가상 스크롤 | - | `dashboard/keywords` | - | ✅ 구현 완료 |

* **진행 상태 범례**
  * ✅ **구현 완료**: 프론트엔드 라우트와 백엔드 API가 모두 존재하여 기본 동작이 가능함.
