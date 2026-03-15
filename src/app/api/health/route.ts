import { NextResponse } from 'next/server';
import prisma from '@/lib/db';

export async function GET() {
  const start = Date.now();
  let dbHealthy = false;

  try {
    await prisma.$queryRaw`SELECT 1`;
    dbHealthy = true;
  } catch {
    dbHealthy = false;
  }

  const latency = Date.now() - start;

  return NextResponse.json({
    status: dbHealthy ? 'healthy' : 'degraded',
    timestamp: new Date().toISOString(),
    latency: `${latency}ms`,
    checks: {
      database: dbHealthy ? 'ok' : 'error',
    },
  }, {
    status: dbHealthy ? 200 : 503,
  });
}
