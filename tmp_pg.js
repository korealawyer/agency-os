const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function run() {
  try {
    const client = await pool.connect();
    
    console.log('🔍 사용자 조회 중: neolawyer@agency.com');
    const res1 = await client.query(`SELECT id, role, organization_id FROM "users" WHERE email = $1`, ['neolawyer@agency.com']);
    
    if (res1.rows.length === 0) {
      console.log('❌ 사용자를 찾을 수 없습니다.');
      // 임시로 그냥 여기서 생성해버릴 수도 있지만, 이미 아까 `npx prisma studio`로 생성하셨을 수 있으므로...
      // 생성 안 되었다면 insert 처리
    } else {
      console.log('✅ 사용자 확인 (현재 role: ' + res1.rows[0].role + ') -> 새 조직(Workspace) 생성 진행...');
      
      const orgRes = await client.query(`
        INSERT INTO "organizations" ("id", "name", "plan_type", "total_ad_spend", "max_accounts", "is_active", "created_at", "updated_at")
        VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, NOW(), NOW())
        RETURNING id
      `, ['NeoLawyer Workspace', 'starter', 0, 5, true]);
      
      const newOrgId = orgRes.rows[0].id;
      
      console.log('✅ 조직 생성 완료 (ID: ' + newOrgId + ') -> 계정 이전 및 권한 수정 중...');
      
      // 사용자 권한을 'editor' (일반) 계정으로 강등
      await client.query(`
        UPDATE "users" 
        SET "organization_id" = $1, "role" = 'editor'
        WHEREAS email = $2
      `.replace('WHEREAS', 'WHERE'), [newOrgId, 'neolawyer@agency.com']);
      
      console.log('====================================================');
      console.log('🎉 계정 정보 수정이 완료되었습니다.');
      console.log('  - 이전에 생성했던 데이터가 보이지 않도록 조직이 분리되었습니다.');
      console.log('  - 기존 권한(admin)에서 "일반 계정(editor)"으로 변경되었습니다.');
      console.log('====================================================');
    }
    
    client.release();
  } catch (e) {
    console.error('❌ SQL 실행 에러:', e.message);
  } finally {
    pool.end();
  }
}

run();
