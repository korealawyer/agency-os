import NextAuth from 'next-auth';
import { authConfig } from '@/lib/auth.config';

// NextAuth를 미들웨어로 직접 export — authConfig.callbacks.authorized가 정상 동작
// ⚠️ 커스텀 콜백에서 NextResponse.next()를 반환하면 authorized 결과를 오버라이드하므로 주의
export default NextAuth(authConfig).auth;

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|public).*)',
  ],
};
