import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getLocalUserId } from '@/lib/local-user';

/**
 * POST /api/received-cards/[id]/generate
 * 基于指定模板生成分享图片
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: cardId } = await params;
  try {
    const userId = getLocalUserId();

    // 1. 获取收信记录
    const receivedCard = await prisma.receivedCard.findUnique({
      where: { id: cardId },
    });

    if (!receivedCard) {
      return NextResponse.json(
        { error: '收信记录不存在' },
        { status: 404 }
      );
    }

    // 2. 验证所有权
    if (receivedCard.userId !== userId) {
      return NextResponse.json(
        { error: '无权操作此记录' },
        { status: 403 }
      );
    }

    // 3. 解析请求体
    const body = await request.json();
    const { templateId, customizations = {} } = body;

    if (!templateId) {
      return NextResponse.json(
        { error: '缺少必填参数：templateId' },
        { status: 400 }
      );
    }

    // 4. 获取模板信息
    const template = await prisma.cardTemplate.findUnique({
      where: { id: templateId },
    });

    if (!template) {
      return NextResponse.json(
        { error: '模板不存在' },
        { status: 404 }
      );
    }

    if (!template.isActive) {
      return NextResponse.json(
        { error: '此模板已下线' },
        { status: 400 }
      );
    }

    // 5. 检查付费模板权限
    if (template.isPremium) {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { plan: true, planExpiresAt: true },
      });

      const isPremium = user?.plan && user.plan !== 'free' && user.planExpiresAt && new Date(user.planExpiresAt) > new Date();
      
      if (!isPremium) {
        return NextResponse.json(
          {
            error: 'PREMIUM_TEMPLATE_REQUIRED',
            message: '该模板需要付费会员才能使用',
            upgradeUrl: '/donate',
          },
          { status: 403 }
        );
      }
    }

    // 6. 生成分享图（前端生成，此处仅返回模板和数据）
    // TODO: 服务端生成逻辑（Satori 或 html-to-image）
    // MVP 阶段由前端 html-to-image 生成，此处只更新数据库记录
    
    // 返回前端预览页面路径（不是 API 路径）
    const shareImageUrl = `/received-cards/${cardId}/preview?templateId=${templateId}`;

    // 7. 更新收信记录
    const updatedCard = await prisma.receivedCard.update({
      where: { id: cardId },
      data: {
        templateId,
        shareImageUrl,
      },
    });

    return NextResponse.json({
      shareImageUrl,
      width: 1080,
      height: 1080,
      generatedAt: new Date().toISOString(),
      template: {
        id: template.id,
        name: template.name,
        htmlTemplate: template.htmlTemplate,
        cssStyle: template.cssStyle,
      },
      cardData: {
        senderUsername: updatedCard.senderUsername,
        senderCountry: updatedCard.senderCountry,
        senderCity: updatedCard.senderCity,
        handwrittenText: updatedCard.handwrittenText,
        detectedLang: updatedCard.detectedLang,
        receivedAt: updatedCard.receivedAt,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: '生成分享图失败' },
      { status: 500 }
    );
  }
}
