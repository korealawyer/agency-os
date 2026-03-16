require('dotenv').config();
const { Pool } = require('pg');
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const bcrypt = require('bcryptjs');

async function test() {
  console.log('DATABASE_URL:', process.env.DATABASE_URL ? 'SET' : 'NOT SET');
  
  const connectionString = process.env.DATABASE_URL;
  const pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false },
    max: 1,
    connectionTimeoutMillis: 10000,
  });
  
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  try {
    console.log('Querying user...');
    const user = await prisma.user.findUnique({
      where: { email: 'admin@agency.com' },
      select: { id: true, email: true, passwordHash: true, role: true, isActive: true },
    });
    
    if (!user) {
      console.log('User not found!');
      return;
    }
    
    console.log('User found:', { id: user.id, email: user.email, role: user.role, isActive: user.isActive });
    console.log('Password hash:', user.passwordHash ? user.passwordHash.substring(0, 20) + '...' : 'NULL');
    
    const isValid = await bcrypt.compare('password', user.passwordHash);
    console.log('Password "password" valid:', isValid);
    
    const isValid123 = await bcrypt.compare('password123', user.passwordHash);
    console.log('Password "password123" valid:', isValid123);
    
  } catch (err) {
    console.error('Error:', err.message);
    console.error('Code:', err.code);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

test().then(() => console.log('Done!')).catch(console.error);
