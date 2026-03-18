const { createDecipheriv, createHmac } = require('crypto');
const { Pool } = require('pg');

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;
const p = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres.jnczxpqnutkmczpozgex:agency-os-db-2024!@aws-1-ap-northeast-2.pooler.supabase.com:6543/postgres',
  ssl: { rejectUnauthorized: false }
});

function decrypt(ciphertext) {
  const [ivHex, authTagHex, encryptedHex] = ciphertext.split(':');
  const key = Buffer.from(ENCRYPTION_KEY, 'hex');
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);
  let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

(async () => {
  const acct = await p.query("SELECT customer_id, api_key_encrypted, secret_key_encrypted FROM naver_accounts WHERE deleted_at IS NULL LIMIT 1");
  const acc = acct.rows[0];
  
  const apiKey = decrypt(acc.api_key_encrypted);
  const secretKey = decrypt(acc.secret_key_encrypted);
  console.log('customerId:', acc.customer_id);
  console.log('apiKey:', apiKey.substring(0, 10) + '...');
  
  // 광고그룹 1개의 소재 조회 테스트
  const agResult = await p.query("SELECT naver_ad_group_id, name FROM ad_groups LIMIT 2");
  
  for (const ag of agResult.rows) {
    const timestamp = String(Date.now());
    const path = '/ncc/ads';
    const hmac = createHmac('sha256', secretKey);
    hmac.update(`${timestamp}.GET.${path}`);
    const signature = hmac.digest('base64');
    
    const url = `https://api.searchad.naver.com${path}?nccAdgroupId=${ag.naver_ad_group_id}`;
    const res = await fetch(url, {
      headers: {
        'X-API-KEY': apiKey,
        'X-Customer': acc.customer_id,
        'X-Timestamp': timestamp,
        'X-Signature': signature,
        'Content-Type': 'application/json',
      }
    });
    const data = await res.json();
    console.log(`\n"${ag.name}": 소재 ${Array.isArray(data) ? data.length : 'ERROR'}개`);
    if (Array.isArray(data) && data.length > 0) {
      const ad = data[0];
      console.log('  nccAdId:', ad.nccAdId);
      console.log('  subject:', ad.subject ?? ad.headline);
      console.log('  type:', ad.type);
    } else if (!Array.isArray(data)) {
      console.log('  응답:', JSON.stringify(data).substring(0, 200));
    }
  }
  
  p.end();
})();
