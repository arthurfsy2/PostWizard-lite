import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { normalizeAIUrl } from '@/lib/ai-url';

export async function POST(request: Request) {
  try {
    const { apiKey, baseUrl, model, provider } = await request.json();

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
    console.error('AI test failed:', error);
    return NextResponse.json({
      success: false,
      error: error.message || '连接失败',
    });
  }
}
