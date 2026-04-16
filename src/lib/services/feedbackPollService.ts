/**
 * 反馈轮询服务
 * 从反馈邮箱获取新邮件，匹配注册用户，并存储到反馈系统
 * 并可选地将反馈同步创建为 GitHub Issue
 * 自动发放反馈奖励
 */

import { EmailService, EmailConfig } from './emailService';
import { FeedbackService } from './feedbackService';
import { prisma } from '../prisma';
import { getGitHubService, createFeedbackIssue } from './githubService';
import {
  calculateReward,
  grantReward,
  isPremiumUser,
  type RewardCalculationResult,
} from './rewardService';

// ==================== 类型定义 ====================

export interface PollResult {
  success: boolean;
  newEmails: number;
  processed: number;
  githubIssuesCreated: number;
  githubErrors: string[];
  githubConfigured: boolean;
  errors: string[];
  lastPollTime: Date;
}

export interface PollStatus {
  isRunning: boolean;
  lastPollTime: Date | null;
  totalProcessed: number;
  configValid: boolean;
}

// ==================== 轮询服务类 ====================

export class FeedbackPollService {
  private emailService: EmailService;
  private feedbackService: FeedbackService;
  private config: EmailConfig;
  private configId: string | null = null;
  private isRunning: boolean = false;
  private timerId: NodeJS.Timeout | null = null;
  private pollIntervalMs: number = 5 * 60 * 1000; // 默认 5 分钟
  private lastPollTime: Date | null = null;
  private totalProcessed: number = 0;
  private processedMessageIds: Set<string> = new Set();

  constructor() {
    this.emailService = new EmailService();
    this.feedbackService = new FeedbackService();
    this.config = this.loadConfig();
  }

  /**
   * 加载环境变量配置
   */
  private loadConfig(): EmailConfig {
    const imapHost = process.env.FEEDBACK_IMAP_HOST;
    const imapUser = process.env.FEEDBACK_IMAP_USER;
    const imapPass = process.env.FEEDBACK_IMAP_PASS;
    const imapPort = parseInt(process.env.FEEDBACK_IMAP_PORT || '993', 10);
    const pollInterval = parseInt(process.env.FEEDBACK_POLL_INTERVAL || '5', 10);

    if (!imapHost || !imapUser || !imapPass) {
      throw new Error('Missing required FEEDBACK_IMAP_* environment variables');
    }

    this.pollIntervalMs = pollInterval * 60 * 1000;

    return {
      imapHost,
      imapPort,
      imapUsername: imapUser,
      imapPassword: imapPass,
      useTLS: true,
    };
  }

  /**
   * 验证配置是否有效
   */
  async validateConfig(): Promise<boolean> {
    try {
      const stored = await this.emailService.addConfig(this.config);
      this.configId = stored.id;
      const result = await this.emailService.verifyConnection(stored.id);
      return result.success;
    } catch (error) {
      // console.error('[FeedbackPoll] Config validation failed:', error);
      return false;
    }
  }

  /**
   * 启动轮询服务
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      // console.log('[FeedbackPoll] Already running');
      return;
    }

    // 验证配置
    const isValid = await this.validateConfig();
    if (!isValid) {
      throw new Error('Failed to validate IMAP configuration');
    }

    this.isRunning = true;
    // console.log(`[FeedbackPoll] Started with interval ${this.pollIntervalMs / 60000} minutes`);

    // 立即执行一次轮询
    await this.pollOnce();

    // 设置定时器
    this.timerId = setInterval(async () => {
      try {
        await this.pollOnce();
      } catch (error) {
        // console.error('[FeedbackPoll] Poll error:', error);
      }
    }, this.pollIntervalMs);
  }

  /**
   * 停止轮询服务
   */
  stop(): void {
    if (this.timerId) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
    this.isRunning = false;
    // console.log('[FeedbackPoll] Stopped');
  }

