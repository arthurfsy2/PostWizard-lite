/**
 * WorkBuddy AI 分析服务
 * 分析 GitHub Issue 并给出处理决策
 */

import OpenAI from "openai";
import { prisma } from "../prisma";

// ==================== 类型定义 ====================

export interface WorkBuddyDecision {
  decision: 'fix' | 'ignore' | 'review';
  rewardDays: number;
  reason: string;
  analysis: {
    problemType: string;
    affectedFiles: number;
    fixSolution: string;
    priority: string;
  };
}

import { getAIConfigFromDB, createOpenAIClient } from "./ai-config";

/**
 * 分析 GitHub Issue 内容，给出决策
 */
export async function analyzeIssue(
  issueNumber: number,
  issueTitle: string,
  issueBody: string,
  feedbackData: {
    category: string;
    priority: string;
    sentiment: string;
    content: string;
    subject?: string;
  }
): Promise<WorkBuddyDecision> {
  const prompt = `
你是一个专业的技术问题分析助手。请分析以下 GitHub Issue 内容，给出处理决策。

## Issue 信息
- Issue 编号: #${issueNumber}
- 标题: ${issueTitle}
- 内容: ${issueBody}

## 已有分析数据
- 分类: ${feedbackData.category}
- 优先级: ${feedbackData.priority}
- 情感: ${feedbackData.sentiment}
- 用户反馈: ${feedbackData.content}

## 请给出决策（JSON 格式）
请根据以下规则进行分析：

1. **决策 (decision)**:
   - "fix": 可以通过代码修复的问题（如 Bug、功能缺失）
   - "ignore": 无需处理的问题（如无效反馈、重复反馈）
   - "review": 需要人工审核（如复杂问题、安全相关）

2. **奖励建议 (reward)**:
   - 包含两个字段：
     - aiOcrCount: AI识别次数 (0-10)
     - membershipDays: 会员天数 (0-7)
   - 必须同时给出两种建议，由管理员选择发放哪种
   - 普通问题：OCR 3-5 次，会员 1-3 天
   - 重要问题：OCR 5-10 次，会员 3-7 天

3. **原因 (reason)**: 简洁说明决策理由（50字以内）

4. **分析详情 (analysis)**:
   - problemType: 问题类型（如 Bug、功能建议、体验问题）
   - affectedFiles: 预计影响文件数（0-10）
   - fixSolution: 简要修复方案（30字以内）
   - priority: 建议优先级 P0/P1/P2

请直接返回 JSON，不要其他内容。格式如下：
{
  "decision": "fix" | "ignore" | "review",
  "reward": {
    "aiOcrCount": 5,
    "membershipDays": 3
  },
  "reason": "这是决策理由",
  "analysis": {
    "problemType": "Bug 修复",
    "affectedFiles": 3,
    "fixSolution": "修复 XXX 函数",
    "priority": "P1"
  }
}
`.trim();

  try {
    // 从数据库动态获取 AI 配置并创建客户端
    const [aiConfig, openai] = await Promise.all([
      getAIConfigFromDB(),
      createOpenAIClient(),
    ]);

    const completion = await openai.chat.completions.create({
      model: aiConfig.model,
      messages: [
        {
          role: "system",
          content: "你是一个专业的技术问题分析助手。根据 Issue 内容给出合理的处理决策和奖励建议。",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.3,
      max_tokens: 1000,
    });

    const response = completion.choices[0]?.message?.content || "";
    
    // 解析 JSON
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      
      // 验证并规范化
      const validDecisions = ['fix', 'ignore', 'review'];
      const validPriorities = ['P0', 'P1', 'P2'];
      
      // 解析奖励（支持新旧两种格式）
      const reward = parsed.reward || {};
      const ocrCount = Math.min(Math.max(reward.aiOcrCount || reward.ocrCount || 0, 0), 10);
      const membershipDays = Math.min(Math.max(reward.membershipDays || 0, 0), 7);
      
      return {
        decision: validDecisions.includes(parsed.decision) ? parsed.decision : 'review',
        rewardDays: membershipDays, // 保持兼容，用于现有逻辑
        rewardOcrCount: ocrCount,   // 新增：AI识别次数
        rewardMembershipDays: membershipDays, // 新增：会员天数
        rewardSuggestion: `AI识别 ${ocrCount} 次 或 会员 ${membershipDays} 天`,
        reason: parsed.reason || '分析完成',
        analysis: {
          problemType: parsed.analysis?.problemType || '未知',
          affectedFiles: Math.min(Math.max(parsed.analysis?.affectedFiles || 0, 0), 10),
          fixSolution: parsed.analysis?.fixSolution || '-',
          priority: validPriorities.includes(parsed.analysis?.priority) ? parsed.analysis.priority : 'P2',
        },
      };
    }
  } catch (error) {
    // console.error('[WorkBuddyAnalysis] AI analysis failed:', error);
  }

  // AI 失败时的降级处理
  return {
    decision: 'review',
    rewardDays: 0,
    reason: 'AI 分析失败，需要人工审核',
    analysis: {
      problemType: '未知',
      affectedFiles: 0,
      fixSolution: '-',
      priority: 'P2',
    },
  };
}

/**
 * 批量分析多个 Issue
 */
export async function analyzeIssues(
  issues: Array<{
    issueNumber: number;
    issueTitle: string;
    issueBody: string;
    feedbackId: string;
    category: string;
    priority: string;
    sentiment: string;
    content: string;
    subject?: string;
  }>
): Promise<Array<{ feedbackId: string; decision: WorkBuddyDecision }>> {
  const results: Array<{ feedbackId: string; decision: WorkBuddyDecision }> = [];

  for (const issue of issues) {
    const decision = await analyzeIssue(
      issue.issueNumber,
      issue.issueTitle,
      issue.issueBody,
      {
        category: issue.category,
        priority: issue.priority,
        sentiment: issue.sentiment,
        content: issue.content,
        subject: issue.subject,
      }
    );

    results.push({
      feedbackId: issue.feedbackId,
      decision,
    });
  }

  return results;
}
