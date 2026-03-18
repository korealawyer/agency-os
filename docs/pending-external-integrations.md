# 미해결 외부 서비스 연동 항목

> **작성일**: 2026-03-18  
> **근거**: TF Audit Report #10, #11, #12

---

## 1. 비밀번호 재설정 (Password Reset)

**현재 상태**: Mock UI만 존재 — 폼 전환만 되고 실제 이메일 발송/비밀번호 변경 없음

**필요 작업**:
1. 이메일 발송 서비스 연동 (SendGrid / AWS SES / Resend 등)
2. `/api/auth/reset-password` API 구현
   - `POST /request` — 이메일로 6자리 인증코드 또는 토큰 링크 발송
   - `POST /verify` — 코드 검증 후 비밀번호 변경
3. 토큰 저장소 — Redis(Upstash) 또는 DB에 만료시간 포함 저장
4. `login/page.tsx`의 `resetStep` 로직을 실제 API 호출로 교체

**관련 파일**:
- `src/app/(auth)/login/page.tsx` — 비밀번호 재설정 UI (line 333~)
- `src/app/api/auth/` — API 엔드포인트 신규 생성 필요

**환경변수 (예시)**:
```env
SENDGRID_API_KEY=SG.xxxxx
EMAIL_FROM=noreply@agency-os.com
```

---

## 2. Google 소셜 로그인 (Google OAuth)

**현재 상태**: 로그인 버튼이 `disabled` + "준비 중" 텍스트로 비활성 처리됨

**필요 작업**:
1. [Google Cloud Console](https://console.cloud.google.com/apis/credentials)에서 OAuth 2.0 클라이언트 생성
   - 승인된 리다이렉트 URI: `https://your-domain.com/api/auth/callback/google`
2. NextAuth에 Google Provider 등록 (`src/lib/auth.ts`)
   ```typescript
   import GoogleProvider from 'next-auth/providers/google';
   
   providers: [
     GoogleProvider({
       clientId: process.env.GOOGLE_CLIENT_ID!,
       clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
     }),
     // ...기존 CredentialsProvider
   ]
   ```
3. `login/page.tsx`의 Google 버튼에 `onClick={() => signIn('google')}` 연결 + `disabled` 제거
4. 콜백에서 기존 유저 매칭 또는 신규 Organization 자동 생성 로직 추가

**환경변수**:
```env
GOOGLE_CLIENT_ID=xxxxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxxxx
```

---

## 3. 이메일 인증 (Email Verification)

**현재 상태**: 회원가입 후 "인증 완료" 버튼 클릭만으로 온보딩 진행 — 실제 이메일 미발송

**필요 작업**:
1. 이메일 발송 서비스 연동 (비밀번호 재설정과 동일 서비스 사용)
2. `/api/auth/verify-email` API 구현
   - 회원가입 성공 시 6자리 인증코드 이메일 발송
   - 코드 입력 후 `User.emailVerified` 필드 업데이트
3. `login/page.tsx`의 `view === "verify"` 섹션을 실제 코드 입력 + 검증 로직으로 교체
4. (선택) 미인증 사용자 대시보드 접근 제한 미들웨어

**관련 파일**:
- `src/app/(auth)/login/page.tsx` — 이메일 인증 UI (line 230~)
- `src/app/api/auth/` — API 엔드포인트 신규 생성 필요

---

## 우선순위 권장

| 순위 | 항목 | 이유 |
|------|------|------|
| 1 | 이메일 인증 | 가짜 이메일 가입 방지, 보안 기본 |
| 2 | 비밀번호 재설정 | 사용자 셀프서비스 필수 기능 |
| 3 | Google 로그인 | 편의 기능, 없어도 서비스 사용 가능 |

> **공통 전제**: 이메일 발송 서비스(SendGrid, Resend 등) 1개만 연동하면 #1, #2 동시 해결 가능
