const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({
  datasourceUrl: "postgresql://postgres.jnczxpqnutkmczpozgex:agency-os-db-2024%21@aws-1-ap-northeast-2.pooler.supabase.com:6543/postgres"
});

async function main() {
  try {
    const user = await prisma.user.findUnique({ where: { email: 'neolawyer@agency.com' } });
    if (!user) {
      console.log('사용자를 찾을 수 없습니다.');
      return;
    }
    
    // 신규 조직(테스트용) 생성
    const newOrg = await prisma.organization.create({
      data: {
        name: 'NeoLawyer Test Org',
      }
    });
    
    // 새 조직으로 유저 소속 변경
    await prisma.user.update({
      where: { email: 'neolawyer@agency.com' },
      data: { organizationId: newOrg.id }
    });
    
    console.log(`✅ [${user.email}] 계정의 조직이 [${newOrg.name}] (ID: ${newOrg.id}) 로 분리되었습니다.`);
    console.log('이제 해당 계정으로 로그인 시 기존 데이터가 보이지 않는 빈 페이지가 노출됩니다.');
    
  } catch (error) {
    console.error('에러 발생:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
