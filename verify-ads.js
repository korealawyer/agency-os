const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function run() {
  const ads = await prisma.ad.count();
  console.log('Total ads:', ads);
  const kws = await prisma.keyword.count();
  console.log('Total kws:', kws);
}
run().catch(console.error).finally(() => prisma.$disconnect());
