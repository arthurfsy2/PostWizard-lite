import { NextRequest, NextResponse } from 'next/server';
import { emailService, EMAIL_PROVIDERS } from '@/lib/services/emailService';

/**
 * POST /api/email-configs/[id]/test
 * 测试已保存的 IMAP 配置连接
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // 获取邮箱配置
    const emailConfig = await emailService.getConfig(id);

    if (!emailConfig) {
      return NextResponse.json(
        {
          success: false,
          error: '邮箱配置不存在',
          errorCode: 'CONFIG_NOT_FOUND',
        },
        { status: 404 },
      );
    }

    // 测试连接
    const result = await emailService.testImapConnection({
      imapHost: emailConfig.imapHost,
      imapPort: emailConfig.imapPort,
      imapUsername: emailConfig.imapUsername,
      imapPassword: emailConfig.imapPassword,
      useTLS: emailConfig.useTLS ?? true,
      rejectUnauthorized: emailConfig.rejectUnauthorized ?? true,
    });

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.error,
          errorCode: result.errorCode,
          details: result.details,
          provider: result.provider,
          providerInfo: result.provider ? EMAIL_PROVIDERS[result.provider as keyof typeof EMAIL_PROVIDERS] : null,
        },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      message: '连接成功',
      provider: result.provider,
      providerInfo: result.provider ? EMAIL_PROVIDERS[result.provider as keyof typeof EMAIL_PROVIDERS] : null,
      details: result.details,
    });
  } catch (error: any) {
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
