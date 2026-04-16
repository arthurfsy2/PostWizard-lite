/**
 * 简体中文转繁体中文工具
 * 
 * 使用 opencc-js 实现简繁转换
 * 支持 SSR：动态导入避免 window 未定义问题
 */

import type * as OpenCCType from 'opencc-js';

let OpenCC: typeof OpenCCType | null = null;
let converter: ((text: string) => string) | null = null;

/**
 * 动态加载 opencc-js（仅在客户端或需要时加载）
 */
async function loadOpenCC() {
  if (!OpenCC) {
    OpenCC = await import('opencc-js');
    converter = OpenCC.Converter({ from: 'cn', to: 'tw' });
  }
  return { OpenCC: OpenCC!, converter: converter! };
}

/**
 * 将简体中文转换为繁体中文
 * @param text 简体中文文本
 * @returns 繁体中文文本
 */
export async function toTraditional(text: string): Promise<string> {
  if (!text) return '';
  const { converter } = await loadOpenCC();
  return converter(text);
}

/**
 * 批量转换词汇为繁体（同步版本，仅用于已有 converter 的情况）
 * @param words 词汇列表
 * @returns 繁体词汇列表
 */
export function convertWordsToTraditional(words: string[]): string[] {
  // 如果 converter 已初始化，使用同步版本
  if (converter) {
    return words.map(word => converter!(word));
  }
  // 否则返回原文本（服务端渲染时）
  return words;
}

/**
 * 同步版本 - 假设 converter 已加载（用于 API 路由）
 * @param text 简体中文文本
 * @returns 繁体中文文本
 */
export function toTraditionalSync(text: string): string {
  if (!text || !converter) return text;
  return converter(text);
}

// 预加载（仅在服务端）
if (typeof window === 'undefined') {
  // 服务端：立即加载
  import('opencc-js').then(mod => {
    OpenCC = mod;
    converter = OpenCC.Converter({ from: 'cn', to: 'tw' });
    console.log('🔤 [OpenCC] 已预加载简转繁转换器');
  }).catch(err => {
    console.error('🔤 [OpenCC] 预加载失败:', err);
  });
}

/**
 * 检查是否为中文内容（需要转换）
 * @param text 文本
 * @returns 是否包含中文字符
 */
export function containsChinese(text: string): boolean {
  return /[\u4e00-\u9fa5]/.test(text);
}
