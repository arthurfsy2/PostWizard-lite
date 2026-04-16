/**
 * 收件人输入预处理与规则脱敏
 *
 * 目标：在进入 AI 之前，优先用本地规则弱化或移除详细地址、联系方式、链接、平台标识等高风险内容，
 * 同时尽量保留国家、城市、语言、兴趣、偏好、特殊要求等对写作有价值的信息。
 */

export type SanitizationRiskLevel = 'low' | 'medium' | 'high';

export interface SanitizedInputResult {
  sanitizedText: string;
  removedFlags: string[];
  riskLevel: SanitizationRiskLevel;
  originalLength: number;
  sanitizedLength: number;
}

const PLATFORM_LINE_PATTERNS = [
  /postcrossing/i,
  /username\s*:/i,
  /profile\s*:/i,
  /user\s*id\s*:/i,
  /account\s*:/i,
  /direct link/i,
  /travelingpostcard/i,
];

const ADDRESS_LABEL_PATTERNS = [
  /^\s*(and the address|address|to)\s*[:：]?\s*$/i,
  /^\s*(street|st\.?|road|rd\.?|avenue|ave\.?|lane|ln\.?|drive|dr\.?|boulevard|blvd\.?|building|room|apartment|apt\.?|floor|fl\.?|district|province|postal code|zip code|postcode)\b/i,
  /\b(postal code|zip code|postcode)\b/i,
  /[\u4e00-\u9fa5].*(地址|街道|邮编|路|号|室|楼|区)/,
];

const CONTACT_LINE_PATTERNS = [
  /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i,
  /https?:\/\//i,
  /www\./i,
  /\+?\d[\d\s().-]{6,}\d/,
];

const KEEP_SECTION_PATTERNS = [
  /about the recipient/i,
  /languages?\s*:/i,
  /interests?\s*:/i,
  /likes?\s*:/i,
  /dislikes?\s*:/i,
  /no!\s*no!/i,
  /wants?\s*:/i,
  /prefers?\s*:/i,
  /favorite/i,
  /hobbies?/i,
  /please write/i,
  /i (love|like|prefer|enjoy)/i,
];

const COUNTRY_CITY_HINT_PATTERN = /\b(country|city|from|live in|located in|austria|germany|finland|china|taiwan|hong kong|japan|usa|united states|canada|france|italy|spain|poland|czech|russia|ukraine|turkey|brazil|argentina|australia|new zealand)\b/i;
const ADDRESS_CONTINUATION_PATTERNS = [
  /^\s*[A-Za-zÀ-ÿ0-9_.-]+\s+(street|st\.?|road|rd\.?|avenue|ave\.?|lane|ln\.?|drive|dr\.?|boulevard|blvd\.?|way|square|sq\.?|court|ct\.?|place|pl\.?|terrace|ter\.?|highway|hwy\.?)\b/i,
  /^\s*(building|room|apartment|apt\.?|floor|fl\.?|unit|suite|district|province)\b/i,
  /^\s*\d+[A-Za-z-]*\s+[A-Za-zÀ-ÿ0-9_. -]+$/,
  /^\s*[A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3}\s+(street|st\.?|road|rd\.?|avenue|ave\.?|lane|ln\.?|drive|dr\.?|boulevard|blvd\.?|way|square|sq\.?|court|ct\.?|place|pl\.?|terrace|ter\.?|highway|hwy\.?)\b/i,
];

const COUNTRY_ONLY_PATTERNS = [
  /^(austria|germany|finland|china|taiwan(?:,\s*china)?|hong kong(?:,\s*china)?|japan|usa|united states|canada|france|italy|spain|poland|czech(?: republic)?|russia|ukraine|turkey|brazil|argentina|australia|new zealand)$/i,
];

const NAME_ONLY_PATTERN = /^[A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3}$/;

function dedupe<T>(items: T[]): T[] {
  return [...new Set(items)];
}

