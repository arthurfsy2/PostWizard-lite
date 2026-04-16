/**
 * 邮件通知服务
 * 封装各种场景的邮件发送功能
 */

import { transporter, smtpFrom, getFeedbackThankYouEmailHtml, getFeedbackThankYouEmailText } from '../email';

/**
 * 发送反馈感谢邮件
 * @param options 邮件参数
 * @returns 发送结果
 */
export async function sendFeedbackThankYouEmail(options: {
  email: string;
  aiAnalysis: {
    sentiment: string;
    category: string;
    priority: string;
    rewardSuggestion: string;
  };
  reward: {
    type: 'quota' | 'days';
    amount: number;
    newTotal?: number;
    newExpiryDate?: string;
    previousTotal?: number;
    previousExpiryDate?: string;
  };
}): Promise<{ success: boolean; error?: string }> {
  try {
    const { email, aiAnalysis, reward } = options;

    // 验证邮箱地址
    if (!email || !email.includes('@')) {
      return { success: false, error: 'Invalid email address' };
    }

    // 生成邮件内容
    const htmlContent = getFeedbackThankYouEmailHtml({
      userEmail: email,
      aiAnalysis,
      reward,
    });
    const textContent = getFeedbackThankYouEmailText({
      userEmail: email,
      aiAnalysis,
      reward,
    });

    // 发送邮件
    const result = await transporter.sendMail({
      from: smtpFrom,
      to: email,
      subject: '【PostWizard】感谢您的反馈，奖励已发放 🎉',
      html: htmlContent,
      text: textContent,
    });

    // console.log(`[EmailNotification] Feedback thank you email sent: ${email}, messageId: ${result.messageId}`);
    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    // console.error('[EmailNotification] Failed to send feedback thank you email:', errorMessage);
    return { success: false, error: errorMessage };
  }
}

/**
 * 异步发送反馈感谢邮件（不阻塞主流程）
 * @param options 邮件参数
 */
export function sendFeedbackThankYouEmailAsync(options: {
  email: string;
  aiAnalysis: {
    sentiment: string;
    category: string;
    priority: string;
    rewardSuggestion: string;
  };
  reward: {
    type: 'quota' | 'days';
    amount: number;
    newTotal?: number;
    newExpiryDate?: string;
    previousTotal?: number;
    previousExpiryDate?: string;
  };
}): void {
  // 使用 setImmediate 确保异步执行，不阻塞当前流程
  setImmediate(async () => {
    try {
      const result = await sendFeedbackThankYouEmail(options);
      if (!result.success) {
        // 发送失败只记录日志，不抛出异常
        // console.warn('[EmailNotification] Async feedback email failed:', result.error);
      }
    } catch (error) {
      // 捕获任何异常，确保不影响主流程
      // console.error('[EmailNotification] Unexpected error in async email:', error);
    }
  });
}

/**
 * 批量发送反馈感谢邮件（用于邮件轮询处理）
 * @param items 邮件列表
 * @returns 批量发送结果
 */
export async function sendBatchFeedbackThankYouEmails(
  items: Array<{
    email: string;
    aiAnalysis: {
      sentiment: string;
      category: string;
      priority: string;
      rewardSuggestion: string;
    };
    reward: {
      type: 'quota' | 'days';
      amount: number;
      newTotal?: number;
      newExpiryDate?: string;
    };
  }>
): Promise<{
  total: number;
  success: number;
  failed: number;
  errors: string[];
}> {
  const results = {
    total: items.length,
    success: 0,
    failed: 0,
    errors: [] as string[],
  };

  // 串行发送，避免并发过多导致 SMTP 限制
  for (const item of items) {
    try {
      const result = await sendFeedbackThankYouEmail(item);
      if (result.success) {
        results.success++;
      } else {
        results.failed++;
        results.errors.push(`${item.email}: ${result.error}`);
      }
      // 添加小延迟，避免触发 SMTP 频率限制
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (error) {
      results.failed++;
      const errorMessage = error instanceof Error ? error.message : String(error);
      results.errors.push(`${item.email}: ${errorMessage}`);
    }
  }

  return results;
}
