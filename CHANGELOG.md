# Changelog

## [1.3.0] - 2026-03-15

### 📊 시간대별 성과 히트맵
- **Heatmap API** (`api/dashboard/heatmap/route.ts`): 요일(0~6) × 시간(0~23) 7×24 매트릭스 — clicks, impressions, cost, conversions
- **HeatmapChart 컴포넌트** (`components/HeatmapChart.tsx`): 파란색 그라디언트 강도 셀, 툴팁, 메트릭 토글 4종 (클릭/노출/비용/전환), 범례 바
- **대시보드 통합**: ROAS 차트 하단에 히트맵 카드 추가, 폴백 Mock 데이터 (업무시간 비이어스)

### ⚡ 가상 스크롤 (Virtual Scrolling)
- **VirtualTable 컴포넌트** (`components/VirtualTable.tsx`): `@tanstack/react-virtual` 기반 제너릭 가상 테이블
- **키워드 페이지 적용**: 50행 이하 일반 렌더링, 50행 초과 시 자동 가상 스크롤 활성화
- **UI**: 고정 헤더 + 스크롤 바디 + `"가상 스크롤 활성"` 배지 + 총 행 수 표시 푸터

### 🎨 CSS 추가 (~140줄)
- HeatmapChart 스타일: 그리드 레이아웃, 셀 호버 애니메이션, 요일/시간 레이블, 범례 그라디언트
- VirtualTable 스타일: 컨테이너, 고정 헤더, 슬림 스크롤바, 푸터
- 반응형 브레이크포인트 확장 (1024px/768px 히트맵 및 가상테이블 조정)

### 수정된 파일 목록
| 파일 | 변경 내용 |
|------|----------|
| `api/dashboard/heatmap/route.ts` | [NEW] 시간대별 성과 히트맵 API |
| `components/HeatmapChart.tsx` | [NEW] 7×24 히트맵 시각화 컴포넌트 |
| `components/VirtualTable.tsx` | [NEW] 가상 스크롤 테이블 컴포넌트 |
| `hooks/useApi.ts` | `useHeatmap` 훅 추가 (10분 TTL) |
| `dashboard/page.tsx` | HeatmapChart 통합, 폴백 히트맵 데이터, 메트릭 토글 버튼 |
| `dashboard/keywords/page.tsx` | `useVirtualizer` 연동, 테이블 가상 스크롤 적용 |
| `globals.css` | HeatmapChart + VirtualTable 스타일 추가 (+140줄) |
| `package.json` | `@tanstack/react-virtual` 의존성 추가 |

---

## [1.2.0] - 2026-03-15

### 🧩 공통 UI 컴포넌트 신규 (5건)
- **Modal**: 접근성 지원 모달 컴포넌트 (`components/Modal.tsx`) — ESC 닫기, 배경 클릭 닫기, 사이즈 옵션 (`sm`/`md`/`lg`)
- **DateRangePicker**: 기간 선택 드롭다운 (`components/DateRangePicker.tsx`) — 프리셋(오늘/7일/30일/90일) + 캘린더 직접 선택
- **Breadcrumb**: 계층 탐색 네비게이션 (`components/Breadcrumb.tsx`) — 대시보드 하위 페이지 구조 표시
- **FunnelChart**: 전환 퍼널 시각화 (`components/FunnelChart.tsx`) — 노출→클릭→전환 단계별 바 차트 + 이탈률 표시
- **Skeleton/ErrorState/EmptyState**: 로딩·에러·빈 데이터 공통 상태 컴포넌트

### 📊 대시보드 KPI 기간 비교 (Period-over-Period)
- **Dashboard API** (`api/dashboard/route.ts`): `parsePeriod()` — 1d/7d/30d/90d 기간별 현재·이전 구간 자동 계산
- **증감률 계산**: `calcChange()` — 현재 vs 이전 기간 KPI 변화율 (WoW/DoD) 자동 산출
- **KPI 항목 변경**: 총 광고비, 평균 ROAS, 노출수, 전환수, 총 클릭수 + 각각 `*Change` 증감률 포함
- **대시보드 UI**: 기간 버튼 → `DateRangePicker` 교체, 날짜 범위 → `periodKey` 자동 변환

