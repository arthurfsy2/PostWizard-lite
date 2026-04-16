/**
 * AI 配置管理工具
 * 
 * 从数据库动态读取 AI 配置，支持环境变量 fallback
 */

import { prisma } from '@/lib/prisma';
import OpenAI from 'openai';
import { normalizeAIUrl } from '@/lib/ai-url';

export interface AIConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
  provider?: string;
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
          apiKey: activeConfig.apiKey || defaultConfig.apiKey,
          baseUrl: activeConfig.baseUrl || defaultConfig.baseUrl,
          model: activeConfig.model || defaultConfig.model,
          provider: activeConfig.provider,
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
        apiKey: parsed.apiKey || defaultConfig.apiKey,
        baseUrl: parsed.baseUrl || defaultConfig.baseUrl,
        model: parsed.model || defaultConfig.model,
        provider: parsed.provider,
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
 * 创建 OpenAI 客户端（使用动态配置）
 * 
 * @returns OpenAI 客户端实例
 */
export async function createOpenAIClient(): Promise<OpenAI> {
  const config = await getAIConfigFromDB();

  return new OpenAI({
    apiKey: config.apiKey,
    baseURL: normalizeAIUrl(config.baseUrl, config.provider),
  });
}
