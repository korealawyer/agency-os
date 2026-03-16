import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';

// ──── 인증 예외 경로 ────
const PUBLIC_PATHS = [
  '/api/auth',     // NextAuth 내부 라우트
  '/api/health',   // 로드밸런서 헬스체크
  '/api/cron',     // Cron 작업 (자체 CRON_SECRET 검증)
  '/login',
  '/landing',
  '/pricing',
  '/demo',
  '/roi-calculator',
  '/_next',
  '/favicon.ico',
];

// ──── 보안 헤더 ────
const securityHeaders: Record<string, string> = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
};

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // 공개 경로 → 보안 헤더만 적용하고 통과
  if (PUBLIC_PATHS.some(p => pathname.startsWith(p)) || pathname === '/') {
    const response = NextResponse.next();
    Object.entries(securityHeaders).forEach(([key, value]) => {
      response.headers.set(key, value);
    });
    return response;
  }

  // API 라우트 인증 체크
  if (pathname.startsWith('/api/')) {
    const token = await getToken({ 
      req, 
      secret: process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET,
      salt: 'authjs.session-token',
    });
    if (!token) {
      return NextResponse.json(
        { error: { message: '인증이 필요합니다.' } },
        { status: 401 }
      );
    }
  }

  // 대시보드 경로 인증 체크
  if (pathname.startsWith('/dashboard')) {
    const token = await getToken({ 
      req, 
      secret: process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET,
      salt: 'authjs.session-token',
    });
    if (!token) {
      const loginUrl = new URL('/login', req.url);
      loginUrl.searchParams.set('callbackUrl', req.url);
      return NextResponse.redirect(loginUrl);
    }
  }

  // 보안 헤더 적용
  const response = NextResponse.next();
  Object.entries(securityHeaders).forEach(([key, value]) => {
    response.headers.set(key, value);
  });
  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|public).*)',
  ],
};