### 🧪 광고 소재 A/B 테스트 & 전환 퍼널
- **Ad 모델 확장** (`prisma/schema.prisma`): `impressions`, `clicks`, `ctr`, `conversions`, `conversionValue`, `cost` 성과 메트릭 + `testGroupId`, `isControl`, `testStatus` A/B 테스트 필드 추가
- **A/B 테스트 뷰** (`dashboard/ads/page.tsx`): Control vs Variant 통계 비교 카드 + CTR/CVR 바 차트
- **Z-검정 승자 판정**: `determineWinner()` — 클릭 100건 이상 시 p < 0.05 (z ≥ 1.96) 기준 통계적 유의성 판별
- **전환 퍼널 뷰**: `FunnelChart` 연동, 전체 CTR/CVR/전환율 카드 표시
- **3탭 뷰 모드**: 📋 소재 목록 · 🧪 A/B 테스트 · 📊 전환 퍼널

### 🔄 네이버 광고 API 안정성 강화
- **Exponential Backoff 재시도**: `requestWithRetry()` — 429/5xx 에러 시 최대 3회 재시도 (1s → 2s → 4s 지수 백오프)
- **에러 객체 개선**: `statusCode` 속성 추가로 재시도 가능 여부 판단

### 🌙 다크 모드 지원
- **자동 감지**: `prefers-color-scheme: dark` 미디어 쿼리 기반 시스템 설정 연동
- **수동 토글**: `data-theme="dark"` 속성으로 명시적 전환 지원
- **전체 CSS 변수 리매핑**: 배경·표면·텍스트·그림자 등 슬레이트 컬러 팔레트 적용

### 🔗 전체 페이지 API 훅 연동 (Phase 1 완료)
- 15개 대시보드 페이지 → SWR 기반 API 훅 연동 (Mock fallback 지원)
- `useApi.ts`에 18개 도메인 훅 완비

### 🎨 CSS 확장 (`globals.css`)
- Modal / Breadcrumb / DateRange Picker / Funnel Chart 스타일 추가
- 레이아웃 유틸리티 클래스: `.flex-between`, `.flex-center`, `.grid-4`, `.gap-*`, `.mb-*`, `.p-*`
- Sticky 테이블 컬럼: `.table-sticky` (체크박스 + 키워드명 고정)
- 반응형 추가 브레이크포인트: 1024px / 768px

### 수정된 파일 목록
| 파일 | 변경 내용 |
|------|----------|
| `globals.css` | Modal·Breadcrumb·DateRange·Funnel·Layout·Dark Mode·Responsive 스타일 추가 (+440줄) |
| `api/dashboard/route.ts` | 기간 비교 KPI (`parsePeriod`, `calcChange`, `getKpiForRange`) |
| `lib/naver-ads-api.ts` | Exponential Backoff 재시도 (`requestWithRetry`) |
| `prisma/schema.prisma` | Ad 모델 성과 메트릭 + A/B 테스트 필드 |
| `dashboard/page.tsx` | DateRangePicker 교체, Breadcrumb 추가, 증감률 KPI 반영 |
| `dashboard/ads/page.tsx` | A/B 테스트 뷰, 전환 퍼널 뷰, Modal 컴포넌트 전환, 타입 강화 |
| `dashboard/keywords/page.tsx` | Breadcrumb 추가 |
| `components/Modal.tsx` | [NEW] 접근성 지원 공통 모달 |
| `components/DateRangePicker.tsx` | [NEW] 날짜 범위 선택기 |
| `components/Breadcrumb.tsx` | [NEW] 계층 네비게이션 |
| `components/FunnelChart.tsx` | [NEW] 전환 퍼널 차트 |
| `hooks/useApi.ts` | 6개 신규 훅 추가 (useAdGroups, useAds, useSettings 등) |
| `dashboard/accounts/page.tsx` | useAccounts 훅 연동 + useEffect 변환 |
| `dashboard/campaigns/page.tsx` | useCampaigns 훅 연동 |
| `dashboard/click-fraud/page.tsx` | 부정클릭 훅 3종 연동 |
| `dashboard/automation/page.tsx` | useAiActions 훅 연동 |
| `dashboard/profitability/page.tsx` | useProfitability 훅 연동 |
| `dashboard/reports/page.tsx` | useReports, useReportTemplates 훅 연동 |
| `dashboard/notifications/page.tsx` | useNotifications 훅 연동 |
| `dashboard/audit-log/page.tsx` | useAuditLogs 훅 연동 |
| `dashboard/competitive/page.tsx` | useCompetitive 훅 연동 |

