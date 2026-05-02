import OpenAI from "openai";
import { prisma } from "../prisma";
import { getConfigForPurpose, createOpenAIWithProxy } from "./ai-config";
import { sanitizeEmailContent, sanitizeEmailAddressField, sanitizeEmailSubject } from "../helpers/emailSanitizer";
import fs from 'fs';
import path from 'path';

export interface FeedbackAnalysis {
  sentiment: "positive" | "neutral" | "negative";
  category: "bug" | "suggestion" | "inquiry" | "complaint";
  priority: "P0" | "P1" | "P2";
  rewardDays?: number;   // AI 建议的会员天数（付费用户）
  rewardQuota?: number;  // AI 建议的 AI 识别额度（免费用户）
  rewardSuggestion?: string;
}

/**
 * 写入 AI 分析日志到文件
 */
function writeAILog(
  logType: 'prompt' | 'response' | 'result' | 'error',
  data: {
    content?: string;
    subject?: string;
    analysis?: FeedbackAnalysis;
    error?: Error;
    timestamp: string;
  }
): void {
  try {
    const logDir = path.join(process.cwd(), '.workbuddy', 'logs', 'ai-feedback');
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }

    const today = new Date().toISOString().split('T')[0];
    const logFile = path.join(logDir, `feedback-ai-${today}.md`);

    // 如果文件不存在，创建标题
    if (!fs.existsSync(logFile)) {
      fs.writeFileSync(
        logFile,
        `# AI 反馈分析日志 - ${today}\n\n`,
        'utf-8'
      );
    }

    // 格式化日志内容
    let logContent = `## ${data.timestamp}\n\n`;

    if (logType === 'prompt') {
      logContent += `### 📝 组装的 Prompt\n\n`;
      if (data.subject) {
        logContent += `**主题**: ${data.subject}\n\n`;
      }
      logContent += `**完整的 AI Prompt**:\n\`\`\`\n${data.content}\n\`\`\`\n\n`;
    } else if (logType === 'response') {
      logContent += `### 🤖 AI 原始回复\n\n`;
      logContent += `\`\`\`json\n${data.content}\n\`\`\`\n\n`;
    } else if (logType === 'result') {
      logContent += `### ✅ 处理后的结果\n\n`;
      logContent += `\`\`\`json\n${JSON.stringify(data.analysis, null, 2)}\n\`\`\`\n\n`;
    } else if (logType === 'error') {
      logContent += `### ❌ AI 分析失败（使用降级方案）\n\n`;
      logContent += `**错误信息**:\n\`\`\`\n${data.error?.message}\n\`\`\`\n\n`;
      if (data.error?.stack) {
        logContent += `**堆栈跟踪**:\n\`\`\`\n${data.error.stack}\n\`\`\`\n\n`;
      }
      logContent += `**降级方案结果**:\n\`\`\`json\n${JSON.stringify(data.analysis, null, 2)}\n\`\`\`\n\n`;
    }

    logContent += `---\n\n`;

    // 追加到日志文件
    fs.appendFileSync(logFile, logContent, 'utf-8');
  } catch (err) {
    // 日志写入失败不影响主流程
    console.error('[Feedback Service] Failed to write AI log:', err);
  }
}

/**
 * AI 分析反馈内容
 */
