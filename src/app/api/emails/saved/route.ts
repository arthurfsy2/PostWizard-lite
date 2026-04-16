import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getLocalUserId } from '@/lib/local-user';
import { sanitizeRecipientInput } from '@/lib/sanitize-recipient-input';


/**
 * GET /api/emails/saved
 * 获取用户已保存的邮件列表（从数据库）
 * 
 * Query params:
 * - limit: 限制数量（默认 100）
 * - offset: 偏移量（默认 0）
 * 
 * Response:
 * - 200: 成功，返回邮件列表
 * - 401: 未登录
 * - 500: 服务器错误
 */
export async function GET(request: NextRequest) {
  try {
    // 1. 验证用户登录状态
    const userId = getLocalUserId();

    // 2. 解析查询参数
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '100', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    // 3. 从数据库查询已保存的邮件
    const emails = await prisma.email.findMany({
      where: {
        userId: userId,
      },
      orderBy: {
        receivedAt: 'desc',
      },
      take: limit,
      skip: offset,
    });

    // 4. 获取总数
    const total = await prisma.email.count({
      where: {
        userId: userId,
      },
    });

    // 5. 转换为前端期望的格式
    const formattedEmails = emails.map((email) => {
      // 解析 metadata
      let metadata: any = {};
      try {
        metadata = email.metadata ? JSON.parse(email.metadata) : {};
      } catch (e) {
        metadata = {};
      }

      const sanitizedPreviewSource = sanitizeRecipientInput(email.content || email.htmlContent || '').sanitizedText;
      const bodyPreview = buildEmailPreview(sanitizedPreviewSource);


      return {
        id: email.id,  // 使用数据库的 cuid，用于后续 API 调用
        uid: metadata.uid || email.id,
        messageId: email.messageId,
        subject: email.subject,
        from: email.from,
        to: email.to,
        date: email.receivedAt.toISOString(),
        bodyPreview,
        postcardId: metadata.postcardId || null,
      };
    });

    return NextResponse.json({
      success: true,
      data: {
        count: formattedEmails.length,
        total,
        emails: formattedEmails,
      },
      message: `成功获取 ${formattedEmails.length} 封邮件`,
    });
  } catch (error: any) {
    console.error('[Saved Emails API] 错误:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || '获取邮件列表失败',
        errorCode: 'INTERNAL_ERROR',
      },
      { status: 500 },
    );
  }
}

function buildEmailPreview(content: string, maxLength: number = 120) {

  const plainText = content
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!plainText) return '';
  return plainText.length > maxLength
    ? `${plainText.slice(0, maxLength)}...`
    : plainText;
}

