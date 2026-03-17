const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const bcrypt = require('bcryptjs');

async function run() {
  try {
    const client = await pool.connect();
    
    console.log('🔍 전체 사용자 목록 조회 중...');
    const allUsers = await client.query(`SELECT email, role, name FROM "users" ORDER BY created_at DESC`);
    console.log('현재 등록된 사용자들:');
    allUsers.rows.forEach(u => console.log(`- ${u.email} (role: ${u.role}, name: ${u.name})`));
    
    // neolawyer가 포함된 이메일 찾기
    const target = allUsers.rows.find(u => u.email.includes('neolawyer'));
    
    if (target) {
      console.log(`\n✅ 대상 사용자 발견: ${target.email}`);
      console.log('-> 조직 분리 작업 시작...');
      
      const orgRes = await client.query(`
        INSERT INTO "organizations" ("id", "name", "plan_type", "total_ad_spend", "max_accounts", "is_active", "created_at", "updated_at")
        VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, NOW(), NOW())
        RETURNING id
      `, ['NeoLawyer Workspace', 'starter', 0, 5, true]);
      
      const newOrgId = orgRes.rows[0].id;
      
      await client.query(`
        UPDATE "users" 
        SET "organization_id" = $1, "role" = 'editor'
        WHERE email = $2
      `, [newOrgId, target.email]);
      
      console.log(`🎉 [${target.email}] 계정이 새 조직으로 이동 및 일반 권한(editor)으로 변경되었습니다.`);
    } else {
      console.log('\n❌ neolawyer 관련 계정이 여전히 없습니다. DB에 직접 생성합니다.');
      
      const orgRes = await client.query(`
        INSERT INTO "organizations" ("id", "name", "plan_type", "total_ad_spend", "max_accounts", "is_active", "created_at", "updated_at")
        VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, NOW(), NOW())
        RETURNING id
      `, ['NeoLawyer Workspace', 'starter', 0, 5, true]);
      
      const newOrgId = orgRes.rows[0].id;
      const hashedPassword = await bcrypt.hash('meat0101#', 10);
      
      await client.query(`
        INSERT INTO "users" ("id", "email", "password_hash", "name", "role", "organization_id", "is_active", "created_at", "updated_at")
        VALUES (gen_random_uuid()::text, $1, $2, $3, 'editor', $4, true, NOW(), NOW())
      `, ['neolawyer@agency.com', hashedPassword, 'Neo Lawyer', newOrgId]);
      
      console.log(`🎉 [neolawyer@agency.com] 계정을 격리된 조직과 일반 권한(editor)으로 새로 생성했습니다!`);
    }

    client.release();
  } catch (e) {
    console.error('❌ SQL 실행 에러:', e.message);
  } finally {
    pool.end();
  }
}

run();
