import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

// ──── Prisma Client 싱글톤 ────
// Next.js HMR에서 PrismaClient 인스턴스 중복 생성 방지

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

function createPrismaClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;

  // [수정] Fail-fast: 환경변수 미설정 시 명확한 에러
  if (!connectionString) {
    throw new Error('[FATAL] DATABASE_URL 환경변수가 설정되지 않았습니다.');
  }

  const pool = new Pool({
    connectionString,
    // [수정] SSL: Production에서 rejectUnauthorized: true (MITM 방어)
    // Supabase Pooler는 자체 CA를 사용하므로 true가 안전
    ssl: process.env.NODE_ENV === 'production'
      ? { rejectUnauthorized: true }
      : { rejectUnauthorized: false },
    // [수정] 서버리스 최적화: DATABASE_URL에 ?pgbouncer=true&connection_limit=1 사용 시
    // PgBouncer Transaction Mode가 실제 연결 풀을 관리 → max=1이 적합
    // 단일 함수 인스턴스 내 Promise.all 병렬 쿼리를 위해 2로 설정
    max: parseInt(process.env.DB_POOL_SIZE ?? '2', 10),
    idleTimeoutMillis: 10000,
    connectionTimeoutMillis: 5000,
  });

  const adapter = new PrismaPg(pool);
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });
}

const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

// ──── 멀티테넌트 격리 ────
// Prisma v7에서 $use 미들웨어 제거됨 →
//   멀티테넌트 격리는 API 계층의 requireAuth + where 조건으로 적용합니다.

export default prisma;

// ──── 내부 전용 PrismaClient ────
// Cron 작업, 마이그레이션, 시드 등 조직 횡단 작업에만 사용
// ⚠️ API Route에서 사용 금지
const globalForInternalPrisma = globalThis as unknown as { internalPrisma: PrismaClient };
export const internalPrisma = globalForInternalPrisma.internalPrisma ?? createPrismaClient();
if (process.env.NODE_ENV !== 'production') globalForInternalPrisma.internalPrisma = internalPrisma;
