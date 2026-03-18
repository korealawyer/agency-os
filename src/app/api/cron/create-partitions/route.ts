import { NextRequest, NextResponse } from 'next/server';
import { internalPrisma } from '@/lib/db';

export async function GET(req: NextRequest) {
  // ──── Cron 인증 (Fail-Close) ────
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return new NextResponse('CRON_SECRET not configured', { status: 500 });
  }
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${cronSecret}`) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  const nextMonth = new Date();
  nextMonth.setMonth(nextMonth.getMonth() + 1);
  const year = nextMonth.getFullYear();
  const month = String(nextMonth.getMonth() + 1).padStart(2, '0');

  const afterMonth = new Date(nextMonth);
  afterMonth.setMonth(afterMonth.getMonth() + 1);
  const afterYear = afterMonth.getFullYear();
  const afterMonthStr = String(afterMonth.getMonth() + 1).padStart(2, '0');

  const ALLOWED_TABLES = new Set(['audit_logs', 'bid_history', 'rank_snapshots', 'click_fraud_events']);
  const tables = Array.from(ALLOWED_TABLES);

  for (const table of tables) {
    if (!ALLOWED_TABLES.has(table)) {
      return NextResponse.json({ error: `Invalid table: ${table}` }, { status: 400 });
    }
    const partitionName = `${table}_${year}_${month}`;
    await internalPrisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS ${partitionName} PARTITION OF ${table}
      FOR VALUES FROM ('${year}-${month}-01') TO ('${afterYear}-${afterMonthStr}-01')
    `);
  }

  return NextResponse.json({ created: `${year}-${month} partitions`, tables });
}
