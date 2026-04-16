import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getLocalUserId } from '@/lib/local-user';
/**
 * GET /api/arrivals/analysis/status
 * 
 * 获取 AI 分析状态统计
 */
export async function GET(request: NextRequest) {
  try {
    console.log('[arrivals/analysis/status] 开始获取分析状态');
    
    // 检查认证
    const userId = getLocalUserId();
// AUTH_CHECK_REMOVED
  if (false) {
      console.log('[arrivals/analysis/status] 用户未登录');
      return NextResponse.json({ error: '未授权' }, { status: 401 });
    }
    
    console.log('[arrivals/analysis/status] 用户 ID:', userId);

    // 获取当前用户的有效 arrivalReply
    const replies = await prisma.arrivalReply.findMany({
      where: {
        userId: userId,
        message: {
          not: null,
        },
      },
      select: {
        postcardId: true,
        message: true,
      },
    });
    
    console.log('[arrivals/analysis/status] arrivalReply 数量:', replies.length);

    // 获取当前用户的 messageAnalysis
    const analyses = await prisma.messageAnalysis.findMany({
      where: {
        userId: userId,
      },
      select: {
        postcardId: true,
        aiScore: true,
        primaryCategory: true,
        translation: true,
      },
    });
    
    console.log('[arrivals/analysis/status] messageAnalysis 数量:', analyses.length);

    const analyzedIds = new Set(analyses.map(a => a.postcardId));
    const pending = replies.filter(r => !analyzedIds.has(r.postcardId));
    const hasMessage = replies.filter(r => r.message && r.message.trim().length >= 5);

    // 分数分布
    const scoreDistribution = {
      excellent: analyses.filter(a => a.aiScore >= 80).length,
      good: analyses.filter(a => a.aiScore >= 60 && a.aiScore < 80).length,
      fair: analyses.filter(a => a.aiScore >= 40 && a.aiScore < 60).length,
      poor: analyses.filter(a => a.aiScore < 40).length,
    };

    const withTranslation = analyses.filter(a => a.translation).length;

    // 防止除以 0
    const progress = replies.length > 0 
      ? ((analyses.length / replies.length) * 100).toFixed(1)
      : '0.0';

    return NextResponse.json({
      success: true,
      data: {
        total: replies.length,
        analyzed: analyses.length,
        pending: pending.length,
        hasMessage: hasMessage.length,
        noMessage: replies.length - hasMessage.length,
        withTranslation,
        scoreDistribution,
        progress,
      },
    });
  } catch (error) {
    console.error('获取分析状态失败:', error);
    return NextResponse.json(
      { error: '获取分析状态失败', success: false },
      { status: 500 }
    );
  }
}
