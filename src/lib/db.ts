import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

// ──── Prisma Client 싱글톤 ────
// Next.js HMR에서 PrismaClient 인스턴스 중복 생성 방지

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

function createPrismaClient(): PrismaClient {
  // Prisma v7: 항상 드라이버 어댑터 필요
  const connectionString = process.env.DATABASE_URL || 'postgresql://localhost:5432/agency_os';
  const pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false }, // Supabase SSL
    max: 1, // Vercel 서버리스: 연결 최소화
    connectionTimeoutMillis: 10000,
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
