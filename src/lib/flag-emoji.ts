/**
 * 国家/地区代码到国旗 Emoji 的映射表
 * 基于 Postcrossing 官方国家列表（249 个）
 * 
 * Unicode 规则：区域指示符号字母
 * A-Z → 🇦-🇿 (U+1F1E6 to U+1F1FF)
 * 例如：US = 🇺 + 🇸 = 🇺🇸
 */

import { COUNTRY_NAMES } from './country-codes';

/**
 * 将 2 字母国家代码转换为国旗 emoji
 * Unicode 区域指示符号：U+1F1E6 (🇦) to U+1F1FF (🇿)
 */
function codeToFlag(code: string): string {
  const upper = code.toUpperCase();
  if (upper.length !== 2) return '📮';
  
  const codePointA = 0x1F1E6; // 🇦
  const char1 = String.fromCodePoint(codePointA + (upper.charCodeAt(0) - 65));
  const char2 = String.fromCodePoint(codePointA + (upper.charCodeAt(1) - 65));
  
  return char1 + char2;
}

/**
 * 特殊地区 emoji 映射（不在标准 ISO 3166-1 中的地区）
 */
const SPECIAL_FLAGS: Record<string, string> = {
  'XK': '🇽🇰',  // Kosovo
  'SU': '🇸🇴',  // USSR (use Somalia as fallback)
};

/**
 * 获取国家旗帜 Emoji
 * @param country 国家名称或代码
 * @returns 旗帜 Emoji，找不到则返回 📮
 */
export function getFlagEmoji(country: string): string {
  if (!country) return '📮';
  
  const upper = country.toUpperCase().trim();
  
  // 1. 检查是否是 2 字母代码
  if (upper.length === 2) {
    // 特殊地区
    if (SPECIAL_FLAGS[upper]) {
      return SPECIAL_FLAGS[upper];
    }
    // 标准代码，使用 Unicode 生成
    return codeToFlag(upper);
  }
  
  // 2. 根据国家名称查找代码
  const lower = country.toLowerCase().trim();
  
  // 常见缩写映射
  const abbreviations: Record<string, string> = {
    'u.s.a.': 'US', 'u.s.': 'US', 'usa': 'US', 'us': 'US',
    'uk': 'GB', 'u.k.': 'GB', 'united kingdom': 'GB',
    'united states': 'US', 'uae': 'AE', 'dprk': 'KP',
    'north korea': 'KP', 'south korea': 'KR', 'roc': 'TW',
    'taiwan': 'TW', 'prc': 'CN', 'china': 'CN', 'russia': 'RU',
  };
  
  const code = abbreviations[lower];
  if (code) {
    return codeToFlag(code);
  }
  
  // 3. 在 COUNTRY_NAMES 中反向查找
  for (const [code, name] of Object.entries(COUNTRY_NAMES)) {
    if (name.toLowerCase() === lower) {
      return SPECIAL_FLAGS[code] || codeToFlag(code);
    }
  }
  
  // 4. 默认返回
  return '📮';
}
