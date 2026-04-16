/**
 * AI URL 归一化工具（纯前端安全，无服务端依赖）
 */

/**
 * URL 归一化
 * custom: 原样返回，不做任何补全
 * gemini: 自动补全 /v1beta/openai（如果已有其他路径则替换）
 * 其他: 自动补全 /v1（如已有 /v1 则跳过）
 */
export function normalizeAIUrl(baseUrl: string, provider?: string): string {
  let url = baseUrl.replace(/\/+$/, '');
  
  // 自定义模式：原样返回
  if (provider === 'custom') return url;
  
  // Gemini 特殊处理（支持官方和中转站）
  if (provider === 'gemini') {
    if (url.includes('/v1beta/openai')) {
      return url;
    }
    // 检查是否有其他 Gemini 路径（如 /v1beta/models）
    const geminiMatch = url.match(/^(.*?)\/v1beta\/[^/]+$/);
    if (geminiMatch) {
      return geminiMatch[1] + '/v1beta/openai';
    }
    url += '/v1beta/openai';
    return url;
  }
  
  // 其他：补全 /v1
  if (!url.endsWith('/v1') && !url.includes('/v1/')) {
    url += '/v1';
  }
  
  return url;
}