---

## [1.1.0] - 2026-03-12

### 🔍 검색 & 필터 구현 (5건)
- **대시보드**: 글로벌 검색 → 계정 테이블 + AI 액션 실시간 필터링
- **캠페인**: 캠페인/광고그룹 검색 실시간 필터링
- **키워드**: 키워드 검색 + 계정별/전략별 드롭다운 필터 + 필터 초기화 버튼
- **계정 관리**: 광고주명/고객ID 검색 필터

### 📁 파일 내보내기/가져오기 구현 (8건)
- **키워드 CSV 내보내기**: 전체 키워드 데이터 실제 CSV 다운로드 (BOM 인코딩)
- **키워드 CSV 가져오기**: 파일 선택 다이얼로그 → 업로드 처리
- **리포트 PDF**: 선택된 KPI 기반 인쇄용 HTML PDF 생성
- **시뮬레이터 PDF 제안서**: ROI 시뮬레이션 결과 PDF 내보내기
- **수익성 엑셀 내보내기**: 클라이언트 수익성 데이터 XML 스프레드시트 다운로드
- **감사 로그 CSV/PDF**: 필터링된 로그 데이터 CSV 및 PDF 내보내기
- **설정 활동 이력 CSV**: 활동 로그 CSV 다운로드

### ✨ UI 기능 완성 (11건)
- **이용약관/개인정보처리방침 모달**: 로그인 페이지 링크 클릭 시 모달 팝업
- **Enterprise 상담 신청 모달**: 가격 페이지 Enterprise CTA → 상담 폼 + 완료 상태
- **캠페인 광고그룹 입찰가 적용**: 입찰가 수정 후 적용 버튼으로 toast 알림
- **키워드 벌크 액션**: +100원/-100원/전략 변경/OFF 일괄 처리
- **부정클릭 IP 차단/환급/정상**: 선택된 이벤트에 대한 액션 처리 + 상태 업데이트
- **계정 3점 메뉴**: 동기화/상세 보기/삭제 드롭다운 메뉴
- **CSV 파일 업로드**: 계정 관리 전환 데이터 임포트 존 동작
- **시뮬레이터 저장/URL 공유**: localStorage 저장 + 클립보드 URL 복사
- **리포트 로고 업로드**: 파일 선택 → 이미지 미리보기 표시

### 🛠 공유 유틸리티 추가
- `src/utils/export.ts`: CSV(BOM), PDF(인쇄용 HTML), Excel(XML 스프레드시트) 내보내기 공통 함수

### 수정된 파일 목록
| 파일 | 변경 내용 |
|------|----------|
| `dashboard/page.tsx` | 글로벌 검색 필터 |
| `dashboard/campaigns/page.tsx` | 검색, 입찰가 적용 |
| `dashboard/keywords/page.tsx` | 검색/필터, CSV 내보내기/가져오기, 벌크 액션, 부정클릭 처리 |
| `dashboard/accounts/page.tsx` | 검색, 3점 메뉴, CSV 업로드, 삭제/동기화 |
| `dashboard/reports/page.tsx` | PDF 다운로드, 로고 업로드 |
| `dashboard/simulator/page.tsx` | 저장, URL 공유, PDF 제안서 |
| `dashboard/settings/page.tsx` | 활동 이력 CSV |
| `dashboard/audit-log/page.tsx` | CSV/PDF 내보내기 |
| `dashboard/profitability/page.tsx` | 엑셀 내보내기 |
| `(auth)/login/page.tsx` | 이용약관/개인정보 모달 |
| `(marketing)/pricing/page.tsx` | Enterprise 상담 신청 모달 |
| `utils/export.ts` | [NEW] 파일 내보내기 공통 유틸리티 |