  /**
   * 手动触发一次轮询
   */
  async pollOnce(): Promise<PollResult> {
    const result: PollResult = {
      success: false,
      newEmails: 0,
      processed: 0,
      githubIssuesCreated: 0,
      githubErrors: [],
      githubConfigured: false,
      errors: [],
      lastPollTime: new Date(),
    };

    if (!this.configId) {
      const isValid = await this.validateConfig();
      if (!isValid) {
        result.errors.push('Config validation failed');
        return result;
      }
    }

    try {
      // 搜索所有邮件（不仅是未读），避免因调试或已读状态导致遗漏
      const emails = await this.emailService.searchEmails(
        this.configId!,
        {
          unreadOnly: false, // 搜索所有邮件
          limit: 50,
        }
      );

      result.newEmails = emails.length;
      // console.log(`[FeedbackPoll] Found ${emails.length} emails (all, not just unread)`);

      // 遍历处理每封邮件
      for (const email of emails) {
        try {
          // 跳过已处理的邮件
          if (this.processedMessageIds.has(email.messageId)) {
            continue;
          }

          // 检查发件人是否是注册用户
          const user = await this.findUserByEmail(email.from);

          if (user) {
            // 调用 FeedbackService 创建反馈（包含 AI 分析）
            const feedback = await this.feedbackService.createFeedback({
              userId: user.id,
              userEmail: user.email,
              content: email.bodyText,
              subject: email.subject,
              fromEmail: email.from,
              emailMessageId: email.messageId,
            });

            result.processed++;
            this.totalProcessed++;
            // console.log(`[FeedbackPoll] Processed feedback from ${user.email}`);

            // ==================== 奖励发放逻辑 ====================
            try {
              // 获取用户完整信息用于判断是否为付费用户
              const userFull = await prisma.user.findUnique({
                where: { id: user.id },
                select: { plan: true, planExpiresAt: true, bonusQuota: true },
              });

              if (userFull) {
                const isPremium = isPremiumUser(userFull.plan, userFull.planExpiresAt);
                const contentLength = email.bodyText?.trim().length || 0;

                // 计算奖励
                const rewardCalc: RewardCalculationResult = calculateReward({
                  isPremium,
                  aiAnalysis: {
                    category: feedback.category || 'inquiry',
                    priority: feedback.priority || 'P2',
                    sentiment: feedback.sentiment || 'neutral',
                  },
                  contentLength,
                });

                // 发放奖励（幂等性通过 rewardGrantedAt 字段保证）
                const rewardResult = await grantReward({
                  userId: user.id,
                  feedbackId: feedback.id,
                  rewardType: rewardCalc.type,
                  amount: rewardCalc.amount,
                  userCurrentExpiry: userFull.planExpiresAt,
                  userCurrentBonusQuota: userFull.bonusQuota,
                });

                if (rewardResult.success) {
                  // console.log(`[FeedbackPoll] Reward granted: ${rewardCalc.type} x${rewardCalc.amount} for feedback ${feedback.id}`);
                }
              }
            } catch (rewardError) {
              // 奖励发放失败不影响反馈处理流程
              const errMsg = rewardError instanceof Error ? rewardError.message : String(rewardError);
              result.errors.push(`Reward grant failed for ${email.messageId}: ${errMsg}`);
              // console.error('[FeedbackPoll] Failed to grant reward:', rewardError);
            }
            // ==================== 奖励发放结束 ====================

            // 尝试创建 GitHub Issue（失败不影响主流程）
            // 只对未推送过 Issue 的反馈创建
            const githubService = getGitHubService();
            const isGitHubConfigured = githubService.isConfigured();
            result.githubConfigured = isGitHubConfigured;
            
            if (isGitHubConfigured && !feedback.githubIssueUrl) {
              try {
                const issueResult = await createFeedbackIssue({
                  userEmail: user.email,
                  subject: email.subject || '',
                  content: email.bodyText,
                  analysis: {
                    sentiment: (feedback.sentiment || 'neutral') as 'positive' | 'neutral' | 'negative',
                    category: (feedback.category || 'inquiry') as 'bug' | 'suggestion' | 'inquiry' | 'complaint',
                    priority: (feedback.priority || 'P2') as 'P0' | 'P1' | 'P2',
                    rewardSuggestion: feedback.rewardSuggestion || '',
                  },
                  fromEmail: email.from,
                  messageId: email.messageId,
                });
                if (issueResult) {
                  // console.log(`[FeedbackPoll] GitHub Issue created: ${issueResult.url}`);
                  result.githubIssuesCreated++;
                  // 更新反馈状态为已推送 Issue
                  await this.feedbackService.updateIssuePushed(feedback.id, issueResult.url);
                }
              } catch (githubError) {
                // GitHub API 失败不影响反馈存储
                const errMsg = githubError instanceof Error ? githubError.message : String(githubError);
                result.githubErrors.push(errMsg);
                // console.error('[FeedbackPoll] Failed to create GitHub Issue:', githubError);
              }
            } else if (feedback.githubIssueUrl) {
              // console.log(`[FeedbackPoll] Feedback already has GitHub Issue: ${feedback.githubIssueUrl}, skipping...`);
            }
          } else {
            // console.log(`[FeedbackPoll] Skipped non-registered user: ${email.from}`);
          }

          // 标记为已处理
          this.processedMessageIds.add(email.messageId);

          // 可选：将邮件标记为已读
          await this.markEmailAsRead(email.uid);
        } catch (error) {
          const errMsg = error instanceof Error ? error.message : String(error);
          result.errors.push(`Failed to process email ${email.messageId}: ${errMsg}`);
          // console.error(`[FeedbackPoll] Error processing email:`, error);
        }
      }

      result.success = true;
      this.lastPollTime = result.lastPollTime;
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      result.errors.push(`Poll failed: ${errMsg}`);
      // console.error('[FeedbackPoll] Poll failed:', error);
    }

    return result;
  }

