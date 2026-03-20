import type { NextAuthConfig } from 'next-auth';

// Edge Runtime에서도 실행 가능한 auth config (Prisma 없음)
export const authConfig: NextAuthConfig = {
  // [수정] NextAuth v5 표준: AUTH_SECRET만 사용 (NEXTAUTH_SECRET 혼용 제거)
  secret: process.env.AUTH_SECRET,
  trustHost: true,
  session: {
    strategy: 'jwt',
    maxAge: 8 * 60 * 60, // 8시간
    updateAge: 60 * 60,   // 1시간마다 갱신
  },

  pages: {
    signIn: '/login',
  },

  providers: [], // Edge 미들웨어에서는 provider 불필요

  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const pathname = nextUrl.pathname;

      // 공개 경로
      const PUBLIC_PATHS = [
        '/api/auth',
        '/api/health',
        '/api/cron',
        '/login',
        '/landing',
        '/pricing',
        '/demo',
        '/roi-calculator',
      ];

      if (PUBLIC_PATHS.some(p => pathname.startsWith(p)) || pathname === '/') {
        return true;
      }

      // API 경로 인증 체크
      if (pathname.startsWith('/api/') && !isLoggedIn) {
        return Response.json(
          { error: { message: '인증이 필요합니다.' } },
          { status: 401 }
        );
      }

      // 대시보드 경로 인증 체크
      if (pathname.startsWith('/dashboard') && !isLoggedIn) {
        return false; // NextAuth가 자동으로 signIn 페이지로 리다이렉트
      }

      // 관리자 경로 인증 체크
      if (pathname.startsWith('/admin') && !isLoggedIn) {
        return false;
      }

      return true;
    },
  },
};
