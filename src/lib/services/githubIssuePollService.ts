/**
 * GitHub Issue 轮询服务
 * 定期获取 user-feedback 标签的 Issue，触发 AI 分析并回传
 */

import { prisma } from "../prisma";
import { getGitHubService, postFixReport, updateIssueStatus, getIssueComments } from "./githubService";
import { analyzeIssue } from "./workbuddyAnalysisService";

// ==================== 类型定义 ====================

export interface PollResult {
  success: boolean;
  issuesChecked: number;
  issuesAnalyzed: number;
  errors: string[];
  lastPollTime: Date;
}

export interface GitHubIssueInfo {
  number: number;
  title: string;
  body: string;
  labels: string[];
  state: string;
  created_at: string;
}

// ==================== 轮询服务类 ====================

export class GitHubIssuePollService {
  private isRunning: boolean = false;
  private timerId: NodeJS.Timeout | null = null;
  private pollIntervalMs: number = 10 * 60 * 1000; // 默认 10 分钟
  private lastPollTime: Date | null = null;
  private totalAnalyzed: number = 0;

  constructor() {
    // 从环境变量读取轮询间隔
    const interval = parseInt(process.env.GITHUB_POLL_INTERVAL || '10', 10);
    this.pollIntervalMs = interval * 60 * 1000;
  }

  /**
   * 获取配置
   */
  private getGitHubServiceInstance() {
    const service = getGitHubService();
    if (!service.isConfigured()) {
      throw new Error('GitHub service not configured');
    }
    return service;
  }

  /**
   * 启动轮询服务
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      // console.log('[GitHubIssuePoll] Already running');
      return;
    }

    this.isRunning = true;
    // console.log(`[GitHubIssuePoll] Started with interval ${this.pollIntervalMs / 60000} minutes`);

    // 立即执行一次轮询
    await this.pollOnce();

    // 设置定时器
    this.timerId = setInterval(async () => {
      try {
        await this.pollOnce();
      } catch (error) {
        // console.error('[GitHubIssuePoll] Poll error:', error);
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
    // console.log('[GitHubIssuePoll] Stopped');
  }

  /**
   * 手动触发一次轮询
   */
  async pollOnce(): Promise<PollResult> {
    const result: PollResult = {
      success: false,
      issuesChecked: 0,
      issuesAnalyzed: 0,
      errors: [],
      lastPollTime: new Date(),
    };

    try {
      const githubService = this.getGitHubServiceInstance();

      // 1. 获取所有 open 状态的 Issue
      const issues = await this.getOpenIssues(githubService);
      result.issuesChecked = issues.length;
      // console.log(`[GitHubIssuePoll] Found ${issues.length} open issues`);

      // 2. 遍历检查每个 Issue
      for (const issue of issues) {
        try {
          // 查找对应的 feedback 记录
          const feedback = await prisma.feedback.findFirst({
            where: {
              githubIssueNumber: issue.number,
              status: { in: ['issue_pushed', 'workbuddy_evaluating'] },
            },
          });

          if (!feedback) {
            // console.log(`[GitHubIssuePoll] No feedback found for issue #${issue.number}`);
            continue;
          }

          // 如果已经处理过，跳过
          if (feedback.workbuddyDecision) {
            // console.log(`[GitHubIssuePoll] Issue #${issue.number} already processed`);
            continue;
          }

          // 更新状态为评估中
          await prisma.feedback.update({
            where: { id: feedback.id },
            data: {
              status: 'workbuddy_evaluating',
              workbuddyEvaluatingAt: new Date(),
            },
          });

          // 3. AI 分析 Issue
          const decision = await analyzeIssue(
            issue.number,
            issue.title,
            issue.body,
            {
              category: (feedback.category || 'inquiry') as 'bug' | 'suggestion' | 'inquiry' | 'complaint',
              priority: (feedback.priority || 'P2') as 'P0' | 'P1' | 'P2',
              sentiment: (feedback.sentiment || 'neutral') as 'positive' | 'neutral' | 'negative',
              content: feedback.content,
              subject: feedback.subject || undefined,
            }
          );

          // 4. 更新数据库
          await prisma.feedback.update({
            where: { id: feedback.id },
            data: {
              status: 'processed',
              workbuddyProcessedAt: new Date(),
              workbuddyDecision: decision.decision,
              workbuddyAnalysis: decision as any,
            },
          });

          result.issuesAnalyzed++;
          this.totalAnalyzed++;
          // console.log(`[GitHubIssuePoll] Analyzed issue #${issue.number}: ${decision.decision}`);

          // 5. 回传评论到 GitHub Issue
          const comments = await getIssueComments(issue.number);
          await postFixReport(issue.number, {
            problemType: decision.analysis.problemType,
            affectedFiles: decision.analysis.affectedFiles,
            fixSolution: decision.analysis.fixSolution,
            actions: [
              { description: 'AI 问题分析', completed: true },
              { description: '生成处理决策', completed: true },
              { description: '回传分析报告', completed: true },
            ],
            priorityChange: feedback.priority !== decision.analysis.priority 
              ? { from: feedback.priority || 'unknown', to: decision.analysis.priority }
              : undefined,
            rewardDays: decision.rewardDays,
            // @ts-ignore - 动态添加的字段
            rewardOcrCount: (decision as any).rewardOcrCount,
            // @ts-ignore
            rewardMembershipDays: (decision as any).rewardMembershipDays,
          });

          // 6. 根据决策更新 Issue 标签
          if (decision.decision === 'fix') {
            await updateIssueStatus(issue.number, 'open', ['user-feedback', 'fixing']);
          } else if (decision.decision === 'ignore') {
            await updateIssueStatus(issue.number, 'closed', ['user-feedback', 'ignored']);
          } else {
            await updateIssueStatus(issue.number, 'open', ['user-feedback', 'needs-review']);
          }

        } catch (issueError) {
          const errMsg = issueError instanceof Error ? issueError.message : String(issueError);
          result.errors.push(`Issue #${issue.number}: ${errMsg}`);
          // console.error(`[GitHubIssuePoll] Error processing issue #${issue.number}:`, issueError);
        }
      }

      result.success = true;
      this.lastPollTime = result.lastPollTime;
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      result.errors.push(`Poll failed: ${errMsg}`);
      // console.error('[GitHubIssuePoll] Poll failed:', error);
    }

    return result;
  }

