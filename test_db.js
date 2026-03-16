const { Pool } = require('pg');

const url = process.env.DATABASE_URL || 'postgresql://postgres.jnczxpqnutkmczpozgex:agency-os-db-2024%21@aws-1-ap-northeast-2.pooler.supabase.com:6543/postgres';
console.log('Connecting to:', url.replace(/:([^:@]+)@/, ':***@'));

const pool = new Pool({
  connectionString: url,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 10000,
});

async function test() {
  try {
    const client = await pool.connect();
    console.log('Connected!');
    const result = await client.query('SELECT email, role FROM users LIMIT 3');
    console.log('Users:', result.rows);
    client.release();
  } catch (err) {
    console.error('Connection error:', err.message);
  } finally {
    await pool.end();
  }
}

test();
