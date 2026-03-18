const { Pool } = require('pg');
const p = new Pool({
  connectionString: 'postgresql://postgres.jnczxpqnutkmczpozgex:agency-os-db-2024!@aws-1-ap-northeast-2.pooler.supabase.com:6543/postgres',
  ssl: { rejectUnauthorized: false }
});

(async () => {
  // 계정 ID 확인
  const acc = await p.query("SELECT id, customer_id, connection_status, last_sync_at FROM naver_accounts WHERE deleted_at IS NULL");
  console.log('=== 계정 ===');
  for (const a of acc.rows) console.log(`  id: ${a.id}, customerId: ${a.customer_id}, status: ${a.connection_status}, lastSync: ${a.last_sync_at}`);

  // 해당 계정의 캠페인
  if (acc.rows.length > 0) {
    const accountId = acc.rows[0].id;
    const camps = await p.query("SELECT COUNT(*) as cnt FROM campaigns WHERE naver_account_id = $1 AND deleted_at IS NULL", [accountId]);
    console.log(`\n계정 ${accountId}의 캠페인 수: ${camps.rows[0].cnt}`);
    
    const allCamps = await p.query("SELECT COUNT(*) as cnt FROM campaigns WHERE naver_account_id = $1", [accountId]);
    console.log(`계정 ${accountId}의 캠페인 수 (deleted 포함): ${allCamps.rows[0].cnt}`);
    
    const nullAccCamps = await p.query("SELECT COUNT(*) as cnt FROM campaigns WHERE naver_account_id IS NULL");
    console.log(`naver_account_id가 NULL인 캠페인: ${nullAccCamps.rows[0].cnt}`);
    
    const totalCamps = await p.query("SELECT COUNT(*) as cnt FROM campaigns");
    console.log(`전체 캠페인: ${totalCamps.rows[0].cnt}`);
  }

  p.end();
})();
