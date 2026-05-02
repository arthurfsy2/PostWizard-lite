/**
 * AI 配置管理工具
 * 
 * 从数据库动态读取 AI 配置，支持环境变量 fallback
 */

import { prisma } from '@/lib/prisma';
import OpenAI from 'openai';
import { normalizeAIUrl } from '@/lib/ai-url';
import { decryptSafe } from '@/lib/crypto';

export interface AIConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
  provider?: string;
  proxy?: string;
}

export interface AIConfigWithMeta extends AIConfig {
  id: string;
  name: string;
  useFor?: 'all' | 'text' | 'ocr';
  enabled?: boolean;
  tier?: 'free' | 'paid';
}

export { normalizeAIUrl } from '@/lib/ai-url';

/**
 * 从数据库获取 AI 配置
 * 
 * @returns AI 配置对象
 */
export async function getAIConfigFromDB(): Promise<AIConfig> {
  const defaultConfig: AIConfig = {
    apiKey: process.env.DASHSCOPE_API_KEY || '',
    baseUrl: process.env.AI_BASE_URL || 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    model: process.env.AI_MODEL || 'qwen3.6-plus',
  };

  try {
    // 读取多配置和激活配置
    const [configsSetting, activeSetting] = await Promise.all([
      prisma.settings.findUnique({ where: { key: 'ai_configs' } }),
      prisma.settings.findUnique({ where: { key: 'ai_active_config' } }),
    ]);

    if (configsSetting?.value) {
      const configs = JSON.parse(configsSetting.value);
      const activeId = activeSetting?.value;
      const activeConfig = configs.find((c: any) => c.id === activeId) || configs[0];
      
      if (activeConfig) {
        return {
          apiKey: decryptSafe(activeConfig.apiKey) || defaultConfig.apiKey,
          baseUrl: activeConfig.baseUrl || defaultConfig.baseUrl,
          model: activeConfig.model || defaultConfig.model,
          provider: activeConfig.provider,
          proxy: activeConfig.proxy || undefined,
        };
      }
    }

    // 兼容旧版：ai_config JSON
    const aiConfigSetting = await prisma.settings.findUnique({
      where: { key: 'ai_config' },
    });

    if (aiConfigSetting?.value) {
      const parsed = JSON.parse(aiConfigSetting.value);
      return {
        apiKey: decryptSafe(parsed.apiKey) || defaultConfig.apiKey,
        baseUrl: parsed.baseUrl || defaultConfig.baseUrl,
        model: parsed.model || defaultConfig.model,
        provider: parsed.provider,
        proxy: parsed.proxy || undefined,
      };
    }

    return defaultConfig;
  } catch (error) {
    console.error('[getAIConfigFromDB] 读取数据库配置失败:', error);
    // 降级到环境变量
    return defaultConfig;
  }
}

/**
 * 获取 AI 模型名称（快捷方法）
 * 
 * @returns 模型名称
 */
export async function getAIModel(): Promise<string> {
  const config = await getAIConfigFromDB();
  return config.model;
}

/**
 * 创建代理感知的 fetch 函数（OpenAI SDK v6 使用 native fetch，不支持 httpAgent）
 * 使用 undici.fetch + ProxyAgent 实现代理
 */
async function createProxyFetch(proxy: string): Promise<typeof fetch | undefined> {
  if (!proxy) return undefined;
  try {
    const undici = await import('undici');
    const proxyUrl = proxy.startsWith('http') ? proxy : `http://${proxy}`;
    const dispatcher = new undici.ProxyAgent(proxyUrl);
    // 使用 undici.fetch 替代 native fetch，支持 dispatcher 选项
    return ((input: any, init?: any) => {
      return undici.fetch(input, { ...init, dispatcher } as any);
    }) as unknown as typeof fetch;
  } catch (e) {
    console.warn('[createProxyFetch] undici ProxyAgent 不可用，代理可能不生效:', (e as Error).message);
    return undefined;
  }
}

/**
 * 创建 OpenAI 客户端（使用动态配置）
 *
 * @returns OpenAI 客户端实例
 */
export async function createOpenAIClient(): Promise<OpenAI> {
  const config = await getAIConfigFromDB();

  const options: any = {
    apiKey: config.apiKey,
    baseURL: normalizeAIUrl(config.baseUrl, config.provider),
    timeout: 60000, // 60s 超时，防止请求挂起
  };

  // 如果配置了代理，使用 undici ProxyAgent 的自定义 fetch
  if (config.proxy) {
    const proxyFetch = await createProxyFetch(config.proxy);
    if (proxyFetch) {
      options.fetch = proxyFetch;
    }
  }

  return new OpenAI(options);
}

/**
 * 创建带代理的 OpenAI 客户端（供外部直接传入 config 使用）
 */
export async function createOpenAIWithProxy(config: AIConfig): Promise<OpenAI> {
  const options: any = {
    apiKey: config.apiKey,
    baseURL: normalizeAIUrl(config.baseUrl, config.provider),
    timeout: 60000,
  };

  if (config.proxy) {
    const proxyFetch = await createProxyFetch(config.proxy);
    if (proxyFetch) {
      options.fetch = proxyFetch;
    }
  }

  return new OpenAI(options);
}

/**
 * 根据用途获取 AI 配置
 *
 * @param purpose - 'ocr'（图片识别）或 'text'（文字分析）
 * @returns 匹配的 AI 配置，优先级：专用配置 > all 配置 > 激活配置
 */
export async function getConfigForPurpose(purpose: 'ocr' | 'text'): Promise<AIConfig> {
  const defaultConfig = await getAIConfigFromDB();

  try {
    const configsSetting = await prisma.settings.findUnique({ where: { key: 'ai_configs' } });
    if (!configsSetting?.value) return defaultConfig;

    const configs: AIConfigWithMeta[] = JSON.parse(configsSetting.value);

    // 1. 找启用的专用配置（useFor === purpose）
    const dedicated = configs.find(c => c.useFor === purpose && c.apiKey && c.enabled !== false);
    if (dedicated) {
      return {
        apiKey: decryptSafe(dedicated.apiKey),
        baseUrl: dedicated.baseUrl,
        model: dedicated.model,
        provider: dedicated.provider,
        proxy: dedicated.proxy || undefined,
      };
    }

    // 2. 找启用的通用配置（useFor === 'all' 或未设置）
    const general = configs.find(c => (c.useFor === 'all' || !c.useFor) && c.apiKey && c.enabled !== false);
    if (general) {
      return {
        apiKey: decryptSafe(general.apiKey),
        baseUrl: general.baseUrl,
        model: general.model,
        provider: general.provider,
        proxy: general.proxy || undefined,
      };
    }

    // 3. fallback 到激活配置
    return defaultConfig;
  } catch {
    return defaultConfig;
  }
}

/**
 * 检查指定用途的配置是否为免费 tier
 * 用于批量上传时决定并发和限流策略
 */
export async function isFreeTier(purpose: 'ocr' | 'text'): Promise<boolean> {
  try {
    const configsSetting = await prisma.settings.findUnique({ where: { key: 'ai_configs' } });
    if (!configsSetting?.value) return true;

    const configs: AIConfigWithMeta[] = JSON.parse(configsSetting.value);

    // 找启用的专用配置
    const dedicated = configs.find(c => c.useFor === purpose && c.apiKey && c.enabled !== false);
    if (dedicated) return dedicated.tier !== 'paid';

    // 找启用的通用配置
    const general = configs.find(c => (c.useFor === 'all' || !c.useFor) && c.apiKey && c.enabled !== false);
    if (general) return general.tier !== 'paid';

    return true;
  } catch {
    return true;
  }
}
