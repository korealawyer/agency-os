import { Ratelimit } from '@upstash/ratelimit';
import redis from '@/lib/cache';

// ──── 인증 관련 Rate Limiter (로그인/회원가입) ────
// 60초에 5회 허용 (Sliding Window)
export const authRateLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(5, '60 s'),
  prefix: 'rl:auth',
});

// ──── 일반 API Rate Limiter ────
// 60초에 60회 허용
export const apiRateLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(60, '60 s'),
  prefix: 'rl:api',
});

// ──── Copilot Chat Rate Limiter ────
// 60초에 10회 허용 (AI API 비용 보호)
export const copilotRateLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(10, '60 s'),
  prefix: 'rl:copilot',
});

// ──── IP 추출 유틸리티 ────
export function getClientIp(headers: Headers): string {
  return headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || headers.get('x-real-ip')
    || 'unknown';
}
