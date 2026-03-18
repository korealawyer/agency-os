# 네이버 광고 API 연동 가이드

> 최종 업데이트: 2026-03-18

## 개요

네이버 광고 API 정보(Customer ID, API Key, Secret Key) 3가지만 등록하면, 해당 계정의 **모든 광고 데이터를 자동으로 가져와 DB에 동기화**합니다.

---

## 📥 동기화되는 데이터

| 단계 | 데이터 | DB 테이블 | 주요 필드 |
|------|--------|-----------|-----------|
| 1️⃣ | **캠페인** | `Campaign` | 캠페인명, 상태(active/paused/ended), 일예산 |
| 2️⃣ | **광고그룹** | `AdGroup` | 광고그룹명, 활성 상태 |
| 3️⃣ | **키워드** | `Keyword` | 키워드 텍스트, 입찰가 |
| 4️⃣ | **통계 데이터** | `Keyword` | 클릭수, 노출수, CTR, 전환수, 비용, 전환금액, ROAS |
| 5️⃣ | **이상 탐지 알림** | `Notification` | CTR 50%↑ 급락 시 자동 알림 |

---

## 🔄 동기화 방식

### 수동 동기화
- **계정별**: `POST /api/accounts/{id}/sync` — 대시보드에서 "동기화" 버튼 클릭
- **함수**: `syncAccount(accountId, organizationId)`

### 자동 동기화 (Cron Job)
- **엔드포인트**: `GET /api/cron/sync-naver`
- **인증**: `Authorization: Bearer {CRON_SECRET}` (환경변수)
- **함수**: `syncAllAccounts(organizationId)` — 조직 내 전체 활성 계정 병렬 처리

### 동기화 흐름

```
NaverAccount 조회 + API 키 복호화
  └─ getCampaigns() → Campaign upsert
       └─ getAdGroups(campaignId) → AdGroup upsert
            └─ getKeywords(adGroupId) → Keyword upsert
                 └─ getKeywordStats(ids, start, end) → 통계 반영
                      └─ CTR 급락 감지 → Notification 생성
```

---

## ✍️ 제어(쓰기) 기능

데이터를 가져올 뿐 아니라, API를 통해 **네이버 광고를 직접 제어**할 수 있습니다.

| 기능 | API 메서드 | 설명 |
|------|-----------|------|
| 입찰가 변경 | `updateBid(keywordId, bidAmt)` | 키워드별 입찰가 수정 |
| 키워드 ON/OFF | `setKeywordStatus(keywordId, userLock)` | 키워드 활성/비활성 전환 |
| 예산 변경 | `updateCampaignBudget(campaignId, dailyBudget)` | 캠페인 일예산 변경 |

---

## 🛡️ 안정성 기능

### Exponential Backoff 재시도
- 429 (Rate Limit), 500, 502, 503, 504 에러 시 최대 3회 재시도
- 대기 시간: 1초 → 2초 → 4초 (지수 백오프)

### HMAC-SHA256 서명 인증
- 매 요청마다 `{timestamp}.{method}.{path}` 문자열을 SecretKey로 HMAC 서명
- 헤더: `X-API-KEY`, `X-Customer`, `X-Timestamp`, `X-Signature`

### API 키 암호화
- `apiKeyEncrypted`, `secretKeyEncrypted` — DB에 암호화 저장
- 동기화 시 `decrypt()` 함수로 복호화 후 사용

---

## 📁 관련 파일

| 파일 | 역할 |
|------|------|
| `src/lib/naver-ads-api.ts` | 네이버 검색광고 REST API 클라이언트 (HMAC 인증, 재시도 포함) |
| `src/lib/naver-sync.ts` | 계정 → DB 동기화 서비스 (캠페인/광고그룹/키워드/통계) |
| `src/lib/encryption.ts` | API 키 암호화/복호화 유틸리티 |
| `src/app/api/accounts/route.ts` | 계정 등록/목록 조회 API |
| `src/app/api/accounts/[id]/sync/route.ts` | 단일 계정 수동 동기화 API |
| `src/app/api/cron/sync-naver/route.ts` | 전체 조직 자동 동기화 Cron 엔드포인트 |
| `src/app/api/accounts/test-connection/route.ts` | API 연결 테스트 |

---

## ⚙️ 필수 환경변수

```env
# 암호화 키 (API Key 암복호화에 사용)
ENCRYPTION_KEY=your-32-byte-encryption-key

# Cron Job 인증 토큰
CRON_SECRET=your-cron-secret-token
```

> **참고**: 네이버 광고 API 키는 계정별로 대시보드에서 등록하며, 환경변수가 아닌 DB에 암호화 저장됩니다.

---

## 🔗 참고 링크

- [네이버 검색광고 API 문서](https://searchad.naver.com/guide/api-doc)
- [네이버 광고 센터](https://searchad.naver.com)
