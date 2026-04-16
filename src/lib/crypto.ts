// 开源版：加密功能已移除，仅保留兼容 stub
// 因为开源版不使用 IMAP 密码加密功能

export function encrypt(text: string): string {
  return text;
}

export function decrypt(encrypted: string): string {
  return encrypted;
}

export function decryptSafe(encrypted: string): string | null {
  return encrypted;
}

export function isEncrypted(text: string): boolean {
  return false;
}
