import { NextRequest, NextResponse } from 'next/server';
import { internalPrisma } from '@/lib/db';

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  const now = new Date();
  let totalDeletedAudit = 0;
  let totalDeletedNotif = 0;
  const BATCH_SIZE = 5000;

  // 1. 만료된 감사 로그 배치 삭제
  while (true) {
    const batch: number = await internalPrisma.$executeRaw`
      DELETE FROM audit_logs WHERE id IN (
        SELECT id FROM audit_logs WHERE expires_at < ${now} LIMIT ${BATCH_SIZE}
      )
    `;
    totalDeletedAudit += batch;
    if (batch < BATCH_SIZE) break;
    await new Promise(r => setTimeout(r, 100));
  }

  // 2. 30일 이상 읽은 알림 배치 삭제
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  while (true) {
    const batch: number = await internalPrisma.$executeRaw`
      DELETE FROM notifications WHERE id IN (
        SELECT id FROM notifications WHERE is_read = true AND read_at < ${thirtyDaysAgo} LIMIT ${BATCH_SIZE}
      )
    `;
    totalDeletedNotif += batch;
    if (batch < BATCH_SIZE) break;
    await new Promise(r => setTimeout(r, 100));
  }

  return NextResponse.json({
    deletedAuditLogs: totalDeletedAudit,
    deletedNotifications: totalDeletedNotif,
    executedAt: now.toISOString(),
  });
}
