import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

// ──── AES-256-GCM 암호화 (네이버 API 키 저장용) ────

const ALGORITHM = 'aes-256-gcm';

// ──── Fail-Close: 키 미설정 시 즉시 실패 ────
function getEncryptionKey(): Buffer {
  const keyHex = process.env.ENCRYPTION_KEY;
  if (!keyHex || keyHex.length !== 64) {
    throw new Error(
      '[FATAL] ENCRYPTION_KEY 환경변수가 설정되지 않았거나 형식이 올바르지 않습니다. (64자 hex 필요)'
    );
  }
  return Buffer.from(keyHex, 'hex');
}

// 지연 초기화 — 암호화 함수 호출 시에만 키를 로드
let _key: Buffer | null = null;
function getKey(): Buffer {
  if (!_key) _key = getEncryptionKey();
  return _key;
}

export function encrypt(plaintext: string): string {
  const iv = randomBytes(16);
  const cipher = createCipheriv(ALGORITHM, getKey(), iv);

  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag().toString('hex');

  // iv:authTag:ciphertext 형식으로 저장
  return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

export function decrypt(ciphertext: string): string {
  const [ivHex, authTagHex, encryptedHex] = ciphertext.split(':');

  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');

  const decipher = createDecipheriv(ALGORITHM, getKey(), iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}
