/**
 * GitHub 服务
 * 用于自动创建 Issue 管理用户反馈
 */

import { FeedbackAnalysis } from './feedbackService';

// ==================== 类型定义 ====================

export interface GitHubIssue {
  number: number;
  url: string;
  title: string;
}

export interface GitHubComment {
  id: number;
  user: {
    login: string;
    avatar_url: string;
  };
  body: string;
  created_at: string;
  updated_at: string;
}

export interface CreateIssueOptions {
  title: string;
  body: string;
  labels?: string[];
}

export interface FeedbackIssueData {
  userEmail: string;
  subject: string;
  content: string;
  analysis: FeedbackAnalysis;
  fromEmail: string;
  messageId: string;
}

// ==================== GitHub 服务类 ====================

export class GitHubService {
  private token: string;
  private repo: string;
  private owner: string;
  private baseUrl = 'https://api.github.com';

  constructor() {
    this.token = process.env.GITHUB_TOKEN || '';
    
    // 解析 repo 为 owner/repo 格式
    const repoFull = process.env.GITHUB_REPO || '';
    const parts = repoFull.split('/');
    this.owner = parts[0] || 'postcrossing-wizard';
    this.repo = parts[1] || 'postwizard-lite';
    
    if (!this.token) {
      // console.warn('[GitHub] GITHUB_TOKEN not set, Issue creation will be disabled');
    }
  }

  /**
   * 验证配置是否有效
   */
  isConfigured(): boolean {
    return !!this.token && !!this.repo;
  }

