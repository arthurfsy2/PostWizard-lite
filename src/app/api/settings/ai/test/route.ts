import { NextResponse } from 'next/server';
import { normalizeAIUrl } from '@/lib/ai-url';
import { prisma } from '@/lib/prisma';
import { decryptSafe } from '@/lib/crypto';

const SETTINGS_KEY = 'ai_configs';

/**
 * 创建代理感知的 fetch（OpenAI SDK v6 用 native fetch，不支持 httpAgent）
 * 使用 undici.fetch + ProxyAgent 实现代理
 */
async function createProxyFetch(proxy: string): Promise<typeof fetch | undefined> {
  if (!proxy) return undefined;
  try {
    const undici = await import('undici');
    const proxyUrl = proxy.startsWith('http') ? proxy : `http://${proxy}`;
    const dispatcher = new undici.ProxyAgent(proxyUrl);
    return ((input: any, init?: any) => {
      return undici.fetch(input, { ...init, dispatcher } as any);
    }) as unknown as typeof fetch;
  } catch (e) {
    console.warn('[AI Test] undici ProxyAgent 不可用:', (e as Error).message);
    return undefined;
  }
}

export async function POST(request: Request) {
  try {
    const { apiKey: rawApiKey, baseUrl, model, provider, proxy: rawProxy, useFor, configId } = await request.json();

    let apiKey = rawApiKey;
    let proxy = rawProxy || '';

    // 前端未传 apiKey 时，从数据库读取已保存的 key 和 proxy
    if ((!apiKey || !proxy) && configId) {
      const configsSetting = await prisma.settings.findUnique({ where: { key: SETTINGS_KEY } });
      if (configsSetting?.value) {
        const configs = JSON.parse(configsSetting.value);
        const stored = configs.find((c: any) => c.id === configId);
        if (stored) {
          if (!apiKey && stored.apiKey) apiKey = decryptSafe(stored.apiKey);
          if (!proxy && stored.proxy) proxy = stored.proxy;
        }
      }
    }

    if (!apiKey) {
      return NextResponse.json({
        success: false,
        error: 'API Key 不能为空',
      });
    }

    const normalizedUrl = normalizeAIUrl(baseUrl, provider);
    const trimmedModel = (model || '').trim();
    const isVisionModel = /vl|ocr|vision/i.test(trimmedModel) || useFor === 'ocr';

    console.log('[AI Test] 开始连接测试', {
      provider,
      model: trimmedModel,
      baseUrl: normalizedUrl,
      isVisionModel,
      proxy: proxy || '(无)',
    });

    const startTime = Date.now();

    // 先用 raw fetch 测试，获取完整的错误信息
    const fetchUrl = `${normalizedUrl}/chat/completions`;
    const fetchHeaders: any = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    };
    const fetchBody = JSON.stringify({
      model: trimmedModel,
      messages: [{ role: 'user', content: 'Hello' }],
      max_tokens: 5,
    });

    console.log('[AI Test] 请求详情', {
      url: fetchUrl,
      model: trimmedModel,
      bodyLength: fetchBody.length,
    });

    let fetchResponse: Response;
    try {
      const fetchOptions: any = {
        method: 'POST',
        headers: fetchHeaders,
        body: fetchBody,
      };
      if (proxy) {
        const proxyFetch = await createProxyFetch(proxy);
        if (proxyFetch) {
          fetchResponse = await proxyFetch(fetchUrl, fetchOptions);
        } else {
          fetchResponse = await fetch(fetchUrl, fetchOptions);
        }
      } else {
        fetchResponse = await fetch(fetchUrl, fetchOptions);
      }
    } catch (fetchErr: any) {
      console.error('[AI Test] fetch 异常:', fetchErr.message);
      throw fetchErr;
    }

    const responseTime = Date.now() - startTime;
    const responseBody = await fetchResponse.text();

    console.log('[AI Test] 响应详情', {
      status: fetchResponse.status,
      statusText: fetchResponse.statusText,
      bodyLength: responseBody.length,
      bodyPreview: responseBody.substring(0, 500),
    });

    if (!fetchResponse.ok) {
      throw new Error(`${fetchResponse.status} ${responseBody.substring(0, 300)}`);
    }

    let response: any;
    try {
      response = JSON.parse(responseBody);
    } catch {
      throw new Error(`响应解析失败: ${responseBody.substring(0, 300)}`);
    }

    console.log('[AI Test] 测试完成', {
      model: response.model || trimmedModel,
      responseTime: `${responseTime}ms`,
      tokenUsage: response.usage,
    });

    if (response.choices?.length > 0) {
      return NextResponse.json({
        success: true,
        message: `模型 ${response.model || trimmedModel} 响应正常（${responseTime}ms）`,
        data: {
          model: response.model || trimmedModel,
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
    console.error('[AI Test] 连接失败:', {
      message: error?.message,
      code: error?.code,
      status: error?.status,
      type: error?.type,
    });
    return NextResponse.json({
      success: false,
      error: error.message || '连接失败',
    });
  }
}
