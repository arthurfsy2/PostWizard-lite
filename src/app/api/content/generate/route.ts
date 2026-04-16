import { NextRequest, NextResponse } from 'next/server';
import { getLocalUserId } from '@/lib/local-user';
import { generationService } from '@/lib/services/generationService';
/**
 * POST /api/content/generate
 * 生成明信片内容
 */
export async function POST(request: NextRequest) {
  try {
    // 获取当前用户
    const userId = getLocalUserId();

    const body = await request.json();
    const {
      recipientId,  // 前端传递的参数名
      postcardId,  // 也支持 postcardId
      language = 'zh',
      tone = 'friendly',
      includeWeather = false,
      includeLocalNews = false,
      includePersonalStory = false,
      wordCount = 200,
      isHandwritten = false,
      // 额外的用户信息（来自 Postcrossing 直连）
      extraInfo,
    } = body;

    // 统一使用 recipientId 作为查询 ID（数据库 UUID）
    const queryId = recipientId || postcardId;

    if (!queryId) {
      return NextResponse.json(
        {
          success: false,
          error: '缺少明信片 ID',
        },
        { status: 400 },
      );
    }

    // 调用生成服务（传入当前用户 ID 以确保使用正确的素材）
    const result = await generationService.generatePostcardById(queryId, userId, {
      language,
      tone,
      includeWeather,
      includeLocalNews,
      includePersonalStory,
      wordCount,
      isHandwritten,
      extraInfo, // 传递额外的用户信息
    });

    return NextResponse.json(
      {
        success: true,
        data: result,
        message: '内容生成成功',
      },
      { status: 201 },
    );
  } catch (error: unknown) {
    // console.error('生成内容失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || '生成内容失败',
      },
      { status: 500 },
    );
  }
}
