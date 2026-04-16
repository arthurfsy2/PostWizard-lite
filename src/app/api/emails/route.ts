import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getLocalUserId } from '@/lib/local-user';
import { emailService } from '@/lib/services/emailService';
/**
 * 检查用户是否为 Pro 用户
 */
async function checkProUser(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { plan: true, planExpiresAt: true },
  });

  if (!user) return false;

  // 只要不是 free 且在有效期内，就是 Pro 用户（包含 weekly/monthly/yearly）
  if (user.plan === 'free') return false;
  if (user.planExpiresAt === null) return true;
  return user.planExpiresAt > new Date();
}

/**
 * GET /api/emails
 * 搜索 Postcrossing 邮件（Pro 专属功能）
 * 
 * 权限要求：Pro 用户
 * 
 * Query parameters:
 * - configId: 邮箱配置 ID（必填）
 * - limit: 限制数量（可选，默认 10）
 * - unreadOnly: 仅未读邮件（可选，默认 false）
 * - postcardId: 明信片 ID 过滤（可选）
 * 
 * Response:
 * - 200: 成功，返回邮件列表
 * - 401: 未登录
 * - 403: 非 Pro 用户
 * - 404: 邮箱配置不存在
 * - 504: 网络超时
 */
export async function GET(request: NextRequest) {
  try {
    // 1. 验证用户登录状态
    const userId = getLocalUserId();

    // 2. 解析请求参数
    const searchParams = request.nextUrl.searchParams;
    const configId = searchParams.get('configId');
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 10;
    const unreadOnly = searchParams.get('unreadOnly') === 'true';
    const postcardId = searchParams.get('postcardId');

    if (!configId) {
      return NextResponse.json(
        {
          success: false,
          error: '缺少必填参数：configId',
          errorCode: 'MISSING_CONFIG_ID',
        },
        { status: 400 }
      );
    }

    // 4. 验证邮箱配置存在且属于当前用户
    const emailConfig = await prisma.emailConfig.findFirst({
      where: {
        id: configId,
        userId: userId,
      },
    });

    if (!emailConfig) {
      return NextResponse.json(
        {
          success: false,
          error: '邮箱配置不存在或无权访问',
          errorCode: 'CONFIG_NOT_FOUND',
        },
        { status: 404 }
      );
    }

    // 5. 搜索邮件（带错误处理）
    let emails;
    try {
      emails = await emailService.searchPostcrossingEmails(configId, {
        limit,
        unreadOnly,
        postcardId: postcardId || undefined,
      });
    } catch (error: any) {
      // 网络超时
      if (error.message?.includes('超时') || error.message?.includes('timeout')) {
        return NextResponse.json(
          {
            success: false,
            error: '连接邮箱服务器超时，请稍后重试',
            errorCode: 'TIMEOUT',
            details: error.message,
          },
          { status: 504 },
        );
      }

      // 认证失败
      if (error.message?.includes('认证') || 
          error.message?.includes('Invalid credentials') ||
          error.message?.includes('login failed')) {
        return NextResponse.json(
          {
            success: false,
            error: '邮箱认证失败，请检查邮箱配置',
            errorCode: 'AUTH_FAILED',
            details: error.message,
          },
          { status: 401 },
        );
      }

      // 其他错误
      throw error;
    }

    return NextResponse.json({
      success: true,
      emails,
    });
  } catch (error) {
    // console.error('Error searching emails:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: '搜索邮件失败',
        errorCode: 'INTERNAL_ERROR',
      },
      { status: 500 }
    );
  }
}
