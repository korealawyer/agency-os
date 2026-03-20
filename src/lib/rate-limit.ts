import { Ratelimit } from '@upstash/ratelimit';
import redis from '@/lib/cache';

// [수정] Redis null 안전 처리 — Upstash 미설정 시 Rate Limiting 비활성화

// ──── 인증 관련 Rate Limiter (로그인/회원가입) ────
// 60초에 5회 허용 (Sliding Window)
export const authRateLimit = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(5, '60 s'),
      prefix: 'rl:auth',
    })
  : null;

// ──── 일반 API Rate Limiter ────
// 60초에 60회 허용
export const apiRateLimit = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(60, '60 s'),
      prefix: 'rl:api',
    })
  : null;

// ──── Copilot Chat Rate Limiter ────
// 60초에 10회 허용 (AI API 비용 보호)
export const copilotRateLimit = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(10, '60 s'),
      prefix: 'rl:copilot',
    })
  : null;

// ──── Rate Limit 체크 유틸 (null 안전) ────
export async function checkRateLimit(
  limiter: Ratelimit | null,
  identifier: string,
): Promise<{ success: boolean; limit: number; remaining: number; reset: number }> {
  if (!limiter) {
    // Redis 미설정 시 Rate Limiting 통과 (비활성화 상태)
    return { success: true, limit: 0, remaining: 0, reset: 0 };
  }
  return limiter.limit(identifier);
}

// ──── IP 추출 유틸리티 ────
export function getClientIp(headers: Headers): string {
  return headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || headers.get('x-real-ip')
    || 'unknown';
}
