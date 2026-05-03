import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getLocalUserId } from '@/lib/local-user';
import { analyzeProfileContent, containsChinese } from '@/lib/services/profileAIService';

/**
 * GET /api/profile
 * 获取当前用户的个人要素信息
 */
export async function GET(request: NextRequest) {
  try {
    const userId = getLocalUserId();

    const profile = await prisma.userProfile.findUnique({
      where: { userId: userId },
    });

    // 如果不存在，返回空数据（前端可以初始化）
    if (!profile) {
      return NextResponse.json({
        profile: {
          aboutMe: '',
          aboutMeEn: '',
          casualNotes: '',
          inspirationNotes: '',
          tags: [],
          createdAt: null,
          updatedAt: null,
        },
      });
    }

    return NextResponse.json({
      profile: {
        aboutMe: profile.aboutMe,
        aboutMeEn: profile.aboutMeEn,
        casualNotes: profile.casualNotes,
        inspirationNotes: (profile as any).inspirationNotes || '',
        tags: JSON.parse(profile.tags || '[]'),
        createdAt: profile.createdAt.toISOString(),
        updatedAt: profile.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    console.error('[Profile GET] 获取个人要素失败:', error);
    return NextResponse.json(
      { error: '获取个人要素失败' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/profile
 * 保存个人要素信息（自动分析生成标签）
 * Body: { aboutMe?: string, aboutMeEn?: string, casualNotes?: string, tags?: string[] }
 */
export async function POST(request: NextRequest) {
  try {
    const userId = getLocalUserId();

    const body = await request.json();
    let { aboutMe, aboutMeEn, casualNotes, inspirationNotes, tags } = body;

    // 查询现有数据
    const existingProfile = await prisma.userProfile.findUnique({
      where: { userId: userId },
    });

    // 判断哪些字段被明确提供了（只更新提供的字段，避免清空其他字段）
    const hasAboutMe = 'aboutMe' in body;
    const hasCasualNotes = 'casualNotes' in body;
    const hasInspirationNotes = 'inspirationNotes' in body;
    const hasAboutMeEn = 'aboutMeEn' in body;
    const hasTags = 'tags' in body;

    const newAboutMe = hasAboutMe ? (aboutMe || '').trim() : (existingProfile?.aboutMe || '');
    const newCasualNotes = hasCasualNotes ? (casualNotes || '').trim() : (existingProfile?.casualNotes || '');
    const newInspirationNotes = hasInspirationNotes ? (inspirationNotes || '').trim() : ((existingProfile as any)?.inspirationNotes || '');

    // 调用 AI 分析内容并生成标签（仅当提供了 aboutMe 或 casualNotes 时）
    let aiAnalysisUsed = false;
    if (hasAboutMe || hasCasualNotes) {
      try {
        console.log('[Profile POST] 调用 AI 分析内容...');
        const result = await analyzeProfileContent(newAboutMe, newCasualNotes);

        // 如果 aboutMe 是中文，使用 AI 翻译结果保存到 aboutMeEn
        if (containsChinese(newAboutMe) && result.translation) {
          aboutMeEn = result.translation;
        }

        tags = result.tags;
        aiAnalysisUsed = true;
        console.log('[Profile POST] AI 分析完成，生成标签:', tags);
      } catch (aiError) {
        console.error('[Profile POST] AI 分析失败:', aiError);
        // AI 失败不影响保存，保留原有标签
        if (existingProfile) {
          tags = JSON.parse(existingProfile.tags || '[]');
        } else {
          tags = [];
        }
      }
    }

    // 构建 update 数据（只包含明确提供的字段）
    const updateData: any = {};
    if (hasAboutMe) updateData.aboutMe = newAboutMe;
    if (hasCasualNotes) updateData.casualNotes = newCasualNotes;
    if (hasInspirationNotes) updateData.inspirationNotes = newInspirationNotes;
    if (hasAboutMeEn && aboutMeEn !== undefined) updateData.aboutMeEn = aboutMeEn;
    if (aiAnalysisUsed) updateData.tags = JSON.stringify(tags);

    // Upsert 操作 - 存在则更新，不存在则创建
    const profile = await prisma.userProfile.upsert({
      where: { userId: userId },
      update: updateData,
      create: {
        userId: userId,
        aboutMe: newAboutMe,
        aboutMeEn: aboutMeEn || '',
        casualNotes: newCasualNotes,
        inspirationNotes: newInspirationNotes || '',
        tags: JSON.stringify(tags || []),
      },
    });

    return NextResponse.json({
      success: true,
      message: aiAnalysisUsed ? '保存成功，AI已重新生成标签' : '保存成功',
      aiAnalysisUsed,
      profile: {
        aboutMe: profile.aboutMe,
        aboutMeEn: profile.aboutMeEn,
        casualNotes: profile.casualNotes,
        inspirationNotes: (profile as any).inspirationNotes || '',
        tags: JSON.parse(profile.tags || '[]'),
        createdAt: profile.createdAt.toISOString(),
        updatedAt: profile.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    console.error('[Profile POST] 保存个人要素失败:', error);
    return NextResponse.json(
      { error: '保存个人要素失败' },
      { status: 500 }
    );
  }
}