export async function analyzeFeedback(
  content: string,
  subject?: string,
  isPremium: boolean = false,  // 新增参数：是否为付费用户
): Promise<FeedbackAnalysis> {
  const timestamp = new Date().toISOString();
  const logId = timestamp.split('T')[1].split('.')[0]; // 使用时间作为日志 ID
  const userType = isPremium ? '付费用户（会员）' : '免费用户';

  // 构建完整的 prompt
  const prompt = `
请分析以下用户反馈，进行分类和优先级评估。

用户信息：
- 用户类型：${userType}

反馈内容：
${subject ? `主题：${subject}\n` : ''}正文：${content}

请从以下维度分析并返回 JSON 格式结果：

{
  "sentiment": "positive" | "neutral" | "negative",  // 情感：正面/中性/负面
  "category": "bug" | "suggestion" | "inquiry" | "complaint",  // 问题分类
  // - bug: 产品功能故障、报错
  // - suggestion: 功能建议、改进意见
  // - inquiry: 咨询问题、寻求帮助
  // - complaint: 投诉、不满
  "priority": "P0" | "P1" | "P2",  // 优先级
  // - P0: 紧急，影响核心功能使用，需要立即处理
  // - P1: 重要，影响用户体验，需要尽快处理
  // - P2: 一般，改进建议或轻微问题，可以后续处理
  "rewardDays": 1-3,  // 奖励会员天数（仅付费用户返回）
  "rewardQuota": 1-5  // 奖励 AI 识别额度（仅免费用户返回）
}

奖励规则（重要）：
1. **当前用户是${userType}**，请根据用户类型返回对应的奖励字段
2. 付费用户：只返回 rewardDays（1-3 天），不要返回 rewardQuota
3. 免费用户：只返回 rewardQuota（1-5 次），不要返回 rewardDays
4. Bug 报告：优先给较高奖励（P0 给 3 天/5 次，P1 给 2 天/3 次，P2 给 1 天/2 次）
5. 功能建议：根据详细程度奖励（P2 级别通常 1-2 天/1-3 次）
6. 投诉：给较高奖励以安抚用户
7. 咨询：给最低奖励

请直接返回 JSON，不要其他内容。
`.trim();

  // 打印完整 prompt 供调试
  console.log(`[Feedback Analysis #${logId}] Analyzing feedback...`);
  console.log(`[Feedback Analysis #${logId}] User Type:`, userType);
  console.log(`[Feedback Analysis #${logId}] Subject:`, subject || 'N/A');
  console.log(`[Feedback Analysis #${logId}] Content length:`, content.length);
  
  // 写入 prompt 日志（包含用户类型信息）
  writeAILog('prompt', {
    content: prompt,
    subject,
    timestamp,
  });

  try {
    // 从数据库动态获取 AI 配置并创建客户端
    const aiConfig = await getConfigForPurpose('text');
    const openai = await createOpenAIWithProxy(aiConfig);

    console.log(`[Feedback Analysis #${logId}] Calling AI API (model: ${aiConfig.model})...`);

    const completion = await openai.chat.completions.create({
      model: aiConfig.model,
      messages: [
        {
          role: "system",
          content:
            "你是一个专业的用户反馈分析助手。根据反馈内容判断情感、分类、优先级，并给出合理的奖励建议。",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.3,
      max_tokens: 500,
    });

    const response = completion.choices[0]?.message?.content || "";
    
    // 打印 AI 原始返回内容
    console.log(`[Feedback Analysis #${logId}] AI Response:`, response.substring(0, 200) + (response.length > 200 ? '...' : ''));
    
    // 写入 AI 回复日志
    writeAILog('response', {
      content: response,
      timestamp,
    });

    // 解析 JSON 响应
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      
      // 打印解析后的结果
      console.log(`[Feedback Analysis #${logId}] Parsed JSON:`, JSON.stringify(parsed, null, 2));

      // 验证并规范化返回结果
      const validSentiments = ["positive", "neutral", "negative"];
      const validCategories = ["bug", "suggestion", "inquiry", "complaint"];
      const validPriorities = ["P0", "P1", "P2"];

      // 处理奖励字段：AI 返回的是建议，后端会进一步处理
      const rewardDays = typeof parsed.rewardDays === 'number' ? Math.max(1, Math.min(3, parsed.rewardDays)) : undefined;
      const rewardQuota = typeof parsed.rewardQuota === 'number' ? Math.max(1, Math.min(5, parsed.rewardQuota)) : undefined;
      
      const result = {
        sentiment: validSentiments.includes(parsed.sentiment)
          ? parsed.sentiment
          : "neutral",
        category: validCategories.includes(parsed.category)
          ? parsed.category
          : "inquiry",
        priority: validPriorities.includes(parsed.priority)
          ? parsed.priority
          : "P2",
        rewardDays,
        rewardQuota,
        rewardSuggestion: parsed.rewardSuggestion || "感谢您的反馈",
      };
      
      console.log(`[Feedback Analysis #${logId}] Final Result:`, JSON.stringify(result, null, 2));
      
      // 写入处理结果日志
      writeAILog('result', {
        analysis: result,
        timestamp,
      });
      
      return result;
    } else {
      console.warn(`[Feedback Analysis #${logId}] No JSON found in AI response`);
    }
  } catch (error) {
    console.error(`[Feedback Analysis #${logId}] AI analysis failed:`, error instanceof Error ? error.message : error);
    
    // 写入错误日志
    writeAILog('error', {
      error: error instanceof Error ? error : new Error(String(error)),
      analysis: ruleBasedAnalysis(content, subject),
      timestamp,
    });
  }

  // Fallback: 基于规则的分析
  console.log(`[Feedback Analysis #${logId}] Using rule-based analysis as fallback`);
  const fallbackResult = ruleBasedAnalysis(content, subject);
  console.log(`[Feedback Analysis #${logId}] Fallback Result:`, JSON.stringify(fallbackResult, null, 2));
  
  return fallbackResult;
}

/**
 * 基于规则的反馈分析（AI 失败时的降级方案）
 */
function ruleBasedAnalysis(
  content: string,
  subject?: string,
): FeedbackAnalysis {
  const text = `${subject || ""} ${content}`.toLowerCase();

  // 检测情感
  let sentiment: "positive" | "neutral" | "negative" = "neutral";
  const positiveKeywords = [
    "谢谢",
    "感谢",
    "喜欢",
    "棒",
    "好",
    "优秀",
    "完美",
    "great",
    "thanks",
    "love",
    "awesome",
    "perfect",
  ];
  const negativeKeywords = [
    "垃圾",
    "烂",
    "差",
    "失望",
    "bug",
    "报错",
    "错误",
    "问题",
    "无法",
    "崩溃",
    "hate",
    "terrible",
    "worst",
    "broken",
    "issue",
  ];

  if (positiveKeywords.some((kw) => text.includes(kw))) {
    sentiment = "positive";
  } else if (negativeKeywords.some((kw) => text.includes(kw))) {
    sentiment = "negative";
  }

  // 检测分类
  let category: "bug" | "suggestion" | "inquiry" | "complaint" = "inquiry";
  const bugKeywords = [
    "bug",
    "报错",
    "错误",
    "无法",
    "崩溃",
    "故障",
    "broken",
    "error",
    "crash",
    "not working",
  ];
  const suggestionKeywords = [
    "建议",
    "希望",
    "可以",
    "应该",
    "能不能",
    "suggest",
    "should",
    "would be nice",
    "feature",
  ];
  const complaintKeywords = [
    "投诉",
    "不满",
    "退款",
    "差评",
    "complaint",
    "refund",
    "angry",
    "frustrated",
  ];

  if (bugKeywords.some((kw) => text.includes(kw))) {
    category = "bug";
  } else if (suggestionKeywords.some((kw) => text.includes(kw))) {
    category = "suggestion";
  } else if (complaintKeywords.some((kw) => text.includes(kw))) {
    category = "complaint";
  }

  // 检测优先级
  let priority: "P0" | "P1" | "P2" = "P2";
  const p0Keywords = [
    "崩溃",
    "完全无法",
    "critical",
    "urgent",
    "emergency",
    "blocked",
  ];
  const p1Keywords = ["问题", "错误", "影响", "issue", "problem", "broken"];

  if (p0Keywords.some((kw) => text.includes(kw)) || category === "bug") {
    priority = "P0";
  } else if (p1Keywords.some((kw) => text.includes(kw))) {
    priority = "P1";
  }

  // 奖励建议
  let rewardSuggestion = "感谢您的反馈";
  if (category === "bug") {
    rewardSuggestion = "待技术评估后处理";
  } else if (category === "complaint") {
    rewardSuggestion = "优先处理并补偿";
  } else if (sentiment === "positive") {
    rewardSuggestion = "感谢您的认可";
  }

  return { sentiment, category, priority, rewardSuggestion };
}

/**
 * 反馈服务类
 */
export class FeedbackService {
  /**
   * 创建新反馈（通过 webhook）
   * 根据 emailMessageId 去重
   */
  async createFeedback(data: {
    userId?: string;
    userEmail?: string;
    content: string;
    subject?: string;
    fromEmail?: string;
    emailMessageId?: string;
    rawEmailData?: string;
    source?: "email" | "web"; // 反馈来源：email 或 web
  }) {
    // 根据 emailMessageId 去重检查
    if (data.emailMessageId) {
      const existing = await prisma.feedback.findFirst({
        where: { emailMessageId: data.emailMessageId },
      });
      if (existing) {
        // console.log(`[Feedback] Duplicate email detected: ${data.emailMessageId}, skipping...`);
        return existing; // 返回已存在的记录
      }
    }

    // 如果提供了 userId，查询用户类型
    let isPremium = false;
    if (data.userId) {
      const user = await prisma.user.findUnique({
        where: { id: data.userId },
        select: { plan: true, planExpiresAt: true },
      });
      
      if (user) {
        const { isPremiumUser } = await import('./rewardService');
        isPremium = isPremiumUser(user.plan, user.planExpiresAt);
      }
    }

    // AI 分析反馈（传入用户类型）
    const analysis = await analyzeFeedback(data.content, data.subject, isPremium);

    // 创建反馈记录（使用脱敏处理）
    const feedback = await prisma.feedback.create({
      data: {
        userId: data.userId,
        userEmail: data.userEmail,
        content: sanitizeEmailContent(data.content),
        subject: data.subject ? sanitizeEmailSubject(data.subject) : undefined,
        // 脱敏：发件人邮箱
        fromEmail: data.fromEmail ? sanitizeEmailAddressField(data.fromEmail) : undefined,
        emailMessageId: data.emailMessageId,
        // 脱敏：不存储原始邮件完整数据，仅存储脱敏摘要
        rawEmailData: data.rawEmailData ? sanitizeEmailContent(data.rawEmailData).substring(0, 500) : undefined,
        sentiment: analysis.sentiment,
        category: analysis.category,
        priority: analysis.priority,
        rewardSuggestion: analysis.rewardSuggestion,
        status: "pending",
        source: data.source || "email", // 默认来源为邮件
      },
    });

    return feedback;
  }

  /**
   * 获取反馈列表（管理后台）
   */
  async getFeedbackList(options?: {
    status?: string;
    sentiment?: string;
    category?: string;
    priority?: string;
    limit?: number;
    offset?: number;
  }) {
    const where: any = {};

    if (options?.status) where.status = options.status;
    if (options?.sentiment) where.sentiment = options.sentiment;
    if (options?.category) where.category = options.category;
    if (options?.priority) where.priority = options.priority;

    const [feedbacks, total] = await Promise.all([
      prisma.feedback.findMany({
        where,
        orderBy: [
          { priority: "asc" }, // P0 优先
          { createdAt: "desc" },
        ],
        take: options?.limit || 20,
        skip: options?.offset || 0,
      }),
      prisma.feedback.count({ where }),
    ]);

    return {
      feedbacks,
      total,
      hasMore: (options?.offset || 0) + feedbacks.length < total,
    };
  }

  /**
   * 获取单个反馈详情
   */
  async getFeedbackById(id: string) {
    return prisma.feedback.findUnique({
      where: { id },
    });
  }

  /**
   * 处理反馈（发放奖励）
   */
  async processFeedback(
    id: string,
    data: {
      rewardAmount: number;
      rewardDays?: number; // 新增：会员天数
      notes?: string;
      processedBy: string;
    },
  ) {
    const feedback = await prisma.feedback.findUnique({
      where: { id },
    });

    if (!feedback) {
      throw new Error("Feedback not found");
    }

    // 更新反馈状态
    const updated = await prisma.feedback.update({
      where: { id },
      data: {
        status: "processed",
        processedAt: new Date(),
        processedBy: data.processedBy,
        rewardAmount: data.rewardAmount,
        rewardDays: data.rewardDays || 0,
        notes: data.notes,
      },
    });

    // 如果有 AI 识别奖励，添加到用户账户
    if (data.rewardAmount > 0 && feedback.userId) {
      await prisma.user.update({
        where: { id: feedback.userId },
        data: {
          bonusQuota: {
            increment: data.rewardAmount,
          },
        },
      });

      // 记录额度变动
      await prisma.quotaLog.create({
        data: {
          userId: feedback.userId,
          type: "feedback_reward",
          amount: data.rewardAmount,
          balance:
            (
              await prisma.user.findUnique({
                where: { id: feedback.userId },
                select: { bonusQuota: true },
              })
            )?.bonusQuota || 0,
          description: `反馈奖励：${feedback.subject || "用户反馈"}`,
        },
      });
    }

    // 如果有会员天数奖励，延长用户会员有效期
    if (data.rewardDays && data.rewardDays > 0 && feedback.userId) {
      const user = await prisma.user.findUnique({
        where: { id: feedback.userId },
      });

      if (user) {
        const currentExpiredAt =
          user.planExpiresAt && user.planExpiresAt > new Date()
            ? user.planExpiresAt
            : new Date();

        const newExpiredAt = new Date(
          currentExpiredAt.getTime() + data.rewardDays * 24 * 60 * 60 * 1000,
        );

        await prisma.user.update({
          where: { id: feedback.userId },
          data: {
            plan: "gift", // 赠送会员
            planExpiresAt: newExpiredAt,
          },
        });
      }
    }

    return updated;
  }

  /**
   * 忽略反馈
   */
  async dismissFeedback(id: string, processedBy: string, notes?: string) {
    return prisma.feedback.update({
      where: { id },
      data: {
        status: "dismissed",
        processedAt: new Date(),
        processedBy,
        notes,
      },
    });
  }

  /**
   * 更新反馈状态为已推送 Issue
   */
  async updateIssuePushed(id: string, githubIssueUrl: string) {
    // 从 URL 提取 issue number
    const match = githubIssueUrl.match(/\/issues\/(\d+)/);
    const issueNumber = match ? parseInt(match[1], 10) : null;

    return prisma.feedback.update({
      where: { id },
      data: {
        status: "issue_pushed",
        githubIssueUrl,
        githubIssueNumber: issueNumber,
        issuePushedAt: new Date(),
        updatedAt: new Date(),
      },
    });
  }

  /**
   * 更新反馈状态为 WorkBuddy 评估中
   */
  async updateWorkbuddyEvaluating(id: string) {
    // 如果还没有 issuePushedAt，先设置为当前时间
    const feedback = await prisma.feedback.findUnique({ where: { id } });

    return prisma.feedback.update({
      where: { id },
      data: {
        status: "workbuddy_evaluating",
        workbuddyEvaluatingAt: feedback?.workbuddyEvaluatingAt || new Date(),
        updatedAt: new Date(),
      },
    });
  }

  /**
   * 获取反馈详情（包含时间线数据）
   */
  async getFeedbackDetail(id: string) {
    return prisma.feedback.findUnique({
      where: { id },
    });
  }

  /**
   * 获取每日反馈统计报告
   */
  async getDailyReport(date?: Date) {
    const targetDate = date || new Date();
    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);

    const feedbacks = await prisma.feedback.findMany({
      where: {
        createdAt: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // 统计各维度数量
    const sentimentCount = {
      positive: 0,
      neutral: 0,
      negative: 0,
    };
    const categoryCount = {
      bug: 0,
      suggestion: 0,
      inquiry: 0,
      complaint: 0,
    };
    const priorityCount = {
      P0: 0,
      P1: 0,
      P2: 0,
    };
    const statusCount = {
      pending: 0,
      processed: 0,
      dismissed: 0,
    };

    feedbacks.forEach((f) => {
      if (f.sentiment && f.sentiment in sentimentCount)
        sentimentCount[f.sentiment as keyof typeof sentimentCount]++;
      if (f.category && f.category in categoryCount)
        categoryCount[f.category as keyof typeof categoryCount]++;
      if (f.priority && f.priority in priorityCount)
        priorityCount[f.priority as keyof typeof priorityCount]++;
      if (f.status && f.status in statusCount)
        statusCount[f.status as keyof typeof statusCount]++;
    });

    return {
      date: targetDate.toISOString().split("T")[0],
      total: feedbacks.length,
      sentiment: sentimentCount,
      category: categoryCount,
      priority: priorityCount,
      status: statusCount,
      feedbacks: feedbacks.slice(0, 10), // 最近 10 条
    };
  }

  /**
   * 获取未处理的高优先级反馈
   */
  async getPendingHighPriority() {
    return prisma.feedback.findMany({
      where: {
        status: "pending",
        priority: { in: ["P0", "P1"] },
      },
      orderBy: { createdAt: "asc" },
    });
  }
}

// 导出服务实例
export const feedbackService = new FeedbackService();
