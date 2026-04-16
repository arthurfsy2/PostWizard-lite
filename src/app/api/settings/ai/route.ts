import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

const SETTINGS_KEY = 'ai_configs';
const ACTIVE_KEY = 'ai_active_config';

export interface AIConfig {
  id: string;
  provider: string;
  name: string;
  apiKey: string;
  baseUrl: string;
  model: string;
}

// GET /api/settings/ai
export async function GET() {
  try {
    const [configsSetting, activeSetting] = await Promise.all([
      prisma.settings.findUnique({ where: { key: SETTINGS_KEY } }),
      prisma.settings.findUnique({ where: { key: ACTIVE_KEY } }),
    ]);

    const configs: AIConfig[] = configsSetting?.value ? JSON.parse(configsSetting.value) : [];
    const activeId = activeSetting?.value;

    // 兼容旧数据：如果只有一个旧配置，自动迁移
    const oldConfig = await prisma.settings.findUnique({ where: { key: 'ai_config' } });
    if (oldConfig?.value && configs.length === 0) {
      const parsed = JSON.parse(oldConfig.value);
      const migrated: AIConfig = {
        id: 'qwen-default',
        provider: parsed.provider || 'qwen',
        name: '通义千问',
        apiKey: parsed.apiKey || '',
        baseUrl: parsed.baseUrl || 'https://dashscope.aliyuncs.com/compatible-mode/v1',
        model: parsed.model || 'qwen-plus',
      };
      configs.push(migrated);
      await prisma.settings.upsert({
        where: { key: SETTINGS_KEY },
        update: { value: JSON.stringify(configs) },
        create: { key: SETTINGS_KEY, value: JSON.stringify(configs) },
      });
    }

    // 确保至少有一个默认配置
    if (configs.length === 0) {
      configs.push({
        id: 'qwen-default',
        provider: 'qwen',
        name: '通义千问',
        apiKey: '',
        baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
        model: 'qwen-plus',
      });
    }

    const activeConfig = configs.find(c => c.id === activeId) || configs[0];

    return NextResponse.json({
      configs,
      activeId: activeConfig.id,
      ...activeConfig,
    });
  } catch (error) {
    console.error('Failed to load AI settings:', error);
    return NextResponse.json({ error: '加载失败' }, { status: 500 });
  }
}

// POST /api/settings/ai - 保存当前配置
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { id, provider, name, apiKey, baseUrl, model, action } = body;

    const [configsSetting, activeSetting] = await Promise.all([
      prisma.settings.findUnique({ where: { key: SETTINGS_KEY } }),
      prisma.settings.findUnique({ where: { key: ACTIVE_KEY } }),
    ]);

    let configs: AIConfig[] = configsSetting?.value ? JSON.parse(configsSetting.value) : [];
    const configId = id || `${provider}-${Date.now()}`;

    if (action === 'delete') {
      // 删除配置
      configs = configs.filter(c => c.id !== id);
      await prisma.settings.upsert({
        where: { key: SETTINGS_KEY },
        update: { value: JSON.stringify(configs) },
        create: { key: SETTINGS_KEY, value: JSON.stringify(configs) },
      });
      return NextResponse.json({ success: true, configs });
    }

    // 查找或创建配置
    const existingIndex = configs.findIndex(c => c.id === configId);
    const newConfig: AIConfig = {
      id: configId,
      provider,
      name: name || `${provider} 配置`,
      apiKey,
      baseUrl,
      model,
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

    // 设为激活
    await prisma.settings.upsert({
      where: { key: ACTIVE_KEY },
      update: { value: configId },
      create: { key: ACTIVE_KEY, value: configId },
    });

    return NextResponse.json({ success: true, configs, activeId: configId });
  } catch (error) {
    console.error('Failed to save AI settings:', error);
    return NextResponse.json({ error: '保存失败' }, { status: 500 });
  }
}

// PATCH /api/settings/ai - 切换激活配置
export async function PATCH(request: Request) {
  try {
    const { activeId } = await request.json();

    await prisma.settings.upsert({
      where: { key: ACTIVE_KEY },
      update: { value: activeId },
      create: { key: ACTIVE_KEY, value: activeId },
    });

    return NextResponse.json({ success: true, activeId });
  } catch (error) {
    console.error('Failed to switch AI config:', error);
    return NextResponse.json({ error: '切换失败' }, { status: 500 });
  }
}
