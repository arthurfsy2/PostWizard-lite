import { NextRequest, NextResponse } from 'next/server';
import { emailService } from '@/lib/services/emailService';
import { prisma } from '@/lib/prisma';
import { getLocalUserId } from '@/lib/local-user';

/**
 * GET /api/email-configs
 * 获取所有邮箱配置
 */
export async function GET() {
  try {
    const userId = getLocalUserId();
    const configs = await emailService.getAllConfigs(userId);
    return NextResponse.json({ configs });
  } catch (error) {
    return NextResponse.json(
      { error: '获取邮箱配置失败' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/email-configs
 * 创建新的邮箱配置
 *
 * 单邮箱限制：如果已有配置，先删除（支持换绑邮箱）
 */
export async function POST(request: NextRequest) {
  try {
    const userId = getLocalUserId();
    const body = await request.json();

    // 验证必填字段
    const requiredFields = ['name', 'email', 'imapHost', 'imapPort', 'imapUsername', 'imapPassword'];
    for (const field of requiredFields) {
      if (!body[field]) {
        return NextResponse.json(
          { error: `缺少必填字段：${field}` },
          { status: 400 }
        );
      }
    }

    // 单邮箱限制：如果已有配置，先删除（支持换绑邮箱）
    const existingConfig = await prisma.emailConfig.findFirst({
      where: { userId },
    });

    if (existingConfig) {
      await prisma.emailConfig.delete({
        where: { id: existingConfig.id },
      });
    }

    const config = await emailService.addConfig({
      ...body,
      userId,
    });

    return NextResponse.json({ success: true, config }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || '创建邮箱配置失败' },
      { status: 500 }
    );
  }
}
