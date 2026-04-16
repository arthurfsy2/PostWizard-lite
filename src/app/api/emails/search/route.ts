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
 * POST /api/emails/search
 * 搜索 Postcrossing 邮件（Pro 专属功能）
 * 
 * 权限要求：Pro 用户
 * 
 * Request body:
 * - configId: 邮箱配置 ID（必填）
 * - folder: 邮箱文件夹（可选，默认 INBOX）
 * - limit: 限制数量（可选，默认 50）
 * - searchQuery: 搜索关键词（可选，默认 Postcrossing）
 * - since: 开始日期（可选，ISO 8601 格式）
 * - before: 结束日期（可选，ISO 8601 格式）
 * - unreadOnly: 只搜索未读邮件（可选，默认 false）
 * - postcardId: 指定明信片 ID（可选）
 * 
 * Response:
 * - 200: 成功，返回邮件列表
 * - 401: 未登录
 * - 403: 非 Pro 用户
 * - 404: 邮箱配置不存在
 * - 504: 网络超时
 */
export async function POST(request: NextRequest) {
  try {
    // 1. 验证用户登录状态
    const userId = getLocalUserId();

    // 2. 解析请求参数
    const body = await request.json();
    const {
      configId,
      folder = 'INBOX',
      limit = 50,
      searchQuery = 'Postcrossing',
      since,
      before,
      unreadOnly = false,
      postcardId,
    } = body;

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

    // 5. 解析日期参数
    const sinceDate = since ? new Date(since) : undefined;
    const beforeDate = before ? new Date(before) : undefined;

    // 6. 搜索邮件（带超时处理）
    let emails;
    try {
      emails = await emailService.searchPostcrossingEmails(configId, {
        folder,
        limit,
        searchQuery,
        since: sinceDate,
        before: beforeDate,
        unreadOnly,
        postcardId,
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

      // 文件夹不存在
      if (error.message?.includes('不存在') || 
          error.message?.includes('not found') ||
          error.message?.includes('does not exist')) {
        return NextResponse.json(
          {
            success: false,
            error: `邮箱文件夹 "${folder}" 不存在`,
            errorCode: 'FOLDER_NOT_FOUND',
          },
          { status: 404 },
        );
      }

      // 其他错误
      throw error;
    }

    // 7. 保存到数据库（使用 upsert 避免唯一性约束冲突）
    const savedEmails = [];
    for (const email of emails) {
      try {
        // 验证必需字段
        if (!email.messageId) {
          // console.log('[Email Save] 跳过：缺少 messageId');
          continue;
        }
        
        // 使用 upsert：存在则更新，不存在则创建
        const saved = await prisma.email.upsert({
          where: {
            // 使用唯一约束的字段组合
            userId_messageId: {
              userId: userId,
              messageId: email.messageId,
            },
          },
          update: {
            subject: email.subject || '(无主题)',
            from: email.from || '',
            to: email.to || '',
            receivedAt: email.date instanceof Date ? email.date : new Date(email.date || Date.now()),
            content: email.bodyText || email.bodyHtml?.substring(0, 500) || '',
            htmlContent: email.bodyHtml || null,
            metadata: JSON.stringify({
              emailConfigId: configId,
              uid: email.uid,
              postcardId: extractPostcardId(email.subject),
            }),
          },
          create: {
            userId: userId,
            messageId: email.messageId,
            subject: email.subject || '(无主题)',
            from: email.from || '',
            to: email.to || '',
            receivedAt: email.date instanceof Date ? email.date : new Date(email.date || Date.now()),
            content: email.bodyText || email.bodyHtml?.substring(0, 500) || '',
            htmlContent: email.bodyHtml || null,
            metadata: JSON.stringify({
              emailConfigId: configId,
              uid: email.uid,
              postcardId: extractPostcardId(email.subject),
            }),
          },
        });
        savedEmails.push(saved);
      } catch (error: any) {
        // console.error(`[Email Save] 保存失败: ${email.messageId}`, error.message);
      }
    }

    // 构建返回结果 - 使用从主题提取的 postcardId（确保一致性）
    const emailIdMap = new Map();
    const emailPostcardIdMap = new Map();
    for (const saved of savedEmails) {
      emailIdMap.set(saved.messageId, saved.id); // messageId -> cuid
      // 解析 metadata 获取从主题提取的 postcardId
      try {
        const metadata = saved.metadata ? JSON.parse(saved.metadata) : {};
        if (metadata.postcardId) {
          emailPostcardIdMap.set(saved.messageId, metadata.postcardId);
        }
      } catch (e) {
        // 解析失败，忽略
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        count: emails.length,
        // 转换为前端期望的字段格式，使用数据库 cuid
        emails: emails.map((email) => {
          // 优先使用数据库保存后的 cuid，否则回退到 messageId
          const dbId = emailIdMap.get(email.messageId);
          // 优先使用从数据库 metadata 中的 postcardId（从主题提取）
          const subjectPostcardId = emailPostcardIdMap.get(email.messageId);
          // 如果从 metadata 获取失败，则从当前主题提取
          const finalPostcardId = subjectPostcardId || extractPostcardId(email.subject || '');
          const previewSource = email.bodyText || email.bodyHtml || '';
          const bodyPreview = buildEmailPreview(previewSource);

          return {
            id: dbId || email.messageId || email.uid, // ✅ 使用数据库 cuid
            uid: email.uid,
            messageId: email.messageId,
            subject: email.subject,
            from: email.from,
            to: email.to,
            date: email.date instanceof Date ? email.date.toISOString() : email.date,
            bodyPreview,
            // ✅ 使用从主题提取的 postcardId（与 parse API 一致）
            postcardId: finalPostcardId,
            recipientName: email.recipientName,
            recipientCountry: email.recipientCountry,
            recipientCity: email.recipientCity,
            recipientAddress: email.recipientAddress,
            recipientAge: email.recipientAge,
            recipientGender: email.recipientGender,
            recipientInterests: email.recipientInterests,
          };
        }),
      },
      message: `成功获取 ${emails.length} 封邮件`,
    });
  } catch (error: any) {
    // console.error('搜索邮件失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || '搜索邮件失败',
        errorCode: 'INTERNAL_ERROR',
      },
      { status: 500 },
    );
  }
}

/**
 * 从邮件主题提取 Postcard ID
 */
function extractPostcardId(subject: string): string | null {
  // 匹配 CN-1234567 格式
  const match = subject.match(/(CN-\d{7})/i);
  return match ? match[1] : null;
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

