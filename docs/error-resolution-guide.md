# Agency OS 에러 해결 가이드

> 2026-03-17 발생한 주요 에러들과 해결 과정을 기록합니다.

---

## 1. Vercel 배포 실패 (Cron Jobs 제한)

### 증상
- `git push` 후 Vercel에 새 배포가 나타나지 않음
- GitHub 커밋에 빨간 X (deployment failed) 표시
- 프로덕션 사이트가 이전 버전에 머물러 있음

### 원인
`vercel.json`에 추가된 cron jobs 스케줄이 **Vercel Hobby 플랜 제한을 초과**했습니다.

```json
// ❌ 문제의 설정 (Hobby 플랜은 1일 1회만 허용)
"crons": [
  { "path": "/api/cron/auto-bid", "schedule": "0 */6 * * *" },        // 6시간마다
  { "path": "/api/click-fraud/analyze", "schedule": "*/30 * * * *" }   // 30분마다
]
```

Vercel Hobby 플랜은 cron jobs를 **하루 최대 1회** (`0 0 * * *` 형태)만 허용합니다. 이보다 빈번한 스케줄을 설정하면 **배포 자체가 자동으로 거부**됩니다.

### 해결
`vercel.json`에서 crons 섹션을 제거합니다:

```json
{
  "buildCommand": "npx prisma generate && next build",
  "installCommand": "npm install",
  "framework": "nextjs",
  "regions": ["icn1"]
}
```

### 참고: Hobby 플랜에서 cron 사용 시
```json
// ✅ Hobby 플랜 허용 스케줄 (1일 1회)
"crons": [
  { "path": "/api/cron/daily-task", "schedule": "0 0 * * *" }
]
```

### 확인 방법
1. GitHub 커밋 옆 상태 체크 확인 (✅ vs ❌)
2. Vercel 대시보드 → Deployments 목록에서 새 빌드 확인
3. 배포 실패 시 Details 클릭 → Vercel 에러 페이지로 리다이렉트되면 cron 문제

---

## 2. 로그인 비밀번호 불일치

### 증상
- `admin@agency.com` / `password123`으로 로그인 실패
- 에러 메시지 없이 로그인 페이지에 머무름

### 원인
DB의 실제 비밀번호 해시가 `password`와 매칭되는데, 로그인 페이지 데모 안내가 `password123`으로 표시되어 있었음.

### 해결
1. DB에서 실제 비밀번호 확인:
```javascript
// tmp 스크립트로 확인
const bcrypt = require('bcryptjs');
const result = await pool.query('SELECT email, password FROM "User"');
for (const user of result.rows) {
  console.log(user.email, await bcrypt.compare('password', user.password));
}
```

2. 로그인 페이지의 데모 안내 수정:
```tsx
// src/app/(auth)/login/page.tsx
💡 <strong>데모 계정:</strong> admin@agency.com / password
```

### 예방법
- seed 스크립트와 로그인 페이지의 비밀번호를 항상 동기화
- DB 비밀번호 변경 시 관련 UI도 함께 수정

---

## 3. 신규 계정에 샘플 데이터 노출

### 증상
- `neolawyer@agency.com` 같은 신규 계정으로 로그인 시
- KPI에 ₩45,230,000, ROAS 320% 등 샘플 데이터 표시
- "A 법률사무소", "B 성형외과" 등 가짜 업체명 노출

### 원인
`src/app/dashboard/page.tsx`에 하드코딩된 fallback 데이터가 API 응답이 없을 때 자동으로 표시되도록 되어 있었음.

### 해결
모든 fallback 배열을 빈 배열(`[]`)로 교체하고, 데이터 없는 경우 빈 상태 UI를 구현:

```tsx
// 변경 전
const fallbackKpi = { totalSpend: 45230000, avgRoas: 320, ... };
const fallbackAccounts = [{ name: 'A 법률사무소', ... }];

// 변경 후
const kpi = dashboardData?.kpi || { totalSpend: 0, avgRoas: 0, ... };
const accounts = accountsData?.length > 0 ? accountsData : [];

// 빈 상태 UI
{accounts.length === 0 && (
  <div className="empty-state">
    <p>연동된 광고 계정이 없습니다</p>
    <a href="/dashboard/accounts">계정 연동하기</a>
  </div>
)}
```

### 원칙
- **절대로 하드코딩된 샘플 데이터를 fallback으로 사용하지 않을 것**
- 데이터 없는 경우 빈 상태 UI + CTA 버튼 제공
- API 에러와 "데이터 없음"을 구분하여 처리

---

## 4. Vercel 프로덕션 브랜치 설정

### 증상
- `master` 브랜치에 push하면 Preview로만 배포됨
- `main` 브랜치에 push해도 프로덕션에 반영 안 됨

### 원인
Vercel 프로젝트의 Production Branch 설정이 실제 사용 브랜치와 불일치.

### 확인 방법
Vercel → Project Settings → Environments → Production → Branch Tracking

### 해결
Branch Tracking을 실제 사용하는 브랜치로 설정:
- **현재 설정**: `master` (프로덕션)
- 변경 시: Settings → Environments → Production → Branch Tracking 수정 → Save

### 현재 브랜치 전략
| 브랜치 | 용도 | Vercel 환경 |
|--------|------|-------------|
| `master` | 기본 개발/프로덕션 | Production |
| `main` | 동기화용 | - |

---

## 빠른 진단 체크리스트

배포/로그인 문제 발생 시 순서대로 확인:

- [ ] GitHub 커밋 상태 체크 (✅/❌) 확인
- [ ] Vercel Deployments 목록에 새 빌드 존재 여부
- [ ] `vercel.json` cron 설정이 플랜 제한 내인지
- [ ] Production Branch 설정이 push 대상과 일치하는지
- [ ] DB 비밀번호 해시가 로그인 시 사용하는 비밀번호와 매칭되는지
- [ ] 대시보드 fallback 데이터가 빈 배열인지 확인
