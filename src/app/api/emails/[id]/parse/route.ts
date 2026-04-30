/**
 * 邮箱关联 - 解析 IMAP 邮件 API
 * 
 * POST /api/emails/[id]/parse
 * 解析已获取的 IMAP 邮件，提取 Postcrossing 收件人信息
 * 
 * 这是 Step 1 的第三种来源（邮箱关联）
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getLocalUserId } from '@/lib/local-user';
import { parseIMAPEmail } from '@/lib/services/aiParserService';
import { sanitizeRecipientInput } from '@/lib/sanitize-recipient-input';
import { saveOrUpdatePostcard, buildResponseData } from '@/lib/helpers/duplicateChecker';
/**
 * POST /api/emails/[id]/parse
 * 解析单封邮件
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // 1. 验证用户登录
    const userId = getLocalUserId();

    // 解析 params（Next.js 14+ params 是 Promise）
    const { id: emailId } = await params;

    // 调试日志
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`[Email Parse] ✅ 正确解析 emailId: "${emailId}"`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    // 开源版：跳过额度检查

    // 2. 获取邮件（确保属于当前用户）
    console.log(`[Email Parse] 查询邮件 ID: ${emailId}`);
    const email = await prisma.email.findFirst({
      where: {
        id: emailId,
        userId: userId,
      },
    });
    
    if (email) {
      console.log(`[Email Parse] 数据库查询结果 - ID: ${email.id}, Subject: ${email.subject}`);
    } else {
      console.log(`[Email Parse] 未找到邮件: ${emailId}`);
    }

    if (!email) {
      return NextResponse.json(
        {
          success: false,
          error: '邮件不存在或无权访问',
          code: 'NOT_FOUND',
        },
        { status: 404 }
      );
    }

    // 4. 使用 AI 解析邮件内容
    console.log(`[Email Parse] 开始解析邮件 ${email.id}`);
    console.log(`[Email Parse] 邮件主题：${email.subject}`);
    console.log(`[Email Parse] 内容长度：${email.content?.length || 0}`);

    // 从邮件主题提取 postcardId（优先使用主题中的ID）
    const subjectPostcardId = extractPostcardIdFromSubject(email.subject);
    console.log(`[Email Parse] 从主题提取的 postcardId: ${subjectPostcardId}`);

    const rawEmailContent = email.content || email.htmlContent || '';
    const sanitization = sanitizeRecipientInput(rawEmailContent);

    console.log(`[Email Parse] 原始内容长度：${sanitization.originalLength}`);
    console.log(`[Email Parse] 脱敏后长度：${sanitization.sanitizedLength}`);
    console.log(`[Email Parse] 脱敏标记：${sanitization.removedFlags.join(', ') || 'none'}`);
    console.log(`[Email Parse] 风险等级：${sanitization.riskLevel}`);

    let parsedInfo = await parseIMAPEmail(
      sanitization.sanitizedText,
      {
        subject: email.subject || undefined,
        from: email.from || undefined,
        postcardId: subjectPostcardId || undefined, // 传入主题中的ID作为参考
      }
    );

    // 强制使用主题中的 postcardId（如果提取成功）
    if (subjectPostcardId) {
      console.log(`[Email Parse] 强制使用主题中的 postcardId: ${subjectPostcardId} (替换 AI 提取的: ${parsedInfo.postcardId})`);
      parsedInfo.postcardId = subjectPostcardId;
    }
    
    console.log(`[Email Parse] AI 解析结果:`, parsedInfo);

    // 5. 验证必需字段
    if (!parsedInfo.postcardId) {
      return NextResponse.json(
        {
          success: false,
          error: '无法从邮件中提取明信片 ID',
          code: 'PARSE_FAILED',
          details: '请确保邮件包含类似 "CN-1234567" 格式的 ID',
        },
        { status: 400 }
      );
    }

    // 6. 使用统一的重复检测和保存逻辑
    const saveResult = await saveOrUpdatePostcard(
      userId,
      parsedInfo.postcardId,
      parsedInfo
    );

    // 7. 构建统一的返回结果
    const responseData = buildResponseData(
      saveResult.postcard,
      saveResult.isDuplicate,
      saveResult.duplicateInfo,
      parsedInfo,
      saveResult.sanitizedAddress
    );


    // 9. 保存到 sessionStorage（供前端 Step 2/3 使用）
    // 注意：这里不能直接操作 sessionStorage，需要前端保存
    // 前端会在收到响应后自行保存到 sessionStorage

    return NextResponse.json({
      ...responseData,
      source: 'imap_email',
    });
  } catch (error) {
    console.error('[Email Parse] API 错误:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '解析失败',
        code: 'INTERNAL_ERROR',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/emails/[id]/parse
 * 获取邮件解析状态
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = getLocalUserId();

    const { id: emailId } = await params;

    // 获取邮件及解析结果
    const email = await prisma.email.findFirst({
      where: { id: emailId, userId: userId },
      include: {
        recipient: true,
      },
    });

    if (!email) {
      return NextResponse.json(
        { error: '邮件不存在或无权访问' },
        { status: 404 }
      );
    }

    if (email.recipient) {
      // 已解析
      return NextResponse.json({
        status: 'parsed',
        data: {
          id: email.recipient.id,
          name: email.recipient.name,
          postcardId: email.recipient.postcardId,
          parsedAt: email.recipient.createdAt,
        },
      });
    } else {
      // 未解析
      return NextResponse.json({
        status: 'pending',
        data: {
          emailId: email.id,
          subject: email.subject,
          from: email.from,
          receivedAt: email.receivedAt,
        },
      });
    }

  } catch (error) {
    console.error('[Email Parse Status] 错误:', error);
    return NextResponse.json(
      { error: '获取状态失败' },
      { status: 500 }
    );
  }
}

/**
 * 从邮件主题中提取 Postcard ID
 * 匹配格式：XX-1234567 (2位国家代码 + 6-8位数字)
 */
function extractPostcardIdFromSubject(subject: string): string | null {
  if (!subject) return null;
  // 支持多种格式：CN-1234567, US-123456, DE-12345678 等
  const patterns = [
    /([A-Z]{2}-\d{6,8})/i,                    // CN-1234567
    /postcard[:\s]*([A-Z]{2}-\d{6,8})/i,      // Postcard: CN-1234567
    /ID[:\s]*([A-Z]{2}-\d{6,8})/i,            // ID: CN-1234567
  ];
  
  for (const pattern of patterns) {
    const match = subject.match(pattern);
    if (match) return match[1].toUpperCase();
  }
  
  return null;
}
