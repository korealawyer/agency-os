import { Redis } from '@upstash/redis';

// ──── Redis 클라이언트 (Upstash Serverless) ────

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

export default redis;

// ──── 캐시 키 빌더 ────

export function cacheKey(organizationId: string, ...parts: string[]) {
  return `org:${organizationId}:${parts.join(':')}`;
}

// ──── cachedQuery: 캐시 + DB 폴백 + Mutex Lock (Stampede 방지) ────

export async function cachedQuery<T>(
  key: string,
  ttlSeconds: number,
  queryFn: () => Promise<T>,
  tags?: string[],
): Promise<T> {
  // 1. 캐시에서 읽기
  try {
    const cached = await redis.get<T>(key);
    if (cached !== null && cached !== undefined) return cached;
  } catch (e) {
    console.warn('Redis cache read failed, falling back to DB:', e);
  }

  // 2. Mutex Lock — Cache Stampede (Thundering Herd) 방지
  const lockKey = `lock:${key}`;
  let acquired = false;
  try {
    acquired = !!(await redis.set(lockKey, '1', { ex: 10, nx: true }));
  } catch (e) {
    console.warn('Redis lock failed, falling back to direct query:', e);
  }

  if (!acquired) {
    // Lock 미획득 → 짧은 대기 후 캐시 재확인 (Spin Wait, 최대 3회)
    for (let retry = 0; retry < 3; retry++) {
      await new Promise(r => setTimeout(r, 200));
      try {
        const cached = await redis.get<T>(key);
        if (cached !== null && cached !== undefined) return cached;
      } catch { /* 폴백 */ }
    }
  }

  // 3. DB 쿼리 실행
  const result = await queryFn();

  // 4. 캐시에 쓰기 + 태그 등록
  try {
    await redis.set(key, result, { ex: ttlSeconds });
    if (tags?.length) {
      const pipeline = redis.pipeline();
      for (const tag of tags) {
        pipeline.sadd(`tag:${tag}`, key);
        pipeline.expire(`tag:${tag}`, ttlSeconds * 2);
      }
      await pipeline.exec();
    }
  } catch (e) {
    console.warn('Redis cache write failed:', e);
  } finally {
    if (acquired) {
      try { await redis.del(lockKey); } catch { /* 무시 */ }
    }
  }

  return result;
}

// ──── 태그 기반 캐시 무효화 ────

export async function invalidateCache(tag: string) {
  try {
    const keys = await redis.smembers(`tag:${tag}`);
    if (keys.length > 0) {
      const pipeline = redis.pipeline();
      for (const key of keys) {
        pipeline.del(key);
      }
      pipeline.del(`tag:${tag}`);
      await pipeline.exec();
    }
  } catch (e) {
    console.warn('Cache invalidation failed:', e);
  }
}

// ──── 단일 키 캐시 삭제 ────

export async function deleteCache(key: string) {
  try {
    await redis.del(key);
  } catch (e) {
    console.warn('Cache delete failed:', e);
  }
}
