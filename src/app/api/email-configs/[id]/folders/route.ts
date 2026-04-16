import { NextRequest, NextResponse } from 'next/server';
import { emailService } from '@/lib/services/emailService';

/**
 * GET /api/email-configs/[id]/folders
 * 获取邮箱配置对应的 IMAP 文件夹列表
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // 获取文件夹列表
    const folders = await emailService.listFolders(id);

    return NextResponse.json({
      success: true,
      folders,
    });
  } catch (error: any) {
    // 处理特定错误
    if (error.message?.includes('认证失败') || error.message?.includes('AUTHENTICATIONFAILED')) {
      return NextResponse.json(
        {
          error: '邮箱认证失败，请检查用户名和密码/授权码',
          errorCode: 'AUTH_FAILED',
        },
        { status: 401 }
      );
    }

    if (error.message?.includes('连接') || error.message?.includes('ECONNREFUSED')) {
      return NextResponse.json(
        {
          error: '无法连接到邮箱服务器，请检查 IMAP 设置',
          errorCode: 'CONNECTION_FAILED',
        },
        { status: 503 }
      );
    }

    return NextResponse.json(
      { error: error.message || '获取文件夹列表失败' },
      { status: 500 }
    );
  }
}
