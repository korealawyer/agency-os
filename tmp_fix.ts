import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config();

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL is missing in .env');
}

const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false },
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function run() {
  try {
    const user = await prisma.user.findUnique({ where: { email: 'neolawyer@agency.com' } });
    if (!user) {
      console.log('❗️ 사용자를 찾을 수 없습니다: neolawyer@agency.com');
      return;
    }

    console.log('진행: NeoLawyer 전용 신규 조직(Organization) 생성 중...');
    const newOrg = await prisma.organization.create({
      data: { name: 'NeoLawyer Workspace' }
    });

    console.log('진행: 사용자 데이터를 새 조직으로 이동 & 권한(editor) 강등 중...');
    // 사용자가 질문한 "일반 계정" 권한에 맞추기 위해 editor 수준으로 변경합니다.
    await prisma.user.update({
      where: { email: 'neolawyer@agency.com' },
      data: { 
        organizationId: newOrg.id, 
        role: 'editor' 
      }
    });

    console.log(`✅ 완료! [${user.email}] 계정이 새 조직(${newOrg.name})으로 격리되었으며, 권한이 editor(일반 관리자)로 수정되었습니다.`);
    console.log('이제 해당 계정으로 로그인하시면 기존의 다른 회사 광고 데이터가 보이지 않습니다.');
  } catch (e) {
    console.error('❌ 에러:', e);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

run();
