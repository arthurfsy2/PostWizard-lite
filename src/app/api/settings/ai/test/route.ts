import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { normalizeAIUrl } from '@/lib/ai-url';
import { prisma } from '@/lib/prisma';
import { decryptSafe } from '@/lib/crypto';

const SETTINGS_KEY = 'ai_configs';

export async function POST(request: Request) {
  try {
    const { apiKey: rawApiKey, baseUrl, model, provider, configId } = await request.json();

    let apiKey = rawApiKey;

    // 前端未传 apiKey 时，从数据库读取已保存的 key
    if (!apiKey && configId) {
      const configsSetting = await prisma.settings.findUnique({ where: { key: SETTINGS_KEY } });
      if (configsSetting?.value) {
        const configs = JSON.parse(configsSetting.value);
        const stored = configs.find((c: any) => c.id === configId);
        if (stored?.apiKey) {
          apiKey = decryptSafe(stored.apiKey);
        }
      }
    }

    if (!apiKey) {
      return NextResponse.json({
        success: false,
        error: 'API Key 不能为空',
      });
    }

    const openai = new OpenAI({
      apiKey,
      baseURL: normalizeAIUrl(baseUrl, provider),
    });

    // 发送测试请求
    const startTime = Date.now();
    const response = await openai.chat.completions.create({
      model,
      messages: [{ role: 'user', content: 'Hello' }],
      max_tokens: 5,
    });
    const responseTime = Date.now() - startTime;

    if (response.choices?.length > 0) {
      return NextResponse.json({
        success: true,
        message: `模型 ${response.model} 响应正常（${responseTime}ms）`,
        data: {
          model: response.model,
          responseTime: `${responseTime}ms`,
          tokenUsage: response.usage,
        },
      });
    }

    return NextResponse.json({
      success: false,
      error: '未收到模型响应',
    });
  } catch (error: any) {
    console.error('[AI Test] 连接失败:', error?.message || error);
    return NextResponse.json({
      success: false,
      error: error.message || '连接失败',
    });
  }
}
