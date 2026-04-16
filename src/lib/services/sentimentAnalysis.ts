/**
 * 留言情感分析服务
 *
 * 使用 AI 模型分析留言情感，支持：
 * 1. 多分类置信度（touching/funny/blessing/cultural）
 * 2. 最终 score = max(categories)，取最好维度作为精选分数
 * 3. 情感倾向（positive/neutral/negative）
 * 4. 关键词标签
 * 5. 中文翻译（非英文留言时）
 */

import { createOpenAIClient, getAIModel } from './ai-config';

export interface SentimentAnalysisResult {
  score: number;                     // 综合情感评分 (0-100) = max(categories)
  categories: {
    touching: number;                // 走心程度 (0-100)
    funny: number;                   // 有趣程度 (0-100)
    blessing: number;                // 祝福程度 (0-100)
    cultural: number;                // 文化交流程度 (0-100)
  };
  primaryCategory: 'touching' | 'funny' | 'blessing' | 'cultural';
  emotion: 'positive' | 'neutral' | 'negative';
  tags: string[];                    // 关键词标签 (3-5 个)
  translation?: string;              // 中文翻译（可选，非英文留言时填充）
}

/**
 * 构建 AI 分析 Prompt
 *
 * 设计原则：
 * - 4 个维度独立评分，可以同时高分（一条留言可以既走心又祝福）
 * - 最终 score = max(categories)，取最好的那一面作为精选分数
 * - AI 只负责评分，不负责汇总（汇总逻辑透明可控）
 */
function buildAnalysisPrompt(message: string): string {
  return `你是一位专业的明信片留言情感分析师。请对留言的 4 个维度独立评分（每项 0-100）。

## 4 个维度（独立评分，可以同时高分）：

| 维度 | 含义 | 低分特征 | 高分特征 |
|------|------|----------|----------|
| **touching**（走心） | 真情实感、感人故事、深度共鸣 | 泛泛感谢、客套话 | 有个人故事、情感脆弱、让人共鸣 |
| **funny**（有趣） | 幽默、机智、自嘲 | 无幽默元素 | 让人会心一笑、有趣的表达 |
| **blessing**（祝福） | 真诚祝愿 | 模板化万能祝福 | 针对收信人的真诚期盼 |
| **cultural**（文化交流） | 分享文化/生活/地理信息 | 无文化交流 | 分享了有趣的知识或经历 |

## 评分锚点（严格对标）：

**touching（走心）：**
- 5-20：只有感谢，无个人情感
- 30-50：简单回应，有礼貌但不深入
- 60-80：提及个人细节（骑行、宠物、天气）
- 85+：有故事、情感脆弱、让人共鸣

**blessing（祝福）：**
- 5-20：模板化万能祝福（"wishing you health, happiness, love and joy"）
- 30-60：普通祝福，有针对性但不算真诚
- 70+：针对收信人的真诚期盼，有温度

**funny（有趣）：**
- 5-20：没有幽默元素
- 30-60：有一点点有趣
- 70+：让人会心一笑

**cultural（文化交流）：**
- 5-20：没有文化交流
- 30-60：简单提及文化
- 70+：分享了有趣的文化/地理/生活知识

## Few-shot 示例：

**留言**: "Hi, thanks for the card! Happy Postcrossing!"
→ touching=20, funny=10, blessing=40, cultural=5

**留言**: "恭喜你的宝宝！我有三个孩子，趁他们还小好好享受吧，时间眨眼就过去了！"
→ touching=80, funny=10, blessing=50, cultural=5

**留言**: "你的卡片让我想起我祖母…收到你的卡片时我哭了，那种温暖的感觉一模一样。"
→ touching=95, funny=5, blessing=40, cultural=5

**留言**: "你是怎么收集到这么多恐龙的？太疯狂了！我也很喜欢古生物学。"
→ touching=30, funny=50, blessing=20, cultural=40

**留言**: "谢谢你的卡片和邮票！祝骑行顺利，注意安全！Happy Postcrossing!"
→ touching=30, funny=10, blessing=60, cultural=5

## 待分析的留言：

"""
${message}
"""

请只输出 JSON（不要解释，不要输出 score 字段）：
{
  "categories": {
    "touching": <0-100>,
    "funny": <0-100>,
    "blessing": <0-100>,
    "cultural": <0-100>
  },
  "emotion": "<positive/neutral/negative>",
  "tags": ["<标签1>", "<标签2>", "<标签3>"],
  "translation": "<中文翻译，如果是中文则留空>"
}`;
}

/**
 * 从 categories 计算综合评分 = max(categories)
 */
function computeScore(categories: SentimentAnalysisResult['categories']): number {
  return Math.max(categories.touching, categories.funny, categories.blessing, categories.cultural);
}

/**
 * 从 categories 取最高分类
 */
function computePrimaryCategory(categories: SentimentAnalysisResult['categories']): SentimentAnalysisResult['primaryCategory'] {
  const entries = Object.entries(categories) as [SentimentAnalysisResult['primaryCategory'], number][];
  const [top] = entries.sort((a, b) => b[1] - a[1]);
  return top[0];
}

/**
 * 解析 AI 返回的 JSON 结果
 */
