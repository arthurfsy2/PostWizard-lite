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
 * POST /api/emails/test-connection
 * 测试 IMAP 连接（VIP 专属功能）
 * 
 * 权限要求：VIP 用户
 * 
 * Request body:
 * - configId: 邮箱配置 ID（必填）
 * 
 * Response:
 * - 200: 连接成功
 * - 401: 未登录或认证失败
 * - 403: 非 Pro 用户
 * - 404: 邮箱配置不存在
 * - 504: 连接超时
 */
export async function POST(request: NextRequest) {
  try {
    // 1. 验证用户登录状态
    const userId = getLocalUserId();

    // 2. 解析请求参数
    const body = await request.json();
    const { configId } = body;

    if (!configId) {
      return NextResponse.json(
        {
          success: false,
          error: '缺少邮箱配置 ID',
          errorCode: 'MISSING_CONFIG_ID',
        },
        { status: 400 },
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
        { status: 404 },
      );
    }

    // 5. 测试连接（带超时处理）
    try {
      const result = await emailService.verifyConnection(configId);
      
      if (result.success) {
        return NextResponse.json({
          success: true,
          message: 'IMAP 连接成功',
          data: {
            configId,
            email: emailConfig.email,
            imapHost: emailConfig.imapHost,
            imapPort: emailConfig.imapPort,
          },
        });
      } else {
        // 认证失败
        return NextResponse.json(
          {
            success: false,
            error: result.error || '邮箱认证失败',
            errorCode: 'AUTH_FAILED',
            message: '请检查邮箱地址、密码和 IMAP 服务器配置',
          },
          { status: 401 },
        );
      }
    } catch (error: any) {
      // 网络超时
      if (error.message?.includes('超时') || error.message?.includes('timeout')) {
        return NextResponse.json(
          {
            success: false,
            error: '连接邮箱服务器超时',
            errorCode: 'TIMEOUT',
            details: error.message,
            message: '请检查网络连接或稍后重试',
          },
          { status: 504 },
        );
      }

      // 认证失败
      if (error.message?.includes('Invalid credentials') ||
          error.message?.includes('login failed') ||
          error.message?.includes('authentication failed')) {
        return NextResponse.json(
          {
            success: false,
            error: '邮箱认证失败',
            errorCode: 'AUTH_FAILED',
            details: error.message,
            message: '请检查邮箱地址和密码是否正确',
          },
          { status: 401 },
        );
      }

      // 连接失败
      if (error.message?.includes('connect') || 
          error.message?.includes('ECONNREFUSED') ||
          error.message?.includes('ENOTFOUND')) {
        return NextResponse.json(
          {
            success: false,
            error: '无法连接到邮箱服务器',
            errorCode: 'CONNECTION_FAILED',
            details: error.message,
            message: '请检查 IMAP 服务器地址和端口是否正确',
          },
          { status: 504 },
        );
      }

      // 其他错误
      throw error;
    }
  } catch (error: any) {
    // console.error('测试 IMAP 连接失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || '测试连接失败',
        errorCode: 'INTERNAL_ERROR',
      },
      { status: 500 },
    );
  }
}
