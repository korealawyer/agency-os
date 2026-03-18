import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const result = await prisma.user.update({
    where: { email: 'admin@agency.com' },
    data: { role: 'super_admin' },
  });
  console.log(`✅ ${result.email} 의 role이 '${result.role}'로 변경되었습니다.`);
}

main()
  .catch((e) => {
    console.error('❌ 실패:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
