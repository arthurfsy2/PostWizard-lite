import { NextRequest, NextResponse } from 'next/server';
import { getLocalUserId } from '@/lib/local-user';
import { analyzeProfileContent } from '@/lib/services/profileAIService';
/**
 * POST /api/profile/translate
 * 翻译个人简介（中文→英文）并提取标签
 * Body: { aboutMe: string, casualNotes?: string }
 */
export async function POST(request: NextRequest) {
  try {
    const userId = getLocalUserId();

    const body = await request.json();
    const { aboutMe, casualNotes } = body;

    // 验证输入
    if (!aboutMe || typeof aboutMe !== 'string') {
      return NextResponse.json(
        { error: '个人简介内容不能为空' },
        { status: 400 }
      );
    }

    if (aboutMe.length > 2000) {
      return NextResponse.json(
        { error: '个人简介内容不能超过2000字符' },
        { status: 400 }
      );
    }

    try {
      const result = await analyzeProfileContent(aboutMe, casualNotes || '');

      return NextResponse.json({
        success: true,
        translation: result.translation,
        tags: result.tags,
        usage: result.usage,
      });
    } catch (aiError) {
      console.error('[Profile Translate] AI Error:', aiError);
      return NextResponse.json(
        { error: 'AI 翻译失败，请稍后重试' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('[Profile Translate] 请求处理失败:', error);
    return NextResponse.json(
      { error: '处理请求失败' },
      { status: 500 }
    );
  }
}