  /**
   * 获取所有 open 状态的 Issue
   */
  private async getOpenIssues(githubService: any): Promise<GitHubIssueInfo[]> {
    // 使用 GitHub API 搜索带有 user-feedback 标签的 open issues
    const url = `${githubService.baseUrl}/repos/${githubService.owner}/${githubService.repo}/issues`;
    
    const params = new URLSearchParams({
      state: 'open',
      labels: 'user-feedback',
      per_page: '20',
    });

    try {
      const response = await fetch(`${url}?${params}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${githubService.token}`,
          'Accept': 'application/vnd.github.v3+json',
        },
      });

      if (!response.ok) {
        throw new Error(`GitHub API error: ${response.status}`);
      }

      const issues = await response.json();
      
      return issues.map((issue: any) => ({
        number: issue.number,
        title: issue.title,
        body: issue.body || '',
        labels: issue.labels?.map((l: any) => l.name) || [],
        state: issue.state,
        created_at: issue.created_at,
      }));
    } catch (error) {
      // console.error('[GitHubIssuePoll] Failed to fetch issues:', error);
      return [];
    }
  }

  /**
   * 获取轮询状态
   */
  getStatus(): { isRunning: boolean; lastPollTime: Date | null; totalAnalyzed: number } {
    return {
      isRunning: this.isRunning,
      lastPollTime: this.lastPollTime,
      totalAnalyzed: this.totalAnalyzed,
    };
  }
}

// ==================== 单例实例 ====================

let pollServiceInstance: GitHubIssuePollService | null = null;

/**
 * 获取轮询服务单例
 */
export function getGitHubIssuePollService(): GitHubIssuePollService {
  if (!pollServiceInstance) {
    pollServiceInstance = new GitHubIssuePollService();
  }
  return pollServiceInstance;
}

/**
 * 启动轮询服务
 */
export async function startGitHubIssuePoll(): Promise<void> {
  const service = getGitHubIssuePollService();
  await service.start();
}

/**
 * 停止轮询服务
 */
export function stopGitHubIssuePoll(): void {
  const service = getGitHubIssuePollService();
  service.stop();
}

/**
 * 手动触发轮询
 */
export async function triggerGitHubIssuePoll(): Promise<PollResult> {
  const service = getGitHubIssuePollService();
  return service.pollOnce();
}

/**
 * 获取轮询状态
 */
export function getGitHubIssuePollStatus(): { isRunning: boolean; lastPollTime: Date | null; totalAnalyzed: number } {
  const service = getGitHubIssuePollService();
  return service.getStatus();
}

/**
 * 手动分析单个 Issue
 */
export async function analyzeSingleIssue(issueNumber: number): Promise<{ success: boolean; decision?: any; error?: string }> {
  try {
    const githubService = getGitHubService();
    
    // 获取 Issue 内容
    const url = `${githubService.baseUrl}/repos/${githubService.owner}/${githubService.repo}/issues/${issueNumber}`;
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${githubService.token}`,
        'Accept': 'application/vnd.github.v3+json',
      },
    });

    if (!response.ok) {
      return { success: false, error: `GitHub API error: ${response.status}` };
    }

    const issue = await response.json();

    // 查找对应的 feedback
    const feedback = await prisma.feedback.findFirst({
      where: { githubIssueNumber: issueNumber },
    });

    if (!feedback) {
      return { success: false, error: 'No feedback found for this issue' };
    }

    // AI 分析
    const decision = await analyzeIssue(
      issueNumber,
      issue.title,
      issue.body,
      {
        category: feedback.category || 'inquiry',
        priority: feedback.priority || 'P2',
        sentiment: feedback.sentiment || 'neutral',
        content: feedback.content,
        subject: feedback.subject,
      }
    );

    // 更新数据库
    await prisma.feedback.update({
      where: { id: feedback.id },
      data: {
        status: 'processed',
        workbuddyProcessedAt: new Date(),
        workbuddyDecision: decision.decision,
        workbuddyAnalysis: decision as any,
      },
    });

    // 回传评论
    await postFixReport(issueNumber, {
      problemType: decision.analysis.problemType,
      affectedFiles: decision.analysis.affectedFiles,
      fixSolution: decision.analysis.fixSolution,
      actions: [
        { description: 'AI 问题分析', completed: true },
        { description: '生成处理决策', completed: true },
        { description: '回传分析报告', completed: true },
      ],
      priorityChange: feedback.priority !== decision.analysis.priority 
        ? { from: feedback.priority, to: decision.analysis.priority }
        : undefined,
      rewardDays: decision.rewardDays,
      rewardOcrCount: decision.rewardOcrCount,
      rewardMembershipDays: decision.rewardMembershipDays,
    });

    return { success: true, decision };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}
