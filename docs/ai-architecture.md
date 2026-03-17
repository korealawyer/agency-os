# Agency OS — AI 기능 아키텍처 & 동작 설계서

> 작성일: 2026-03-17 | 버전: v1.2  
> 목적: 각 AI 기능이 실제 어떻게 동작하는지 기술하고, Mock → 실제 AI 전환 시 구현 방향을 정의

---

## 목차

1. [전체 아키텍처 개요](#1-전체-아키텍처-개요)
2. [AI 모델 연동 전략](#2-ai-모델-연동-전략)
3. [기능별 상세 동작 설계](#3-기능별-상세-동작-설계)
   - 3.1 코파일럿 AI 채팅
   - 3.2 자동 입찰 엔진
   - 3.3 ROI 시뮬레이터
   - 3.4 부정클릭 AI 분석
   - 3.5 경쟁사 AI 분석
   - 3.6 AI 키워드 추천
   - 3.7 광고 소재 AI 생성
   - 3.8 대시보드 AI 인사이트
   - 3.9 AI 리포트 자동 생성
4. [네이버 검색광고 API 연동](#4-네이버-검색광고-api-연동)
5. [데이터 흐름 & DB 스키마](#5-데이터-흐름--db-스키마)
6. [AI 알림 시스템](#6-ai-알림-시스템)
7. [에러 핸들링 & 재시도 전략](#7-에러-핸들링--재시도-전략)
8. [프롬프트 버저닝 & 관리](#8-프롬프트-버저닝--관리)
9. [모니터링 & 관측성](#9-모니터링--관측성)
10. [안전장치 & 비용 관리](#10-안전장치--비용-관리)
11. [플랜별 AI 기능 제한](#11-플랜별-ai-기능-제한)
12. [환경 변수 설정](#12-환경-변수-설정)
13. [개발 우선순위 & 마일스톤](#13-개발-우선순위--마일스톤)
14. [Vercel Cron 스케줄 설정](#14-vercel-cron-스케줄-설정)
15. [보안: API 키 암복호화](#15-보안-api-키-암복호화)
16. [스트리밍 응답 설계](#16-스트리밍-응답-설계)
17. [API 레이트 리미팅](#17-api-레이트-리미팅)
18. [테스트 전략](#18-테스트-전략)
19. [점진적 롤아웃 (Feature Flag)](#19-점진적-롤아웃-feature-flag)

---

## 1. 전체 아키텍처 개요

```
┌──────────────────────────────────────────────────────────────────┐
│                        사용자 (브라우저)                          │
│   ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────┐   │
│   │ 코파일럿  │  │ 자동입찰  │  │ 시뮬레이터│  │ 대시보드     │   │
│   │ 채팅 UI  │  │ 설정 UI  │  │    UI    │  │ 인사이트 패널│   │
│   └─────┬────┘  └─────┬────┘  └─────┬────┘  └──────┬───────┘   │
└─────────┼──────────────┼─────────────┼──────────────┼───────────┘
          │              │             │              │
          ▼              ▼             ▼              ▼
┌──────────────────────────────────────────────────────────────────┐
│                     Next.js API Routes                           │
│                                                                  │
│  /api/copilot/chat    ─── AI 대화형 분석                         │
│  /api/copilot/actions ─── AI 액션 로그 CRUD                      │
│  /api/cron/auto-bid   ─── 자동 입찰 배치 (NEW)                   │
│  /api/simulator       ─── ROI 시뮬레이션                         │
│  /api/click-fraud/*   ─── 부정클릭 분석                          │
│  /api/competitive     ─── 경쟁사 분석                            │
│  /api/keywords/recommend ── AI 키워드 추천 (NEW)                 │
│  /api/ads/generate    ─── 광고 소재 생성 (NEW)                   │
│  /api/dashboard       ─── 대시보드 인사이트 (NEW)                │
│  /api/reports/generate─── AI 리포트 생성 (NEW)                   │
│                                                                  │
└───────────┬──────────────┬──────────────┬────────────────────────┘
            │              │              │
            ▼              ▼              ▼
┌──────────────────┐ ┌────────────┐ ┌───────────────────────────┐
│  AI 모델 레이어   │ │  DB 레이어  │ │  외부 API                 │
│                  │ │            │ │                           │
│  ① Gemini Flash  │ │  Prisma    │ │  네이버 검색광고 API       │
│  ② OpenAI GPT   │ │  PostgreSQL│ │  (입찰가 변경, 순위 조회)  │
│  ③ Mock 폴백    │ │            │ │                           │
└──────────────────┘ └────────────┘ └───────────────────────────┘
```

### 핵심 원칙

| 원칙 | 설명 |
|------|------|
| **폴백 체인** | Gemini → OpenAI → Mock. API 키 없으면 항상 Mock으로 안전하게 동작 |
| **데이터 컨텍스트** | 모든 AI 호출에 실시간 DB 데이터를 시스템 프롬프트에 주입 |
| **액션 로그** | 모든 AI 판단/실행은 `AiActionLog` 테이블에 기록 |
| **감사 추적** | 입찰 변경 등 중요 액션은 `AuditLog`에 별도 기록 |
| **조직 격리** | 모든 쿼리는 `organizationId` 기준으로 데이터 격리 |
| **구조화 출력** | AI 응답은 JSON 파싱 → 검증 → 실행 (비정형 응답 거부) |

---

## 2. AI 모델 연동 전략

### 모델 선택 기준

```
┌─────────────────────────────────────────────────────────┐
│                   모델 라우터 (Model Router)              │
│                                                         │
│  IF 사용자 대면 기능 (채팅, 리포트, 인사이트, 소재)       │
│    └─→ GPT-4o (한국어 품질 + 분석 깊이)                  │
│                                                         │
│  IF 백그라운드 기능 (입찰, 분석, 추천)                    │
│    └─→ GPT-4o-mini (구조화된 판단, 비용 절감)            │
│                                                         │
│  IF API 키 미설정 또는 API 장애                          │
│    └─→ Mock 폴백 (정적 응답)                            │
└─────────────────────────────────────────────────────────┘
```

### 연동 코드 패턴 (기존 구현)

```typescript
// src/app/api/copilot/chat/route.ts — 이미 구현된 폴백 체인
let aiResponse: string;

// 1순위: Gemini
if (process.env.GEMINI_API_KEY) {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
    { method: 'POST', body: JSON.stringify({ ... }) }
  );
  aiResponse = result.candidates?.[0]?.content?.parts?.[0]?.text;
}
// 2순위: OpenAI
else if (process.env.OPENAI_API_KEY) {
  const res = await fetch('https://api.openai.com/v1/chat/completions', { ... });
  aiResponse = result.choices?.[0]?.message?.content;
}
// 3순위: Mock
else {
  aiResponse = getContextBasedResponse(message, context);
}
```

### 월 비용 예상

| 단계 | 구성 | 월 비용 |
|------|------|-------:|
| **MVP 초기** | Gemini(무료) + GPT-4o-mini | ₩5,630 ~ ₩21,900 |
| **품질 개선** | GPT-4o(대면) + GPT-4o-mini(백그라운드) | ₩93,500 ~ ₩345,900 |
| **프리미엄** | GPT-4o 단독 | ₩208,400 ~ ₩810,000 |

---

## 3. 기능별 상세 동작 설계

---

### 3.1 코파일럿 AI 채팅

> **상태: ✅ AI 연동 코드 구현 완료** (API 키 설정 시 즉시 활성화)

#### 동작 흐름

```
사용자 메시지 입력
    │
    ▼
[프론트엔드] POST /api/copilot/chat { message: "성과 요약해줘" }
    │
    ▼
[백엔드] 인증 확인 (requireAuth)
    │
    ▼
[컨텍스트 수집] DB에서 실시간 데이터 3가지 동시 조회
    ├── prisma.keyword.count()        → 총 키워드 수
    ├── prisma.naverAccount.count()   → 총 계정 수
    └── prisma.keyword.findMany()     → TOP10 고비용 키워드
    │
    ▼
[시스템 프롬프트 구성]
    "당신은 네이버 검색광고 전문 AI 어시스턴트입니다.
     현재 계정: {accountCount}개, 키워드: {keywordCount}개
     상위 키워드: 형사변호사(₩1,200, CTR 3.2%, 전환 12건)..."
    │
    ▼
[AI 모델 호출] Gemini → OpenAI → Mock 폴백
    │
    ▼
[AiActionLog 저장] 대화 이력 DB 기록
    │
    ▼
[AuditLog 기록] 감사 로그
    │
    ▼
[응답 반환] { response: "📊 전체 계정 성과 요약..." }
```

#### 프롬프트 설계

| 구성 요소 | 내용 |
|-----------|------|
| **역할 정의** | 네이버 검색광고 전문 AI 어시스턴트 |
| **응답 스타일** | 한국어, 마크다운 테이블, 이모지 활용 |
| **실시간 데이터** | 키워드 수, 계정 수, TOP10 키워드(비용/CTR/전환) |
| **temperature** | 0.7 (창의성과 정확성의 균형) |

#### 대화 히스토리 관리 (개선 필요)

```
현재: 단일 메시지만 전송 (대화 맥락 없음)
개선: 최근 N개 대화를 messages 배열로 전달

[구현 방향]
- 프론트: messages[] 상태를 API에 전달 (최근 10턴)
- 백엔드: messages 배열 → OpenAI messages 형식으로 변환
- 토큰 제한: 총 입력 토큰이 3,000 초과 시 오래된 메시지 자동 제거
```

#### 지원 분석 유형

| 질문 유형 | 키워드 트리거 | AI가 하는 일 |
|-----------|:---:|------|
| 성과 요약 | "성과", "요약" | 계정별 KPI, 전일대비 변화, 하이라이트 |
| 키워드 추천 | "키워드", "추천" | 운영 키워드 분석 → 신규 키워드 제안 |
| 입찰 최적화 | "입찰", "ROAS" | 저성과 키워드 입찰가 조정 제안 |
| 부정클릭 | "부정", "클릭" | 의심 IP 분석 → 차단 권장 |
| 경쟁사 분석 | "경쟁" | 순위 비교, 위협도 평가 |
| 개선 제안 | "개선", "제안" | 캠페인별 TOP 5 액션 추천 |

---

### 3.2 자동 입찰 엔진

> **상태: 🔨 UI 구현 완료, AI 로직 개발 필요**

#### 전체 동작 흐름

```
[스케줄러] Vercel Cron (매시 정각) 또는 수동 트리거
    │
    ▼
POST /api/cron/auto-bid (NEW)
    │
    ▼
[1단계: 대상 수집]
    DB에서 자동입찰 활성 키워드 조회
    WHERE isAutoManaged = true AND deletedAt IS NULL
    ├── bidStrategy = 'target_rank' | 'target_cpc' | 'target_roas' | ...
    ├── confirmMode = 'full' (즉시 실행) | 'semi' (승인 대기)
    └── 안전장치 설정 (상한/하한/속도제한)
    │
    ▼
[2단계: AI 배치 분석] 500개씩 묶어 AI 호출
    ┌────────────────────────────────────┐
    │  시스템 프롬프트:                   │
    │  "당신은 입찰가 최적화 전문가입니다. │
    │   각 키워드의 성과 데이터를 분석하여  │
    │   입찰가 조정을 JSON으로 응답하세요." │
    │                                    │
    │  입력 데이터:                       │
    │  - 키워드: 형사변호사               │
    │  - 전략: target_rank (목표 3위)     │
    │  - 현재 입찰가: ₩1,200             │
    │  - 현재 순위: 5위                   │
    │  - CTR: 3.2%, ROAS: 280%          │
    │  - 안전장치: 상한 ₩10,000, 하한 ₩70│
    └────────────────────────────────────┘
    │
    ▼
[3단계: AI 응답 파싱 & 검증]
    JSON Schema 검증 (zod)
    {
      "keyword": "형사변호사",
      "currentBid": 1200,
      "recommendedBid": 1350,
      "reason": "목표 3위 대비 현재 5위. CTR 양호하므로 +12% 인상 권장",
      "confidence": 0.85
    }
    ※ JSON 파싱 실패 시 → 해당 배치 스킵, 에러 로그 기록
    │
    ▼
[4단계: 안전장치 검증]
    ├── ₩1,350 ≤ 상한(₩10,000)? ✅
    ├── ₩1,350 ≥ 하한(₩70)? ✅
    ├── 변경폭 ₩150 ≤ 1회 제한(₩50)? ❌ → 3회로 분할 실행
    ├── 일예산 잔여? ✅
    └── 오늘 해당 키워드 변경 횟수 < 3? ✅
    │
    ▼
[5단계: 실행 분기]
    ├── Full Auto → NaverAdsClient.updateBid() 즉시 호출
    ├── Semi Auto → Notification 생성 + AiActionLog(isApproved=null)
    └── Manual → AI 추천만 표시, 사용자 직접 실행
    │
    ▼
[6단계: 실행 후 검증] (Full Auto 시)
    60분 후 성과 확인:
    ├── ROAS/CTR 개선 → 유지
    └── 성과 악화 → 자동 롤백 (이전 입찰가 복원)
    │
    ▼
[7단계: 기록]
    ├── BidHistory { oldBid, newBid, reason, changedBy: 'ai' }
    ├── AiActionLog { actionType: 'bid_adjustment', confidence, inputData, outputData }
    └── AuditLog { action: 'UPDATE', entityType: 'Keyword' }
```

#### 6가지 입찰 전략 (DB enum: `BidStrategy`)

| # | 전략 | AI 판단 기준 | 입력 데이터 | 출력 |
|---|------|-------------|------------|------|
| 1 | **target_rank** | 현재 순위 vs 목표 순위 차이 | `RankSnapshot`, 입찰가 | 순위 도달에 필요한 최소 입찰가 |
| 2 | **target_cpc** | 실제 CPC vs 목표 CPC 차이 | 클릭수, 비용, CPC | 목표 CPC 내 최적 입찰가 |
| 3 | **target_roas** | 전환-비용 비율 최적화 | `conversionValue`, `cost` | ROAS 목표 달성 입찰가 |
| 4 | **max_conversion** | 예산 내 전환 극대화 | 전환율, CPA, 예산 | 전환 단가 최소화 입찰가 |
| 5 | **time_based** | 시간대별 전환율 분석 | `BidHistory` 시간대별 집계 | 시간대별 입찰 배율 |
| 6 | **manual** | AI 추천만 제공 | 전체 성과 데이터 | 추천 입찰가 (실행 X) |

#### Optimistic Locking (동시성 제어)

```
Keyword 테이블에 version 컬럼 존재 (기존 구현)

[동작]
1. 키워드 조회 시 version 값 확인 (예: version = 3)
2. 입찰 변경 시 WHERE id = ? AND version = 3
3. UPDATE SET currentBid = newBid, version = version + 1
4. 갱신된 행 0 → 다른 프로세스가 먼저 변경함 → 스킵
```

#### 안전장치 체계

```
┌────────────────────────────────────────────┐
│              안전장치 계층                   │
│                                            │
│  [L1] 일예산 상한 ─── 설정값 초과 시 중단   │
│  [L2] 입찰가 상한 ─── ₩10,000 초과 불가     │
│  [L3] 입찰가 하한 ─── ₩70 미만 불가         │
│  [L4] 속도 제한  ─── 1회 ±50원, 1시간 3회   │
│  [L5] 신뢰도 필터 ── AI confidence < 0.6 스킵│
│  [L6] 자동 롤백  ─── 1시간 후 성과 악화 복원 │
│  [L7] 버전 락   ─── Optimistic Lock 충돌 방지│
└────────────────────────────────────────────┘
```

---

### 3.3 ROI 시뮬레이터

> **상태: ✅ 로직 구현 완료** (수학 기반, AI 강화 예정)

#### 현재 동작 흐름

```
[사용자 입력] 업종, 월 예산, 키워드 목록
    │
    ▼
[계산 엔진] 업종별 평균 CPC × 전환율로 산출
    ├── clicks = budget ÷ avgCpc
    ├── impressions = clicks ÷ CTR(0.05)
    ├── conversions = clicks × convRate
    ├── roas = (conversions × 150,000) ÷ budget × 100
    └── 95% 신뢰구간 = 결과 × (0.75 ~ 1.25)
    │
    ▼
[키워드별 분배] 키워드 수에 따른 전환 예측
    │
    ▼
[결과 표시] 테이블 + 막대 차트 + PDF 내보내기
```

#### AI 강화 방향 (NEW)

| 현재 (수학) | AI 강화 후 |
|-------------|----------|
| 업종별 고정 상수 사용 | AI가 실제 DB 데이터로 업종별 CPC/전환율 동적 계산 |
| 키워드 균등 분배 | AI가 키워드별 경쟁도/검색량 반영 차등 분배 |
| 정적 추천 문구 | AI가 맞춤형 전략 제안서 생성 |

---

### 3.4 부정클릭 AI 분석

> **상태: 🔨 데이터 수집 구현됨, AI 분석 로직 개발 필요**

#### 기존 DB 스키마 (이미 구현)

```
ClickFraudEvent 필드:
  ipHash, userAgent, deviceFingerprint, geoCountry, geoRegion,
  sessionId, landingUrl, dwellTimeMs, fraudScore, triggeredRules,
  status (pending | confirmed | dismissed)

BlockedIp 필드:
  ipHash, ipMasked, blockReason (rule_based | ml_detected | manual),
  triggeredRules, fraudCount, estimatedLoss, expiresAt

ClickFraudDailySummary 필드:
  totalClicks, fraudClicks, fraudRate, estimatedLoss,
  blockedIpsCount, refundRequested, refundApproved
```

#### AI 분석 동작 흐름

```
[데이터 수집] 클릭 이벤트 → ClickFraudEvent 테이블
    │
    ▼
[AI 분석 배치] POST /api/click-fraud/analyze (NEW, 매 4시간)
    │
    ▼
┌───────────────────────────────────────────────────┐
│  AI 분석 대상 데이터:                               │
│                                                   │
│  - IP 주소별 클릭 빈도/패턴 (ipHash → 그룹화)       │
│  - 클릭 후 체류 시간 (dwellTimeMs < 1000 = 의심)    │
│  - 동일 IP 반복 클릭 간격                          │
│  - VPN/프록시 접속 여부 (geoCountry 기반)           │
│  - 디바이스 핑거프린트별 패턴 (deviceFingerprint)    │
│  - 시간대별 클릭 분포 이상                          │
└───────────────────────────────────────────────────┘
    │
    ▼
[AI 판단] 각 IP에 대해:
    ├── fraudScore: 0.0 ~ 1.0
    ├── reason: "동일 IP 10분 내 3회 클릭, 체류 1초 미만"
    ├── recommendation: "즉시 차단" | "모니터링" | "정상"
    └── estimated_savings: ₩350,000/주
    │
    ▼
[액션 분기]
    ├── fraudScore ≥ 0.8 → BlockedIp 자동 등록 (blockReason: 'ml_detected')
    ├── fraudScore ≥ 0.5 → Notification 발송 (type: 'anomaly_detected', priority: 'high')
    └── fraudScore < 0.5 → 로그만 기록, status: 'dismissed'
    │
    ▼
[리포트] ClickFraudDailySummary 자동 집계
```

---

### 3.5 경쟁사 AI 분석

> **상태: 🔨 데이터 수집 구현됨, AI 분석 로직 개발 필요**

#### 기존 DB 스키마 (이미 구현)

```
CompetitiveIntel: keywordText, top5Ads(JSON), estimatedBidLow/High, competitorCount
RankSnapshot: rank, page, device(pc|mobile), capturedAt
```

#### AI 분석 동작 흐름

```
[데이터 수집] 네이버 API → RankSnapshot + CompetitiveIntel (일 1회)
    │
    ▼
[AI 분석] POST /api/competitive/analyze (NEW)
    │
    ▼
[입력]
    ├── 키워드별 순위 추이 (7일/30일, RankSnapshot)
    ├── 경쟁사별 예상 입찰가 변동 (CompetitiveIntel.estimatedBid)
    ├── 경쟁사 광고 소재 변경 이력 (top5Ads JSON 비교)
    └── 전체 경쟁사 수 변동 (competitorCount)
    │
    ▼
[AI 출력]
    ├── 경쟁사별 위협도 평가 (🔴🟡🟢)
    ├── 순위 하락 리스크 키워드 식별
    ├── 대응 전략 제안 (입찰가 조정, 소재 변경 등)
    └── 주간 경쟁 트렌드 요약
    │
    ▼
[알림 연동]
    순위 2단계 이상 하락 감지 시:
    └── Notification { type: 'competitor_change', priority: 'high' }
```

---

### 3.6 AI 키워드 추천

> **상태: 🔨 개발 필요 (NEW)**

#### 동작 흐름

```
[트리거] 사용자 요청 또는 주간 자동 분석
    │
    ▼
POST /api/keywords/recommend (NEW)
    │
    ▼
[1단계: 기존 키워드 분석]
    DB에서 현재 활성 키워드 조회
    ├── 고성과 키워드 패턴 추출 (CTR > 3%, ROAS > 200%)
    └── 저성과 키워드 패턴 추출 (ROAS < 100%)
    │
    ▼
[2단계: AI 추천] — GPT-4o-mini (백그라운드)
    ├── 신규 키워드 추천 (업종 + 고성과 패턴 기반)
    └── 퇴출 키워드 제안 (장기 저성과)
    │
    ▼
[3단계: 응답]
    { recommendations: [...], remove_suggestions: [...] }
    │
    ▼
[4단계: 액션]
    AiActionLog { actionType: 'keyword_recommendation' }
```

---

### 3.7 광고 소재 AI 생성

> **상태: 🔨 개발 필요 (NEW)**

#### 동작 흐름

```
[트리거] 사용자가 A/B 테스트 소재 생성 요청
    │
    ▼
POST /api/ads/generate (NEW) — GPT-4o (대면 기능)
    │
    ▼
[입력]
    { keyword, industry, currentTitles[], currentDescriptions[] }
    │
    ▼
[AI 생성]
    시스템: "네이버 검색광고 카피라이터. 
            네이버 광고 규정(제목 15자, 설명 45자) 준수.
            클릭률을 높이는 제목/설명을 3세트 생성."
    │
    ▼
[출력 검증]
    ├── 제목 15자 이내? → 초과 시 자동 트리밍 + 경고
    ├── 설명 45자 이내? → 초과 시 자동 트리밍 + 경고
    └── 금지어/규정 위반? → 필터링
    │
    ▼
[DB 연동]
    생성된 소재를 Ad 테이블에 testStatus: 'running', isControl: false로 저장
    AiActionLog { actionType: 'creative_suggestion' }
```

---

### 3.8 대시보드 AI 인사이트

> **상태: 🔨 개발 필요 (NEW)**

#### 동작 흐름

```
[트리거] 대시보드 페이지 로딩 시 자동 호출 (5분 캐싱)
    │
    ▼
GET /api/dashboard/insights (NEW) — GPT-4o (대면)
    │
    ▼
[데이터 수집]
    ├── 오늘 vs 어제 KPI 비교 (impressions, clicks, conversions, cost)
    ├── 이상 징후 (CTR 30%+ 급락, 일예산 90%+ 소진)
    ├── 자동입찰 실행 결과 요약 (BidHistory 오늘자)
    └── 부정클릭 탐지 현황 (ClickFraudDailySummary)
    │
    ▼
[AI 분석]
    3~5문장의 핵심 인사이트 생성
    │
    ▼
[캐싱] Redis 또는 메모리 캐시 (5분 TTL)
    │
    ▼
[출력] 대시보드 상단 AI 패널에 표시
```

---

### 3.9 AI 리포트 자동 생성 (추가)

> **상태: 🔨 개발 필요 (NEW)**

기존 `ReportTemplate` + `Report` 테이블을 활용한 AI 리포트 생성.

#### 동작 흐름

```
[트리거] 
    ├── 수동: 사용자가 "리포트 생성" 클릭
    └── 자동: Cron (ReportTemplate.scheduleType: 'weekly' | 'monthly')
    │
    ▼
POST /api/reports/generate (NEW) — GPT-4o (대면)
    │
    ▼
[1단계: 템플릿 로딩]
    ReportTemplate { kpiConfig, layoutConfig, naverAccountIds }
    │
    ▼
[2단계: 데이터 수집]
    기간(periodStart~periodEnd) 내 KPI 데이터 조회
    ├── Campaign 성과 (비용, 클릭, 전환, ROAS)
    ├── Keyword TOP/WORST 10
    ├── BidHistory 변경 이력
    ├── CompetitiveIntel 경쟁사 순위 변동
    └── ClickFraudDailySummary 부정클릭 현황
    │
    ▼
[3단계: AI 리포트 작성]
    시스템: "대행사 리포트 작성 전문가. 
            광고주에게 보내는 성과 리포트를 작성하세요.
            섹션: 1.요약, 2.KPI분석, 3.키워드분석, 
            4.경쟁분석, 5.개선제안"
    │
    ▼
[4단계: 저장 & 발송]
    Report { title, fileUrl, sentAt, sentTo }
    recipientEmails로 이메일 발송
    Notification { type: 'report_sent' }
```

---

## 4. 네이버 검색광고 API 연동

기존 구현된 `NaverAdsClient` 클래스가 AI 기능과 직접 연동됩니다.

### 구현 완료 메서드

| 메서드 | AI 연동 기능 | 설명 |
|--------|-------------|------|
| `updateBid(keywordId, bidAmt)` | 자동 입찰 | 입찰가 변경 실행 |
| `setKeywordStatus(keywordId, userLock)` | 키워드 ON/OFF | 저성과 키워드 중지 |
| `updateCampaignBudget(campaignId, budget)` | 예산 최적화 | 캠페인별 예산 조정 |
| `getKeywordStats(ids, start, end)` | 모든 AI 분석 | 성과 데이터 조회 |
| `getCampaigns()` / `getAdGroups()` | 데이터 동기화 | 구조 동기화 |

### API 인증 (HMAC-SHA256)

```
요청 헤더:
  X-API-KEY: {apiKey}
  X-Customer: {customerId}
  X-Timestamp: {timestamp_ms}
  X-Signature: HMAC-SHA256(secretKey, "${timestamp}.${method}.${path}")
```

### 재시도 로직 (구현 완료)

```
Exponential Backoff:
  429 (Rate Limit), 500, 502, 503, 504 → 재시도
  최대 3회: 1초 → 2초 → 4초
  그 외 에러 → 즉시 throw
```

### AI → 네이버 API 실행 흐름

```
[AI 판단] recommendedBid: ₩1,350
    │
    ▼
[안전장치 검증] PASS
    │
    ▼
[NaverAdsClient.updateBid(keywordId, 1350)]
    │
    ├── 성공 → BidHistory 기록 + Keyword.currentBid 갱신
    └── 실패 → 재시도 3회 → 실패 시 Notification(type: 'api_error')
```

---

## 5. 데이터 흐름 & DB 스키마

### AI 관련 테이블 관계도

```
Organization (조직 격리)
    │
    ├── Keyword ──────────── AI 자동입찰 대상
    │   ├── bidStrategy     (target_rank | target_cpc | ...)
    │   ├── isAutoManaged   (true = AI 관리)
    │   ├── version         (Optimistic Locking)
    │   └── BidHistory[]    ← 입찰 변경 이력
    │       ├── oldBid, newBid
    │       ├── reason       (AI 판단 근거)
    │       └── changedBy    (ai | manual | system)
    │
    ├── AiActionLog ──────── AI 판단 이력 (ALL 기능 公통)
    │   ├── actionType       (bid_adjustment | keyword_recommendation |
    │   │                     report_generation | anomaly_alert |
    │   │                     creative_suggestion)
    │   ├── inputData        (AI에 전달한 데이터 JSON)
    │   ├── outputData       (AI 응답 JSON)
    │   ├── confidence       (0.00 ~ 1.00)
    │   └── isApproved       (null=대기, true=승인, false=거부)
    │
    ├── ClickFraudEvent ──── 부정클릭 분석 원본
    │   └── BlockedIp        ← AI 탐지 결과
    │       └── blockReason  (rule_based | ml_detected | manual)
    │
    ├── CompetitiveIntel ─── 경쟁사 AI 분석 원본
    │   └── top5Ads (JSON)   ← 경쟁사 소재 비교용
    │
    ├── ReportTemplate ───── AI 리포트 템플릿
    │   └── Report[]         ← 생성된 리포트
    │
    └── Notification ──────── AI 알림
        └── type             (bid_change | anomaly_detected |
                              competitor_change | budget_alert | ...)
```

### 데이터 수집 → AI 분석 → 실행 사이클

```
네이버 광고 API ──→ DB 동기화 ──→ AI 분석 ──→ 액션 실행
     (cron/sync-naver)    (매 1시간)   (매 배치)   (Full/Semi/Manual)
          │                    │           │              │
          ▼                    ▼           ▼              ▼
     Campaign 동기화      최신 데이터   판단 생성      입찰 변경
     AdGroup 동기화       DB 반영      로그 저장      IP 차단
     Keyword 동기화                   알림 생성      소재 변경
     Stats 동기화                                   리포트 발송
```

---

## 6. AI 알림 시스템

기존 `Notification` 테이블과 연동하여 AI 이벤트를 사용자에게 전달합니다.

### AI 트리거 알림 유형

| NotificationType | 트리거 조건 | 우선순위 | 설명 |
|:---:|---|:---:|---|
| `bid_change` | AI 자동 입찰 실행 완료 | normal | "형사변호사 입찰가 ₩1,200→₩1,350" |
| `anomaly_detected` | 성과 이상 징후 감지 | high | "B 성형외과 CTR 50% 급락" |
| `competitor_change` | 경쟁사 순위 역전 | high | "법무법인 정의가 '이혼변호사' 1위 탈환" |
| `budget_alert` | 일예산 90% 소진 | urgent | "C 치과의원 예산 90% 소진" |
| `churn_prediction` | 광고주 이탈 예측 | high | "D 부동산 30일간 로그인 0회" |
| `report_sent` | 리포트 자동 발송 | normal | "주간 리포트 5개 계정 발송 완료" |
| `api_error` | 네이버 API 연속 실패 | urgent | "네이버 API 3회 연속 실패" |

### 알림 채널

```
Notification.channels (JSON):
  ["in_app"]              ← 기본: 앱 내 알림
  ["in_app", "email"]     ← 긴급: 이메일 동시 발송 (향후)
  ["in_app", "slack"]     ← 향후: Slack 웹훅 연동
```

---

## 7. 에러 핸들링 & 재시도 전략

### AI API 호출 에러 처리

```
[AI API 호출]
    │
    ├── 200 OK → 정상 처리
    │
    ├── 429 Rate Limit → 지수 백오프 재시도 (1s, 2s, 4s)
    │
    ├── 500/502/503 → 재시도 3회 → 실패 시 Mock 폴백
    │
    ├── 400 Bad Request → 프롬프트 문제 → 에러 로그 + Mock 폴백
    │
    ├── JSON 파싱 실패 → AI가 비정형 응답 → Mock 폴백 + 알림
    │
    └── 네트워크 타임아웃 (30초) → Mock 폴백
```

### 네이버 API 에러 처리

```
[네이버 API 호출]
    │
    ├── 200 OK → 정상
    │
    ├── 429 → Exponential Backoff (기존 구현)
    │
    ├── 500~504 → 재시도 (기존 구현)
    │
    ├── 401 → API 키 만료 → Notification(type: 'api_error', priority: 'urgent')
    │
    └── 연속 3회 실패 → 해당 계정 동기화 중단 + 관리자 알림
```

### 에러 로그 구조

```typescript
// 모든 AI 에러는 AiActionLog에 기록
AiActionLog.create({
  actionType: 'bid_adjustment',
  entityType: 'error',
  inputData: { prompt, model, attempt },
  outputData: { error: message, statusCode, rawResponse },
  confidence: 0,
  isApproved: false,
});
```

---

## 8. 프롬프트 버저닝 & 관리

### 프롬프트 관리 구조

```
src/lib/ai/
  ├── prompts/
  │   ├── copilot-chat.ts       ── v1.0 코파일럿 채팅
  │   ├── auto-bid.ts           ── v1.0 자동 입찰
  │   ├── click-fraud.ts        ── v1.0 부정클릭 분석
  │   ├── competitive.ts        ── v1.0 경쟁사 분석
  │   ├── keyword-recommend.ts  ── v1.0 키워드 추천
  │   ├── ad-creative.ts        ── v1.0 소재 생성
  │   ├── report.ts             ── v1.0 리포트 생성
  │   └── dashboard-insight.ts  ── v1.0 대시보드 인사이트
  │
  ├── model-router.ts     ── 기능별 모델 배정 로직
  ├── ai-client.ts        ── 통합 AI 호출 클라이언트
  └── response-parser.ts  ── JSON 파싱 + 검증
```

### 프롬프트 버전 관리 원칙

| 원칙 | 설명 |
|------|------|
| **버전 태깅** | 각 프롬프트 파일에 `PROMPT_VERSION = 'v1.0'` 상수 |
| **A/B 테스트** | 프롬프트 변경 시 기존/신규 버전 병행 → 성과 비교 |
| **로그 추적** | `AiActionLog.inputData`에 프롬프트 버전 기록 |
| **롤백** | 성과 악화 시 이전 버전 즉시 복원 |

---

## 9. 모니터링 & 관측성

### AI 성능 메트릭 (추적 대상)

| 메트릭 | 측정 방법 | 알림 기준 |
|--------|----------|----------|
| **AI 응답 시간** | API 응답 latency | > 10초 시 경고 |
| **폴백 비율** | Mock 응답 / 전체 응답 | > 30% 시 경고 |
| **JSON 파싱 실패율** | 파싱 에러 / 전체 응답 | > 10% 시 경고 |
| **자동입찰 승률** | 입찰 후 성과 개선 비율 | < 60% 시 프롬프트 검토 |
| **일일 AI 호출 수** | AiActionLog COUNT | 한도 80% 도달 시 경고 |
| **일일 API 비용** | 토큰 사용량 × 단가 | 예산 80% 도달 시 경고 |

### 대시보드 연동

```
/dashboard (메인)
    └── AI 상태 패널 추가
        ├── 오늘 AI 호출 수: 127회
        ├── 평균 응답 시간: 1.2초
        ├── 폴백 비율: 0%
        ├── 자동입찰 실행: 45건 (승률 78%)
        └── 부정클릭 탐지: 12건
```

---

## 10. 안전장치 & 비용 관리

### AI 호출 비용 제어

| 제어 장치 | 설명 |
|-----------|------|
| **배치 처리** | 10만 키워드 → 500개씩 묶어 200회 호출 (개별 호출 대비 99.8% 절감) |
| **응답 캐싱** | 동일 쿼리 1시간 캐싱, 대시보드 인사이트 5분 캐싱 |
| **일일 호출 한도** | `AI_DAILY_CALL_LIMIT` 환경변수로 제한 |
| **pollingInteval** | 최대 1일 1회 AI, 나머지 규칙 기반 |
| **토큰 제한** | max_tokens: 2,000 (입력 3,000 이내) |
| **폴백 전략** | API 실패 시 Mock 응답으로 UX 유지 |

### 입찰 안전장치

| 레벨 | 장치 | 기본값 | 설명 |
|------|------|--------|------|
| L1 | 일예산 상한 | 100% | 설정 비율 초과 시 입찰 중단 |
| L2 | 입찰가 상한 | ₩10,000 | 키워드당 최대 입찰가 |
| L3 | 입찰가 하한 | ₩70 | 키워드당 최소 입찰가 |
| L4 | 변경 속도 | ±₩50/회, 3회/시 | 급격한 변동 방지 |
| L5 | AI 신뢰도 | 0.6 이상만 실행 | 낮은 확신 판단 스킵 |
| L6 | 자동 롤백 | 1시간 후 확인 | 성과 악화 시 복원 |
| L7 | Optimistic Lock | `version` 컬럼 | 동시성 충돌 방지 |

---

## 11. 플랜별 AI 기능 제한

기존 `PlanType` enum을 활용한 단계별 AI 기능 오픈:

| 기능 | personal | starter | growth | scale | enterprise |
|------|:--------:|:-------:|:------:|:-----:|:----------:|
| 코파일럿 채팅 | 5회/일 | 30회/일 | 무제한 | 무제한 | 무제한 |
| 자동 입찰 | ❌ | Semi만 | Full 가능 | Full 가능 | Full 가능 |
| 부정클릭 AI | ❌ | 기본 | 상세 | 상세 | 상세+커스텀 |
| AI 리포트 | ❌ | 월 1회 | 주 1회 | 무제한 | 무제한 |
| 소재 AI 생성 | ❌ | ❌ | 5회/월 | 무제한 | 무제한 |
| 키워드 추천 | ❌ | 월 1회 | 주 1회 | 무제한 | 무제한 |
| 경쟁사 AI | ❌ | ❌ | 기본 | 상세 | 상세+알림 |
| 대시보드 인사이트 | ❌ | ❌ | ✅ | ✅ | ✅ |

---

## 12. 환경 변수 설정

### 필수 (AI 활성화)

```env
# AI 모델 — 아래 중 최소 1개 설정
GEMINI_API_KEY=your_gemini_api_key          # 1순위 (무료 티어 가능)
OPENAI_API_KEY=your_openai_api_key          # 2순위
OPENAI_MODEL=gpt-4o-mini                    # 기본 모델 (백그라운드)
OPENAI_MODEL_PREMIUM=gpt-4o                 # 대면 기능용 (선택)
```

### 선택 (비용 / 안전장치)

```env
# 비용 제어
AI_DAILY_CALL_LIMIT=1000                    # 일일 최대 AI 호출 수
AI_CACHE_TTL=3600                           # AI 응답 캐시 (초)
AI_MAX_INPUT_TOKENS=3000                    # 최대 입력 토큰
AI_MAX_OUTPUT_TOKENS=2000                   # 최대 출력 토큰

# 자동입찰 안전장치
AUTO_BID_ENABLED=true                       # 자동입찰 활성화
AUTO_BID_MAX_BID=10000                      # 입찰가 상한 (원)
AUTO_BID_MIN_BID=70                         # 입찰가 하한 (원)
AUTO_BID_MAX_CHANGE=50                      # 1회 최대 변경폭 (원)
AUTO_BID_MAX_HOURLY=3                       # 시간당 최대 변경 횟수
AUTO_BID_MIN_CONFIDENCE=0.6                 # 최소 AI 신뢰도
AUTO_BID_ROLLBACK_MINUTES=60               # 자동 롤백 확인 시간 (분)
AUTO_BID_BATCH_SIZE=500                    # 배치당 키워드 수

# 스케줄러
CRON_SECRET=your_cron_secret                # Cron Job 인증 키
```

---

## 13. 개발 우선순위 & 마일스톤

### Phase 1: 즉시 활성화 (1일)

| # | 기능 | 작업 | 난이도 |
|---|------|------|:------:|
| 1 | 코파일럿 채팅 | `.env`에 `GEMINI_API_KEY` 추가 | ⭐ |
| 2 | 대화 히스토리 | messages[] 전달 로직 추가 | ⭐ |

### Phase 2: 핵심 AI 엔진 (1~2주)

| # | 기능 | 작업 | 난이도 |
|---|------|------|:------:|
| 3 | AI 공통 모듈 | `src/lib/ai/` 구조, ai-client, model-router | ⭐⭐ |
| 4 | 자동 입찰 엔진 | cron/auto-bid + 안전장치 + 네이버 API 연동 | ⭐⭐⭐ |
| 5 | 부정클릭 AI | click-fraud/analyze + ML 점수 산출 | ⭐⭐ |

### Phase 3: 부가 AI 기능 (2~3주)

| # | 기능 | 작업 | 난이도 |
|---|------|------|:------:|
| 6 | 대시보드 인사이트 | dashboard/insights + 캐싱 | ⭐⭐ |
| 7 | 키워드 추천 | keywords/recommend | ⭐⭐ |
| 8 | 경쟁사 AI | competitive/analyze | ⭐⭐ |
| 9 | AI 리포트 | reports/generate + 이메일 발송 | ⭐⭐ |
| 10 | 소재 생성 | ads/generate + 규정 검증 | ⭐⭐ |

### Phase 4: 고도화 (3~4주)

| # | 기능 | 작업 | 난이도 |
|---|------|------|:------:|
| 11 | 플랜별 제한 | 미들웨어 + 사용량 카운터 | ⭐⭐ |
| 12 | 모니터링 대시보드 | AI 성능 메트릭 패널 | ⭐⭐ |
| 13 | 프롬프트 A/B 테스트 | 버전별 성과 비교 | ⭐⭐ |
| 14 | 시뮬레이터 AI 강화 | 실 데이터 기반 예측 | ⭐ |

---

## 14. Vercel Cron 스케줄 설정

현재 `vercel.json`에 Cron Job이 등록되어 있지 않습니다. AI 기능 활성화 시 아래 설정이 필요합니다.

### 필요한 Cron 설정

```json
// vercel.json — 추가 필요
{
  "crons": [
    {
      "path": "/api/cron/sync-naver",
      "schedule": "0 * * * *"
    },
    {
      "path": "/api/cron/auto-bid",
      "schedule": "30 * * * *"
    },
    {
      "path": "/api/click-fraud/analyze",
      "schedule": "0 */4 * * *"
    },
    {
      "path": "/api/competitive/analyze",
      "schedule": "0 6 * * *"
    },
    {
      "path": "/api/reports/generate",
      "schedule": "0 9 * * 1"
    }
  ]
}
```

### 스케줄 요약

| Cron Job | 경로 | 스케줄 | 설명 |
|----------|------|--------|------|
| **네이버 동기화** | `/api/cron/sync-naver` | 매시 정각 | DB ← 네이버 API 최신 데이터 |
| **자동 입찰** | `/api/cron/auto-bid` | 매시 30분 | 동기화 30분 후 실행 (최신 데이터 보장) |
| **부정클릭 분석** | `/api/click-fraud/analyze` | 4시간마다 | 누적 클릭 패턴 분석 |
| **경쟁사 분석** | `/api/competitive/analyze` | 매일 06:00 | 업무 시작 전 경쟁 현황 갱신 |
| **리포트 발송** | `/api/reports/generate` | 매주 월 09:00 | 주간 리포트 자동 생성+발송 |

### Cron 보안

```
모든 Cron 엔드포인트는 CRON_SECRET 헤더로 인증:
  Authorization: Bearer ${CRON_SECRET}

Vercel은 Cron 호출 시 자동으로 이 헤더를 주입합니다.
수동 테스트 시: curl -X POST -H "Authorization: Bearer xxx" /api/cron/auto-bid
```

### 멱등성 (Idempotency)

```
Cron Job이 네트워크 이유로 2회 실행될 수 있으므로:

[자동입찰] → BidHistory에서 최근 1시간 내 동일 키워드 변경 확인
            → 이미 변경됨 → 스킵

[부정클릭] → 분석 시작 시 lastAnalyzedAt 기록
            → 중복 실행 시 이전 분석 이후 데이터만 처리

[리포트]   → Report 테이블에서 동일 기간 리포트 존재 확인
            → 이미 존재 → 스킵
```

---

## 15. 보안: API 키 암복호화

네이버 광고 계정의 API 키는 **암호화**하여 DB에 저장합니다.

### 암호화 구조

```
[사용자 입력] apiKey, secretKey
    │
    ▼
[암호화] AES-256-GCM (ENCRYPTION_KEY 사용)
    │
    ▼
[DB 저장] NaverAccount.apiKeyEncrypted, secretKeyEncrypted
    │
    ▼
[사용 시] 복호화 → NaverAdsClient 생성 → API 호출 → 메모리에서 즉시 폐기
```

### 환경 변수

```env
# .env.example에 이미 존재
# 반드시 64자 HEX 문자열 (32바이트)이어야 합니다.
ENCRYPTION_KEY=your-64-char-hex-string-here
```

### AI 프롬프트 보안 원칙

| 원칙 | 설명 |
|------|------|
| **PII 제거** | AI 프롬프트에 실제 IP 주소, 광고주 실명 전송 금지 |
| **해시 처리** | IP는 `ipHash`로, 광고주는 "A 법률사무소" 등 익명화 |
| **키 미노출** | API 키, 시크릿 키를 절대 AI 프롬프트에 포함하지 않음 |
| **응답 필터링** | AI 응답에서 개인정보 패턴 감지 시 자동 마스킹 |
| **토큰 관리** | AI API 키는 서버 측(`process.env`)에서만 사용, 프론트 노출 금지 |

---

## 16. 스트리밍 응답 설계

코파일럿 채팅의 **UX 개선**을 위한 스트리밍 응답 설계입니다.

### 현재 vs 개선

| 항목 | 현재 | 개선 후 |
|------|------|--------|
| 응답 방식 | 전체 응답 완료 후 표시 | 토큰 단위로 실시간 표시 |
| 체감 응답 시간 | 3~5초 (전체 대기) | 0.3초 (첫 토큰) |
| UX | "분석 중..." 로딩 표시 | 텍스트가 타이핑되듯 표시 |

### 구현 방향

```
[프론트엔드]
  fetch('/api/copilot/chat', { method: 'POST' })
    → response.body.getReader()  (ReadableStream)
    → 청크 단위로 setMessages 업데이트

[백엔드] /api/copilot/chat
  OpenAI: stream: true → SSE (Server-Sent Events)
  Gemini: streamGenerateContent → SSE
  Mock: 폴백 시 일반 JSON 응답 (스트리밍 불가)

  return new Response(stream, {
    headers: { 'Content-Type': 'text/event-stream' }
  });
```

### 적용 범위

| 기능 | 스트리밍 | 이유 |
|------|:---:|------|
| 코파일럿 채팅 | ✅ | 사용자 대면, UX 중요 |
| 리포트 생성 | ✅ | 긴 텍스트, 진행 상황 표시 |
| 자동 입찰 | ❌ | 배치 처리, 스트리밍 불필요 |
| 부정클릭 분석 | ❌ | JSON 구조화 응답, 파싱 필요 |
| 기타 백그라운드 | ❌ | JSON 응답이므로 완료 후 처리 |

---

## 17. API 레이트 리미팅

`.env.example`에 Upstash Redis 설정이 이미 존재합니다. AI 기능에 대한 레이트 리미팅 설계:

### 레이트 리밋 계층

```
┌──────────────────────────────────────────────────┐
│              레이트 리미팅 계층                     │
│                                                  │
│  [L1] 글로벌 ───── 전체 API: 1,000 req/분          │
│  [L2] 사용자 ───── 유저당: 60 req/분               │
│  [L3] AI 엔드포인트 ─ /api/copilot/chat: 10 req/분 │
│  [L4] Cron ──────── /api/cron/*: 서버 내부 전용     │
│  [L5] 플랜별 ────── PlanType에 따른 일일 한도      │
└──────────────────────────────────────────────────┘
```

### 구현 방향

```typescript
// src/lib/rate-limit.ts (NEW)
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

const redis = Redis.fromEnv(); // UPSTASH_REDIS_REST_URL + TOKEN

export const aiChatLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(10, '1m'),  // 10회/분
  prefix: 'ai:chat',
});

export const aiBidLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.fixedWindow(200, '1h'),   // 200회/시 (배치)
  prefix: 'ai:bid',
});
```

### Redis 미설정 시

```
UPSTASH_REDIS_REST_URL 미설정 → 레이트 리미팅 비활성화 (무제한)
→ 개발 환경에서는 Redis 없이도 정상 동작
→ 프로덕션에서는 반드시 설정 권장
```

---

## 18. 테스트 전략

현재 테스트 프레임워크가 설치되어 있지 않습니다. AI 기능 개발 시 아래 테스트 전략을 적용합니다.

### 테스트 레이어

```
┌─────────────────────────────────────────────┐
│              테스트 피라미드                   │
│                                             │
│         ┌───────────┐                       │
│         │   E2E     │  Playwright / Browser │
│         │  (최소)    │  코파일럿 채팅 시나리오  │
│         └─────┬─────┘                       │
│         ┌─────┴─────┐                       │
│         │ 통합 테스트 │  API Route 전체 흐름   │
│         │  (중심)    │  AI → DB → 네이버 API  │
│         └─────┬─────┘                       │
│    ┌──────────┴──────────┐                  │
│    │      단위 테스트      │  프롬프트 빌더     │
│    │      (많이)         │  안전장치 검증      │
│    │                    │  JSON 파서         │
│    └────────────────────┘                   │
└─────────────────────────────────────────────┘
```

### 단위 테스트 대상

| 모듈 | 테스트 내용 |
|------|----------|
| `response-parser.ts` | AI JSON 응답 파싱 성공/실패, 비정형 응답 처리 |
| `model-router.ts` | 기능별 올바른 모델 선택, 폴백 동작 |
| `prompts/*.ts` | 프롬프트 빌더 출력 형식 검증 |
| 안전장치 로직 | 상한/하한/속도제한 경계값 테스트 |
| Optimistic Lock | version 충돌 시 스킵 동작 확인 |

### AI 응답 Mock 전략

```typescript
// tests/mocks/ai-responses.ts
export const mockBidResponse = {
  keyword: "형사변호사",
  currentBid: 1200,
  recommendedBid: 1350,
  reason: "목표 3위 대비 현재 5위",
  confidence: 0.85,
};

// 테스트에서 AI API를 Mock하여 비용 없이 전체 흐름 검증
// 실제 AI 호출은 staging 환경에서만 수행
```

### 설치 및 설정

```bash
# vitest 추천 (Next.js와 호환성 우수)
npm install -D vitest @vitejs/plugin-react jsdom
```

---

## 19. 점진적 롤아웃 (Feature Flag)

Mock → 실제 AI 전환을 **안전하게** 수행하기 위한 점진적 롤아웃 전략입니다.

### Feature Flag 구조

```env
# .env — 기능별 ON/OFF
AI_FEATURE_COPILOT=true          # 코파일럿 채팅 AI
AI_FEATURE_AUTO_BID=false        # 자동 입찰 (개발 중 OFF)
AI_FEATURE_CLICK_FRAUD=false     # 부정클릭 AI
AI_FEATURE_COMPETITIVE=false     # 경쟁사 AI
AI_FEATURE_KEYWORD_RECOMMEND=false
AI_FEATURE_AD_CREATIVE=false
AI_FEATURE_REPORT=false
AI_FEATURE_INSIGHT=false
```

### 동작 원리

```
[API 호출]
    │
    ▼
[Feature Flag 확인]
    ├── AI_FEATURE_XXX = true  → 실제 AI 호출
    └── AI_FEATURE_XXX = false → Mock 폴백 (기존 동작)
```

### 롤아웃 단계

```
Stage 1: 개발자만 (내부 테스트)
    └── 특정 organizationId만 AI 활성화

Stage 2: 얼리 어답터 (canary)
    └── growth 이상 플랜의 10% 조직

Stage 3: 확대 (50%)
    └── growth 이상 플랜 전체

Stage 4: 전체 오픈 (100%)
    └── 모든 플랜 (플랜별 한도 적용)
```

### 롤백 프로토콜

| 상황 | 조치 | 소요 시간 |
|------|------|:---------:|
| AI 응답 품질 저하 | Feature Flag OFF → Mock 폴백 | 즉시 (환경변수 변경) |
| AI API 장애 | 자동 폴백 (코드 레벨) | 자동 |
| 자동입찰 사고 | `AUTO_BID_ENABLED=false` + 일괄 롤백 스크립트 | 5분 |
| 비용 폭증 | `AI_DAILY_CALL_LIMIT` 하향 | 즉시 |
