import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { encrypt, decryptSafe } from '@/lib/crypto';

const SETTINGS_KEY = 'ai_configs';
const ACTIVE_KEY = 'ai_active_config';

interface AIConfig {
  id: string;
  provider: string;
  name: string;
  apiKey: string;
  baseUrl: string;
  model: string;
  useFor?: 'all' | 'text' | 'ocr';
  proxy?: string;
  enabled?: boolean;
  tier?: 'free' | 'paid';
}

function maskApiKey(configs: AIConfig[]): (AIConfig & { hasApiKey: boolean })[] {
  return configs.map(c => ({
    ...c,
    apiKey: '',
    hasApiKey: !!c.apiKey,
    useFor: c.useFor || 'all',
    proxy: c.proxy || '',
    enabled: c.enabled !== false,
    tier: c.tier || 'free',
  }));
}

function validateConfig(body: any): string | null {
  if (!body.provider || !['qwen', 'deepseek', 'gemini', 'openai', 'custom'].includes(body.provider)) {
    return '请选择有效的 AI 服务商';
  }
  if (!body.name || !body.name.trim()) {
    return '配置名称不能为空';
  }
  if (!body.baseUrl || !body.baseUrl.trim()) {
    return 'API Base URL 不能为空';
  }
  if (!body.model || !body.model.trim()) {
    return '模型名称不能为空';
  }
  return null;
}

// GET /api/settings/ai
export async function GET() {
  try {
    const [configsSetting, activeSetting] = await Promise.all([
      prisma.settings.findUnique({ where: { key: SETTINGS_KEY } }),
      prisma.settings.findUnique({ where: { key: ACTIVE_KEY } }),
    ]);

    const rawConfigs: AIConfig[] = configsSetting?.value ? JSON.parse(configsSetting.value) : [];
    // 解密 apiKey
    const configs = rawConfigs.map(c => ({ ...c, apiKey: decryptSafe(c.apiKey) }));
    const activeId = activeSetting?.value;

    // 兼容旧数据
    const oldConfig = await prisma.settings.findUnique({ where: { key: 'ai_config' } });
    if (oldConfig?.value && configs.length === 0) {
      const parsed = JSON.parse(oldConfig.value);
      const migrated: AIConfig = {
        id: 'qwen-default',
        provider: parsed.provider || 'qwen',
        name: '通义千问',
        apiKey: encrypt(parsed.apiKey || ''),
        baseUrl: parsed.baseUrl || 'https://dashscope.aliyuncs.com/compatible-mode/v1',
        model: parsed.model || 'qwen-plus',
        useFor: 'all',
      };
      configs.push(migrated);
      await prisma.settings.upsert({
        where: { key: SETTINGS_KEY },
        update: { value: JSON.stringify(configs) },
        create: { key: SETTINGS_KEY, value: JSON.stringify(configs) },
      });
    }

    if (configs.length === 0) {
      configs.push({
        id: 'qwen-default',
        provider: 'qwen',
        name: '通义千问',
        apiKey: '',
        baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
        model: 'qwen-plus',
        useFor: 'all',
      });
    }

    const activeConfig = configs.find(c => c.id === activeId) || configs[0];

    // 返回时掩码 apiKey
    return NextResponse.json({
      configs: maskApiKey(configs),
      activeId: activeConfig.id,
      provider: activeConfig.provider,
      name: activeConfig.name,
      baseUrl: activeConfig.baseUrl,
      model: activeConfig.model,
      useFor: activeConfig.useFor || 'all',
      proxy: activeConfig.proxy || '',
      tier: activeConfig.tier || 'free',
      hasApiKey: !!activeConfig.apiKey,
    });
  } catch (error) {
    console.error('[AI Settings] 加载失败:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: '加载失败' }, { status: 500 });
  }
}

// POST /api/settings/ai - 保存配置
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { id, provider, name, apiKey, baseUrl, model, useFor, proxy, enabled, tier, action } = body;

    if (action === 'delete') {
      if (!id) {
        return NextResponse.json({ error: '缺少配置 ID' }, { status: 400 });
      }
      const [configsSetting] = await Promise.all([
        prisma.settings.findUnique({ where: { key: SETTINGS_KEY } }),
      ]);
      let configs: AIConfig[] = configsSetting?.value ? JSON.parse(configsSetting.value) : [];
      configs = configs.filter(c => c.id !== id);
      await prisma.settings.upsert({
        where: { key: SETTINGS_KEY },
        update: { value: JSON.stringify(configs) },
        create: { key: SETTINGS_KEY, value: JSON.stringify(configs) },
      });
      return NextResponse.json({ success: true, configs: maskApiKey(configs) });
    }

    // 输入校验
    const validationError = validateConfig(body);
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    const [configsSetting] = await Promise.all([
      prisma.settings.findUnique({ where: { key: SETTINGS_KEY } }),
    ]);

    let configs: AIConfig[] = configsSetting?.value ? JSON.parse(configsSetting.value) : [];
    const configId = id || `${provider}-${Date.now()}`;

    const existingIndex = configs.findIndex(c => c.id === configId);
    // 如果传入空 apiKey 且是更新已有配置，则保留原 apiKey
    const existingApiKey = existingIndex >= 0 ? decryptSafe(configs[existingIndex].apiKey) : '';
    const finalApiKey = apiKey || existingApiKey;

    const newConfig: AIConfig = {
      id: configId,
      provider,
      name: name.trim(),
      apiKey: encrypt(finalApiKey),
      baseUrl: baseUrl.trim(),
      model: model.trim(),
      useFor: useFor || 'all',
      proxy: proxy?.trim() || '',
      enabled: enabled !== false,
      tier: tier || 'free',
    };

    if (existingIndex >= 0) {
      configs[existingIndex] = newConfig;
    } else {
      configs.push(newConfig);
    }

    await prisma.settings.upsert({
      where: { key: SETTINGS_KEY },
      update: { value: JSON.stringify(configs) },
      create: { key: SETTINGS_KEY, value: JSON.stringify(configs) },
    });

    await prisma.settings.upsert({
      where: { key: ACTIVE_KEY },
      update: { value: configId },
      create: { key: ACTIVE_KEY, value: configId },
    });

    return NextResponse.json({ success: true, configs: maskApiKey(configs), activeId: configId });
  } catch (error) {
    console.error('[AI Settings] 保存失败:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: '保存失败' }, { status: 500 });
  }
}

// PATCH /api/settings/ai - 切换激活配置
export async function PATCH(request: Request) {
  try {
    const { activeId } = await request.json();

    if (!activeId) {
      return NextResponse.json({ error: '缺少 activeId' }, { status: 400 });
    }

    // 验证 configId 存在
    const configsSetting = await prisma.settings.findUnique({ where: { key: SETTINGS_KEY } });
    const configs: AIConfig[] = configsSetting?.value ? JSON.parse(configsSetting.value) : [];
    if (!configs.some(c => c.id === activeId)) {
      return NextResponse.json({ error: '配置不存在' }, { status: 404 });
    }

    await prisma.settings.upsert({
      where: { key: ACTIVE_KEY },
      update: { value: activeId },
      create: { key: ACTIVE_KEY, value: activeId },
    });

    return NextResponse.json({ success: true, activeId });
  } catch (error) {
    console.error('[AI Settings] 切换失败:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: '切换失败' }, { status: 500 });
  }
}
