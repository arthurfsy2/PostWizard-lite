import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getLocalUserId } from '@/lib/local-user';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/email-configs/:id
 * 获取单个邮箱配置
 */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const config = await prisma.emailConfig.findUnique({
      where: { id },
    });

    if (!config) {
      return NextResponse.json(
        { success: false, error: '配置不存在' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: config });
  } catch (error) {
    return NextResponse.json(
      { error: '获取邮箱配置失败' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/email-configs/:id
 * 更新邮箱配置
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = await request.json();

    // 获取现有配置以保留 provider 值
    const existingConfig = await prisma.emailConfig.findUnique({
      where: { id },
      select: { provider: true },
    });

    const config = await prisma.emailConfig.update({
      where: { id },
      data: {
        email: body.email,
        imapHost: body.imapHost,
        imapPort: body.imapPort,
        imapUser: body.imapUsername || body.imapUser,
        imapPass: body.imapPassword || body.imapPass,
        folderPath: body.folderPath || null,
        isActive: body.isActive ?? true,
        provider: body.provider || existingConfig?.provider || 'imap',
      },
    });

    return NextResponse.json({ success: true, data: config });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { success: false, error: '更新邮箱配置失败', message: errorMessage },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/email-configs/:id
 * 删除邮箱配置
 */
export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const deleted = await prisma.emailConfig.delete({
      where: { id },
    });

    if (!deleted) {
      return NextResponse.json(
        { success: false, error: '配置不存在' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, message: '删除成功' });
  } catch (error) {
    return NextResponse.json(
      { error: '删除邮箱配置失败' },
      { status: 500 }
    );
  }
}