  /**
   * 创建 Issue
   */
  async createIssue(options: CreateIssueOptions): Promise<GitHubIssue | null> {
    if (!this.isConfigured()) {
      // console.warn('[GitHub] Not configured, skipping issue creation');
      return null;
    }

    const url = `${this.baseUrl}/repos/${this.owner}/${this.repo}/issues`;
    
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: options.title,
          body: options.body,
          labels: options.labels || ['user-feedback'],
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`GitHub API error: ${response.status} - ${error}`);
      }

      const data = await response.json();
      
      // console.log(`[GitHub] Issue created: #${data.number} - ${data.html_url}`);
      
      return {
        number: data.number,
        url: data.html_url,
        title: data.title,
      };
    } catch (error) {
      // console.error('[GitHub] Failed to create issue:', error);
      return null;
    }
  }

  /**
   * 创建用户反馈 Issue
   */
  async createFeedbackIssue(data: FeedbackIssueData): Promise<GitHubIssue | null> {
    const title = `[Auto] 用户反馈：${data.subject || '无主题'}`;
    
    const body = this.formatFeedbackBody(data);
    
    // 根据分析结果添加标签
    const labels = [
      'user-feedback',
      data.analysis.category,
      data.analysis.priority.toLowerCase(),
      data.analysis.sentiment,
    ];

    return this.createIssue({ title, body, labels });
  }

  /**
   * 格式化反馈内容为 Issue body
   */
  private formatFeedbackBody(data: FeedbackIssueData): string {
    const timestamp = new Date().toISOString();
    
    return `## 用户反馈详情

### 基本信息
- **用户邮箱**: ${data.userEmail || '未知'}
- **发件邮箱**: ${data.fromEmail}
- **邮件主题**: ${data.subject || '无主题'}
- **邮件 ID**: ${data.messageId || '未知'}
- **提交时间**: ${timestamp}

---

### 邮件正文

${data.content || '(无正文)'}

---

### AI 分析结果

| 维度 | 结果 |
|------|------|
| 情感 | ${this.getEmoji(data.analysis.sentiment)} ${data.analysis.sentiment} |
| 分类 | ${data.analysis.category} |
| 优先级 | ${data.analysis.priority} |
| 奖励建议 | ${data.analysis.rewardSuggestion} |

---

*此 Issue 由 PostWizard 自动创建*
`;
  }

  /**
   * 获取情感 emoji
   */
  private getEmoji(sentiment: string): string {
    switch (sentiment) {
      case 'positive': return '😊';
      case 'negative': return '😞';
      default: return '😐';
    }
  }

  /**
   * 更新 Issue 状态（open/closed）和标签
   */
  async updateIssueStatus(
    issueNumber: number,
    state: 'open' | 'closed',
    labels?: string[]
  ): Promise<boolean> {
    if (!this.isConfigured()) {
      return false;
    }

    const url = `${this.baseUrl}/repos/${this.owner}/${this.repo}/issues/${issueNumber}`;

    try {
      const body: any = { state };
      if (labels) {
        body.labels = labels;
      }

      const response = await fetch(url, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`GitHub API error: ${response.status} - ${error}`);
      }

      // console.log(`[GitHub] Issue #${issueNumber} updated to ${state}`);
      return true;
    } catch (error) {
      // console.error('[GitHub] Failed to update issue:', error);
      return false;
    }
  }

  /**
   * 添加 Issue 评论
   */
  async addIssueComment(issueNumber: number, body: string): Promise<boolean> {
    if (!this.isConfigured()) {
      return false;
    }

    const url = `${this.baseUrl}/repos/${this.owner}/${this.repo}/issues/${issueNumber}/comments`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ body }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`GitHub API error: ${response.status} - ${error}`);
      }

      // console.log(`[GitHub] Comment added to issue #${issueNumber}`);
      return true;
    } catch (error) {
      // console.error('[GitHub] Failed to add comment:', error);
      return false;
    }
  }

  /**
   * 关闭 Issue（带原因）
   */
  async closeIssue(issueNumber: number, reason?: string): Promise<boolean> {
    // 先尝试添加关闭原因评论
    if (reason) {
      await this.addIssueComment(issueNumber, `**关闭原因**: ${reason}`);
    }
    
    return this.updateIssueStatus(issueNumber, 'closed');
  }

  /**
   * 获取 Issue 评论列表
   */
  async getIssueComments(issueNumber: number): Promise<GitHubComment[]> {
    if (!this.isConfigured()) {
      return [];
    }

    const url = `${this.baseUrl}/repos/${this.owner}/${this.repo}/issues/${issueNumber}/comments`;

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'Accept': 'application/vnd.github.v3+json',
        },
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`GitHub API error: ${response.status} - ${error}`);
      }

      const comments = await response.json();
      return comments as GitHubComment[];
    } catch (error) {
      // console.error('[GitHub] Failed to get comments:', error);
      return [];
    }
  }

  /**
   * 删除 Issue 评论
   */
  async deleteComment(commentId: number): Promise<boolean> {
    if (!this.isConfigured()) {
      return false;
    }

    const url = `${this.baseUrl}/repos/${this.owner}/${this.repo}/issues/comments/${commentId}`;

    try {
      const response = await fetch(url, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'Accept': 'application/vnd.github.v3+json',
        },
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`GitHub API error: ${response.status} - ${error}`);
      }

      // console.log(`[GitHub] Comment #${commentId} deleted`);
      return true;
    } catch (error) {
      // console.error('[GitHub] Failed to delete comment:', error);
      return false;
    }
  }

  /**
   * 回传 WorkBuddy 修复报告（支持 rewardDays）
   */
  async postFixReport(
    issueNumber: number,
    report: {
      problemType: string;
      affectedFiles: number;
      fixSolution: string;
      actions: { description: string; completed: boolean; link?: string }[];
      priorityChange?: { from: string; to: string };
      commitUrl?: string;
      prUrl?: string;
      rewardDays?: number;
      rewardOcrCount?: number;  // 新增：OCR 次数
      rewardMembershipDays?: number; // 新增：会员天数
    }
  ): Promise<boolean> {
    // 使用中国时区 (UTC+8)
    const timestamp = new Date(new Date().getTime() + 8 * 60 * 60 * 1000).toISOString().replace('Z', '+08:00');

    // 生成操作清单
    const actionsList = report.actions
      .map(a => `- [${a.completed ? 'x' : ' '}] ${a.description}${a.link ? ` ([链接](${a.link}))` : ''}`)
      .join('\n');

    // 生成优先级变更
    const priorityChange = report.priorityChange 
      ? `\n**建议评分**: ${report.priorityChange.from} → ${report.priorityChange.to}`
      : '';

    // 生成奖励信息（同时显示 OCR 次数和会员天数）
    let rewardInfo = '';
    if (report.rewardOcrCount !== undefined || report.rewardMembershipDays !== undefined) {
      const ocrPart = report.rewardOcrCount !== undefined ? `${report.rewardOcrCount} 次 AI识别` : '';
      const memberPart = report.rewardMembershipDays !== undefined ? `${report.rewardMembershipDays} 天会员` : '';
      const rewardText = [ocrPart, memberPart].filter(Boolean).join(' 或 ');
      rewardInfo = `\n**奖励建议**: 赠送 ${rewardText}`;
    } else if (report.rewardDays !== undefined) {
      rewardInfo = `\n**奖励建议**: 赠送 ${report.rewardDays} 天 OCR 额度`;
    }

    // 生成相关链接
    const links = [];
    if (report.commitUrl) links.push(`- Commit: ${report.commitUrl}`);
    if (report.prUrl) links.push(`- PR: ${report.prUrl}`);
    const linksSection = links.length > 0 ? `\n**相关链接**:\n${links.join('\n')}` : '';

    const body = `## 🤖 WorkBuddy 自动修复报告

**分析结果**:
- 问题类型：${report.problemType}
- 影响文件：${report.affectedFiles} 个
- 修复方案：${report.fixSolution}
${rewardInfo}

**已执行操作**:
${actionsList}
${priorityChange}
${linksSection}

---
*报告生成时间: ${timestamp}*
*由 WorkBuddy 自动提交*`;

    return this.addIssueComment(issueNumber, body);
  }
}