function parseAnalysisResult(content: string): SentimentAnalysisResult {
  try {
    // 提取 JSON 内容（处理可能的 markdown 代码块）
    const jsonMatch = content.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
    const jsonStr = jsonMatch ? jsonMatch[1] : content;

    // 清理可能的非 JSON 内容
    const cleanJson = jsonStr.replace(/^\s*\{/, '{').replace(/\}\s*$/, '}');

    const parsed = JSON.parse(cleanJson);

    const categories: SentimentAnalysisResult['categories'] = {
      touching: Math.min(100, Math.max(0, Math.round(parsed.categories?.touching || 0))),
      funny: Math.min(100, Math.max(0, Math.round(parsed.categories?.funny || 0))),
      blessing: Math.min(100, Math.max(0, Math.round(parsed.categories?.blessing || 0))),
      cultural: Math.min(100, Math.max(0, Math.round(parsed.categories?.cultural || 0))),
    };

    const result: SentimentAnalysisResult = {
      score: computeScore(categories),
      categories,
      primaryCategory: computePrimaryCategory(categories),
      emotion: parsed.emotion || 'neutral',
      tags: Array.isArray(parsed.tags) ? parsed.tags.slice(0, 5) : [],
      translation: parsed.translation || undefined,
    };

    return result;
  } catch (error) {
    console.error('[parseAnalysisResult] 解析失败:', error, '原始内容:', content);
    const categories: SentimentAnalysisResult['categories'] = { touching: 20, funny: 10, blessing: 20, cultural: 10 };
    return {
      score: 20,
      categories,
      primaryCategory: 'blessing',
      emotion: 'neutral',
      tags: [],
    };
  }
}

/**
 * 分析单条留言
 *
 * @param message 留言内容
 * @returns 分析结果
 */
export async function analyzeMessage(message: string): Promise<SentimentAnalysisResult> {
  if (!message || message.trim().length < 10) {
    const categories: SentimentAnalysisResult['categories'] = { touching: 20, funny: 10, blessing: 30, cultural: 10 };
    return {
      score: computeScore(categories),
      categories,
      primaryCategory: 'blessing',
      emotion: 'neutral',
      tags: ['简短'],
    };
  }

  try {
    const client = await createOpenAIClient();
    const model = await getAIModel();

    const analysisPrompt = buildAnalysisPrompt(message);

    console.log('[analyzeMessage] ========== AI 分析请求 ==========');
    console.log('[analyzeMessage] 原始留言:', message.substring(0, 200));
    console.log('[analyzeMessage] 完整 Prompt:\n', analysisPrompt);

    const response = await client.chat.completions.create({
      model,
      messages: [
        {
          role: 'system',
          content: '你是情感分析专家，只输出 JSON 格式的分析结果。',
        },
        {
          role: 'user',
          content: analysisPrompt,
        },
      ],
      temperature: 0.3,  // 低温度确保结果稳定
      max_tokens: 800,   // 增加 token 以容纳翻译
    });

    const content = response.choices[0]?.message?.content || '';
    const result = parseAnalysisResult(content);

    console.log('[analyzeMessage] AI 返回:', content.substring(0, 300));
    console.log('[analyzeMessage] 计算得分:', result.score, '| primary:', result.primaryCategory);
    console.log('[analyzeMessage] ========== 分析结束 ==========');

    return result;
  } catch (error) {
    console.error('[analyzeMessage] AI 分析失败:', error);
    const categories: SentimentAnalysisResult['categories'] = { touching: 20, funny: 10, blessing: 20, cultural: 10 };
    return {
      score: 20,
      categories,
      primaryCategory: 'blessing',
      emotion: 'neutral',
      tags: [],
    };
  }
}

/**
 * 批量分析多条留言
 *
 * @param messages 留言数组 [{id, message, ...}]
 * @param onProgress 进度回调 (current, total)
 * @returns 分析结果数组
 */
export async function analyzeMessagesBatch<T extends { id: string; message: string }>(
  messages: T[],
  onProgress?: (current: number, total: number) => void
): Promise<Array<T & { analysis: SentimentAnalysisResult }>> {
  const results: Array<T & { analysis: SentimentAnalysisResult }> = [];

  for (let i = 0; i < messages.length; i++) {
    const item = messages[i];

    try {
      const analysis = await analyzeMessage(item.message);
      results.push({ ...item, analysis });

      // 触发进度回调
      if (onProgress) {
        onProgress(i + 1, messages.length);
      }

      // 添加小延迟避免请求过快
      if (i < messages.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    } catch (error) {
      console.error(`[analyzeMessagesBatch] 分析失败：${item.id}`, error);
      const categories: SentimentAnalysisResult['categories'] = { touching: 20, funny: 10, blessing: 20, cultural: 10 };
      results.push({
        ...item,
        analysis: {
          score: 20,
          categories,
          primaryCategory: 'blessing',
          emotion: 'neutral',
          tags: [],
        },
      });
    }
  }

  return results;
}

/**
 * 根据分类筛选分析结果
 */
export function filterByCategory(
  analyses: SentimentAnalysisResult[],
  category: 'touching' | 'funny' | 'blessing' | 'cultural',
  minConfidence: number = 60
): SentimentAnalysisResult[] {
  return analyses.filter(a =>
    a.primaryCategory === category &&
    a.categories[category] >= minConfidence
  );
}

/**
 * 排序分析结果（按评分降序）
 */
export function sortByScore(
  analyses: Array<{ analysis: SentimentAnalysisResult } & Record<string, any>>
): typeof analyses {
  return analyses.sort((a, b) => b.analysis.score - a.analysis.score);
}