  /**
   * 根据邮箱查找注册用户
   */
  private async findUserByEmail(email: string): Promise<{ id: string; email: string } | null> {
    // 提取邮箱地址（去除姓名等）
    const emailAddr = this.extractEmailAddress(email);

    try {
      const user = await prisma.user.findUnique({
        where: { email: emailAddr },
        select: { id: true, email: true },
      });
      return user;
    } catch (error) {
      // console.error('[FeedbackPoll] Error finding user:', error);
      return null;
    }
  }

  /**
   * 提取邮箱地址
   */
  private extractEmailAddress(emailStr: string): string {
    // 处理格式: "Name <email@example.com>" 或 "email@example.com"
    const match = emailStr.match(/<(.+)>/);
    return match ? match[1].trim().toLowerCase() : emailStr.toLowerCase();
  }

  /**
   * 标记邮件为已读
   */
  private async markEmailAsRead(uid: string): Promise<void> {
    // EmailService 的 searchEmails 不会自动标记为已读
    // 如果需要，可以使用 imap.addFlags 标记
    // 这里暂时不做处理，因为轮询服务主要是读取新邮件
  }

  /**
   * 获取轮询状态
   */
  getStatus(): PollStatus {
    return {
      isRunning: this.isRunning,
      lastPollTime: this.lastPollTime,
      totalProcessed: this.totalProcessed,
      configValid: this.configId !== null,
    };
  }

  /**
   * 重置已处理记录（用于调试）
   */
  resetProcessed(): void {
    this.processedMessageIds.clear();
    // console.log('[FeedbackPoll] Processed records cleared');
  }
}

// ==================== 单例实例 ====================

let pollServiceInstance: FeedbackPollService | null = null;

/**
 * 获取轮询服务单例
 */
export function getFeedbackPollService(): FeedbackPollService {
  if (!pollServiceInstance) {
    pollServiceInstance = new FeedbackPollService();
  }
  return pollServiceInstance;
}

/**
 * 启动轮询服务
 */
export async function startFeedbackPoll(): Promise<void> {
  const service = getFeedbackPollService();
  await service.start();
}

/**
 * 停止轮询服务
 */
export function stopFeedbackPoll(): void {
  const service = getFeedbackPollService();
  service.stop();
}

/**
 * 手动触发轮询
 */
export async function triggerFeedbackPoll(): Promise<PollResult> {
  const service = getFeedbackPollService();
  return service.pollOnce();
}

/**
 * 获取轮询状态
 */
export function getFeedbackPollStatus(): PollStatus {
  const service = getFeedbackPollService();
  return service.getStatus();
}