// ==================== 单例实例 ====================

let githubServiceInstance: GitHubService | null = null;

/**
 * 获取 GitHub 服务单例
 */
export function getGitHubService(): GitHubService {
  if (!githubServiceInstance) {
    githubServiceInstance = new GitHubService();
  }
  return githubServiceInstance;
}

/**
 * 创建用户反馈 Issue（便捷函数）
 */
export async function createFeedbackIssue(data: FeedbackIssueData): Promise<GitHubIssue | null> {
  const service = getGitHubService();
  return service.createFeedbackIssue(data);
}

/**
 * 更新 Issue 状态（便捷函数）
 */
export async function updateIssueStatus(
  issueNumber: number,
  state: 'open' | 'closed',
  labels?: string[]
): Promise<boolean> {
  const service = getGitHubService();
  return service.updateIssueStatus(issueNumber, state, labels);
}

/**
 * 添加 Issue 评论（便捷函数）
 */
export async function addIssueComment(issueNumber: number, body: string): Promise<boolean> {
  const service = getGitHubService();
  return service.addIssueComment(issueNumber, body);
}

/**
 * 关闭 Issue（便捷函数）
 */
export async function closeIssue(issueNumber: number, reason?: string): Promise<boolean> {
  const service = getGitHubService();
  return service.closeIssue(issueNumber, reason);
}

/**
 * 获取 Issue 评论列表（便捷函数）
 */
export async function getIssueComments(issueNumber: number): Promise<GitHubComment[]> {
  const service = getGitHubService();
  return service.getIssueComments(issueNumber);
}

/**
 * 回传 WorkBuddy 修复报告（便捷函数）
 */
export async function postFixReport(
  issueNumber: number,
  report: {
    problemType: string;
    affectedFiles: number;
    fixSolution: string;
    actions: { description: string; completed: boolean; link?: string }[];
    priorityChange?: { from: string; to: string };
    commitUrl?: string;
    prUrl?: string;
    rewardDays?: number;
    rewardOcrCount?: number;
    rewardMembershipDays?: number;
  }
): Promise<boolean> {
  const service = getGitHubService();
  return service.postFixReport(issueNumber, report);
}

/**
 * 删除 Issue 评论（便捷函数）
 */
export async function deleteComment(commentId: number): Promise<boolean> {
  const service = getGitHubService();
  return service.deleteComment(commentId);
}
