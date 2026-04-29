import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32;

function getKey(): Buffer {
  const keyHex = process.env.ENCRYPTION_KEY;
  if (!keyHex) {
    throw new Error('ENCRYPTION_KEY 环境变量未配置，请运行: node scripts/generate-encryption-key.js');
  }
  const key = Buffer.from(keyHex, 'hex');
  if (key.length !== KEY_LENGTH) {
    throw new Error(`ENCRYPTION_KEY 长度不正确，应为 ${KEY_LENGTH * 2} 个十六进制字符`);
  }
  return key;
}

export function encrypt(text: string): string {
  if (!text) return text;
  const key = getKey();
  const iv = randomBytes(16);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
}

export function decrypt(encryptedData: string): string {
  if (!encryptedData || !encryptedData.includes(':')) return encryptedData;
  const key = getKey();
  const [ivHex, authTagHex, encryptedHex] = encryptedData.split(':');
  if (!ivHex || !authTagHex || !encryptedHex) {
    throw new Error('加密数据格式不正确');
  }
  const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encryptedHex, 'hex')),
    decipher.final(),
  ]);
  return decrypted.toString('utf8');
}

export function isEncrypted(data: string): boolean {
  if (!data || typeof data !== 'string') return false;
  return data.includes(':') && data.split(':').length === 3;
}

export function decryptSafe(data: string): string {
  if (!isEncrypted(data)) return data;
  try {
    return decrypt(data);
  } catch {
    return data;
  }
}