function normalizeWhitespace(text: string): string {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

function stripInlineSensitiveData(line: string, removedFlags: string[]): string {
  let next = line;

  if (/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(next)) {
    next = next.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[联系方式已忽略]');
    removedFlags.push('email');
  }

  if (/https?:\/\//i.test(next) || /www\./i.test(next)) {
    next = next.replace(/https?:\/\/\S+/gi, '[链接已忽略]');
    next = next.replace(/www\.\S+/gi, '[链接已忽略]');
    removedFlags.push('url');
  }

  if (/\+?\d[\d\s().-]{6,}\d/.test(next)) {
    next = next.replace(/\+?\d[\d\s().-]{6,}\d/g, '[号码已忽略]');
    removedFlags.push('phone');
  }

  return next;
}

function shouldDropLine(line: string): { drop: boolean; reason?: string } {
  const text = line.trim();
  if (!text) return { drop: false };

  if (PLATFORM_LINE_PATTERNS.some((pattern) => pattern.test(text))) {
    return { drop: true, reason: 'platform' };
  }

  if (CONTACT_LINE_PATTERNS.some((pattern) => pattern.test(text)) && !KEEP_SECTION_PATTERNS.some((pattern) => pattern.test(text))) {
    return { drop: true, reason: 'contact' };
  }

  if (ADDRESS_LABEL_PATTERNS.some((pattern) => pattern.test(text)) && !KEEP_SECTION_PATTERNS.some((pattern) => pattern.test(text))) {
    return { drop: true, reason: 'address' };
  }

  if (/^\d{4,}\s+[A-Za-z\u4e00-\u9fa5-]+/.test(text)) {
    return { drop: true, reason: 'address' };
  }

  return { drop: false };
}

export function sanitizeRecipientInput(rawText: string): SanitizedInputResult {
  const originalText = rawText || '';
  const removedFlags: string[] = [];
  const lines = originalText.replace(/\r\n/g, '\n').split('\n');
  const keptLines: string[] = [];

  let skippingAddressBlock = false;

  for (const rawLine of lines) {
    const line = rawLine.trimRight();
    const trimmed = line.trim();

    if (!trimmed) {
      skippingAddressBlock = false;
      keptLines.push('');
      continue;
    }

    const dropCheck = shouldDropLine(trimmed);

    if (dropCheck.drop) {
      removedFlags.push(dropCheck.reason || 'sensitive');
      skippingAddressBlock = dropCheck.reason === 'address';
      continue;
    }

    if (skippingAddressBlock) {
      const looksLikeSafeContent = KEEP_SECTION_PATTERNS.some((pattern) => pattern.test(trimmed));
      const looksLikeCountryOnly = COUNTRY_ONLY_PATTERNS.some((pattern) => pattern.test(trimmed));
      const looksLikeAddressContinuation =
        /\d/.test(trimmed) ||
        /,/.test(trimmed) ||
        ADDRESS_LABEL_PATTERNS.some((pattern) => pattern.test(trimmed)) ||
        ADDRESS_CONTINUATION_PATTERNS.some((pattern) => pattern.test(trimmed));
      const looksLikeNameOnly = NAME_ONLY_PATTERN.test(trimmed);

      if (looksLikeAddressContinuation && !looksLikeSafeContent && !looksLikeCountryOnly) {
        removedFlags.push('address');
        continue;
      }

      if (!looksLikeSafeContent && !looksLikeCountryOnly && !looksLikeNameOnly && !COUNTRY_CITY_HINT_PATTERN.test(trimmed)) {
        removedFlags.push('address');
        continue;
      }

      if (looksLikeSafeContent || looksLikeCountryOnly) {
        skippingAddressBlock = false;
      }
    }

    const cleaned = stripInlineSensitiveData(trimmed, removedFlags).trim();
    if (!cleaned) continue;

    keptLines.push(cleaned);
  }

  let sanitizedText = normalizeWhitespace(keptLines.join('\n'));

  if (!sanitizedText) {
    sanitizedText = 'No usable recipient summary remained after sanitization.';
  }

  const uniqueFlags = dedupe(removedFlags);
  const riskLevel: SanitizationRiskLevel =
    uniqueFlags.length >= 3 ? 'high' : uniqueFlags.length >= 1 ? 'medium' : 'low';

  return {
    sanitizedText,
    removedFlags: uniqueFlags,
    riskLevel,
    originalLength: originalText.length,
    sanitizedLength: sanitizedText.length,
  };
}
