import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const connectionString = process.env.DATABASE_URL || 'postgresql://localhost:5432/agency_os';
const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false },
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

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
