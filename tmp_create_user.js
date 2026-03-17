const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

// Vercel/Supabase DB URL을 직접 박아줍니다. (.env 로드 실패 방지)
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: "postgresql://postgres.jnczxpqnutkmczpozgex:agency-os-db-2024%21@aws-1-ap-northeast-2.pooler.supabase.com:6543/postgres"
    }
  }
});

async function main() {
  try {
    console.log('조직 정보 조회 중...');
    const org = await prisma.organization.findFirst();
    
    if (!org) {
      console.log('⚠️ 조직(Organization)이 존재하지 않습니다. 먼저 조직을 생성하세요.');
      return;
    }

    const email = 'neolawyer@agency.com';
    const rawPassword = 'meat0101#';
    
    console.log('접속 비밀번호 해싱 중...');
    const passwordHash = await bcrypt.hash(rawPassword, 10);

    console.log('사용자(neolawyer) 계정 생성 또는 업데이트 중...');
    const user = await prisma.user.upsert({
      where: { email },
      update: {
        passwordHash,
        organizationId: org.id,
        role: 'admin', // 관리자로 권한 부여
      },
      create: {
        email,
        name: 'Neo Lawyer',
        passwordHash,
        role: 'admin', // 관리자로 권한 부여
        organizationId: org.id,
      }
    });

    console.log('✅ 신규 계정 생성이 완료되었습니다!');
    console.log('- 이메일(ID):', user.email);
    console.log('- 조직 ID:', org.id);
  } catch (error) {
    console.error('❌ 계정 생성 실패:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
