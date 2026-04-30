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
    emotional: number;               // 情感温度 (0-100)
    culturalInsight: number;         // 文化洞察 (0-100)
  };
  primaryCategory: 'touching' | 'emotional' | 'culturalInsight';
  emotion: 'positive' | 'neutral' | 'negative';
  tags: string[];                    // 关键词标签 (3-5 个)
  translation?: string;              // 中文翻译（可选，非英文留言时填充）
  _source?: 'rule-engine' | 'ai' | 'fallback';  // 打分来源标记（fallback = JSON 解析失败默认值）
}

/**
 * 构建 AI 分析 Prompt
 *
 * 设计原则：
 * - 3 个维度独立评分，可以同时高分（一条留言可以既走心又有情感温度）
 * - 最终 score = max(categories)，取最好的那一面作为精选分数
 * - AI 只负责评分，不负责汇总（汇总逻辑透明可控）
 */
function buildAnalysisPrompt(message: string): string {
  return `你是一位专业的明信片留言情感分析师。请对留言的 3 个维度独立评分（每项 0-100）。

## 3 个维度（独立评分，可以同时高分）：

| 维度 | 含义 | 低分特征 | 高分特征 |
|------|------|----------|----------|
| **touching**（走心） | 真情实感、个人故事、深度共鸣 | 泛泛感谢、客套话 | 有个人故事、情感脆弱、让人共鸣 |
| **emotional**（情感温度） | 真诚祝愿、有温度的祝福 | 模板化万能祝福 | 针对收信人的真诚期盼，包含情感词 |
| **culturalInsight**（文化洞察） | 本地视角、文化对比、个人解读 | 景点介绍、百科式陈述 | 本地人视角、非显而易见的事实 |

## 评分锚点（严格对标）：

**touching（走心）：**
- 5-20：只有感谢，无个人情感
- 30-50：简单回应，有礼貌但不深入
- 60-80：提及个人细节（骑行、宠物、天气）
- 85+：有故事、情感脆弱、让人共鸣

**emotional（情感温度）：**
- 5-20：模板化万能祝福（"wishing you health, happiness, love and joy"）
- 30-60：普通祝福，有针对性但不算真诚
- 70+：包含情感词（strength, comfort, warmth, hope you feel），有温度

**culturalInsight（文化洞察）：**
- 5-20：没有文化内容
- 30-60：景点介绍（"The Eiffel Tower is in Paris"）
- 70+：本地人视角（"What strikes me about my hometown is..."），文化对比，个人解读

## Few-shot 示例：

**留言**: "Hi, thanks for the card! Happy Postcrossing!"
→ touching=20, emotional=40, culturalInsight=5

**留言**: "恭喜你的宝宝！我有三个孩子，趁他们还小好好享受吧，时间眨眼就过去了！"
→ touching=80, emotional=50, culturalInsight=5

**留言**: "你的卡片让我想起我祖母…收到你的卡片时我哭了，那种温暖的感觉一模一样。"
→ touching=95, emotional=40, culturalInsight=5

**留言**: "What tourists don't know about Tokyo is that the best ramen shops are in residential areas."
→ touching=30, emotional=20, culturalInsight=75

**留言**: "谢谢你的卡片和邮票！祝骑行顺利，注意安全！"
→ touching=30, emotional=60, culturalInsight=5

## 待分析的留言：

"""
${message}
"""

请只输出 JSON（不要解释，不要输出 score 字段）：
{
  "categories": {
    "touching": <0-100>,
    "emotional": <0-100>,
    "culturalInsight": <0-100>
  },
  "emotion": "<positive/neutral/negative>",
  "tags": ["<中文标签1>", "<中文标签2>", "<中文标签3>"],
  "translation": "<中文翻译，保留完整语义，如果是中文则留空>"
}`;
}

/**
 * 从 categories 计算综合评分 = max(categories)
 */
function computeScore(categories: SentimentAnalysisResult['categories']): number {
  return Math.max(categories.touching, categories.emotional, categories.culturalInsight);
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
      emotional: Math.min(100, Math.max(0, Math.round(parsed.categories?.emotional || 0))),
      culturalInsight: Math.min(100, Math.max(0, Math.round(parsed.categories?.culturalInsight || 0))),
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
    const categories: SentimentAnalysisResult['categories'] = { touching: 20, emotional: 20, culturalInsight: 10 };
    return {
      score: 20,
      categories,
      primaryCategory: 'emotional',
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
    const categories: SentimentAnalysisResult['categories'] = { touching: 20, emotional: 30, culturalInsight: 10 };
    return {
      score: computeScore(categories),
      categories,
      primaryCategory: 'emotional',
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
    const categories: SentimentAnalysisResult['categories'] = { touching: 20, emotional: 20, culturalInsight: 10 };
    return {
      score: 20,
      categories,
      primaryCategory: 'emotional',
      emotion: 'neutral',
      tags: [],
    };
  }
}

/**
 * 独立翻译单条留言（仅翻译，不评分）
 * 用于补全缺失的翻译
 */
export async function translateMessage(message: string): Promise<string | null> {
  if (!message || message.trim().length < 5) return null;

  // 纯中文/繁体不需要翻译
  const nonAsciiRatio = (message.match(/[^\x00-\x7F]/g) || []).length / message.length;
  if (nonAsciiRatio > 0.5) return null;

  try {
    const client = await createOpenAIClient();
    const model = await getAIModel();

    const response = await client.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: '你是专业翻译，只输出中文翻译结果，不要解释。' },
        { role: 'user', content: `将以下英文留言翻译为中文，保留完整语义和情感：\n\n${message}` },
      ],
      temperature: 0.3,
      max_tokens: 500,
    });

    const translation = response.choices[0]?.message?.content?.trim();
    return translation || null;
  } catch (error) {
    console.error('[translateMessage] 翻译失败:', (error as Error).message);
    return null;
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
      const categories: SentimentAnalysisResult['categories'] = { touching: 20, emotional: 20, culturalInsight: 10 };
      results.push({
        ...item,
        analysis: {
          score: 20,
          categories,
          primaryCategory: 'emotional',
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
  category: 'touching' | 'emotional' | 'culturalInsight',
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

/**
 * 规则判断：模板话术检测（非 AI 调用，零 token 消耗）
 * 
 * 识别低质量、泛泛感谢的留言
 */
export function isTemplateMessage(content: string): boolean {
  const templatePatterns = [
    /^(thanks|thank you|gracias|danke|merci|grazie|спасибо|谢谢)/i,  // 仅以感谢开头
    /^(hi|hello|hey),?\s+(thanks|thank you)/i,  // 问候 + 感谢
    /^(happy postcrossing|enjoy|cheers|best)/i,  // 模板结尾
    /^(thanks|thank you) for (the|your) (card|postcard|stamp)/i,  // 感谢卡片
  ];
  return templatePatterns.some(p => p.test(content.trim()));
}

/**
 * 规则分析：基于关键词和句式的快速判断（零 AI 调用）
 * 
 * 定位：仅针对极短文本（<60字符）进行快速淘汰，中长文本（>=60字符）全部交由 AI 分析
 * 
 * @returns 规则判断结果，或 null（规则无法判断，需调用 AI）
 */
export function analyzeByRules(message: string): SentimentAnalysisResult | null {
  if (!message || message.trim().length < 10) {
    // 太短的留言，直接返回低分
    const categories: SentimentAnalysisResult['categories'] = { touching: 20, emotional: 30, culturalInsight: 10 };
    return {
      score: 30,
      categories,
      primaryCategory: 'emotional',
      emotion: 'neutral',
      tags: ['简短'],
      _source: 'rule-engine', // 标记来源
    };
  }

  const msg = message.trim();
  const msgLength = msg.length;

  // 极短留言（<40字符）进行模板话术检测
  if (isTemplateMessage(msg) && msgLength < 40) {
    // 区分纯感谢 vs 有额外内容
    const hasExtra = msg.replace(/^(hi|hello|hey),?\s*/i, '')
      .replace(/(thanks|thank you)[^.!?]*/i, '')
      .replace(/(happy postcrossing|best wishes|cheers|enjoy|good luck|take care)/gi, '')
      .replace(/[!.🤗🍀❤️\s]/g, '').length > 15;

    const categories: SentimentAnalysisResult['categories'] = hasExtra
      ? { touching: 30, emotional: 50, culturalInsight: 10 }
      : { touching: 15, emotional: 35, culturalInsight: 5 };

    return {
      score: Math.max(categories.touching, categories.emotional, categories.culturalInsight),
      categories,
      primaryCategory: 'emotional',
      emotion: 'positive',
      tags: hasExtra ? ['问候', '祝福'] : ['模板', '感谢'],
      _source: 'rule-engine',
    };
  }

  // 中长文本（>=40字符）交由 AI 分析
  return null;
}

/**
 * 批量分析多条留言（优化版：规则优先 + 批量 AI）
 * 
 * @param messages 留言数组
 * @param batchSize 每批处理数量（默认 20）
 * @param onProgress 进度回调
 * @param concurrency 并行请求数（默认 3，避免触发 API 限流）
 * @returns 分析结果数组
 */
export async function analyzeMessagesBatchOptimized<T extends { id: string; message: string }>(
  messages: T[],
  batchSize: number = 5,
  onProgress?: (current: number, total: number) => void,
  concurrency: number = 3,
  onBatchComplete?: (batch: Array<T & { analysis: SentimentAnalysisResult }>) => void
): Promise<Array<T & { analysis: SentimentAnalysisResult }>> {
  const results: Array<T & { analysis: SentimentAnalysisResult }> = [];
  let processedCount = 0;

  // 1. 先用规则判断（零 AI 调用）
  const ruleResults: Array<T & { analysis: SentimentAnalysisResult }> = [];
  const aiCandidates: T[] = [];

  for (const msg of messages) {
    const ruleResult = analyzeByRules(msg.message);
    if (ruleResult) {
      ruleResults.push({ ...msg, analysis: ruleResult });
      processedCount++;
      if (onProgress) {
        onProgress(processedCount, messages.length);
      }
    } else {
      aiCandidates.push(msg);
    }
  }

  // 规则引擎结果立即回调
  if (ruleResults.length > 0 && onBatchComplete) {
    onBatchComplete(ruleResults);
  }

  console.log(`[批量分析] 规则判断：${ruleResults.length}/${messages.length} 条（仅短文本），需 AI 分析：${aiCandidates.length} 条`);

  // 2. 分批
  const batches: T[][] = [];
  for (let i = 0; i < aiCandidates.length; i += batchSize) {
    batches.push(aiCandidates.slice(i, i + batchSize));
  }

  console.log(`[批量分析] 共 ${batches.length} 个批次，并行度：${concurrency}`);

  // 3. 串行处理批次（429 退避重试，避免并发加剧限流）
  const processBatch = async (batch: T[], retries = 3): Promise<Array<T & { analysis: SentimentAnalysisResult }>> => {
    const batchIds = batch.map(b => b.id).join(', ');
    console.log(`[processBatch] 开始处理批次 [${batchIds}]，剩余重试: ${retries}`);
    try {
      const batchAnalysis = await analyzeBatchWithAI(batch);
      console.log(`[processBatch] 批次 [${batchIds}] 完成，${batchAnalysis.length} 条结果`);
      return batchAnalysis;
    } catch (error) {
      const is429 = (error as any)?.status === 429 || (error as Error).message?.includes('429');
      if (is429 && retries > 0) {
        const delay = (4 - retries) * 5000; // 5s, 10s, 15s 递增
        console.log(`[批量分析] 429 限流，${delay / 1000}s 后重试（剩余 ${retries} 次）...`);
        await new Promise(r => setTimeout(r, delay));
        return processBatch(batch, retries - 1);
      }
      console.error(`[processBatch] 批次 [${batchIds}] 失败，回退规则引擎。错误:`, (error as Error).message);
      // 429 或其他错误：用规则引擎兜底，不逐条调用 AI
      return batch.map(item => {
        const ruleResult = analyzeByRules(item.message);
        if (ruleResult) return { ...item, analysis: ruleResult };
        const categories: SentimentAnalysisResult['categories'] = { touching: 20, emotional: 20, culturalInsight: 10 };
        return {
          ...item,
          analysis: {
            score: 20,
            categories,
            primaryCategory: 'emotional' as const,
            emotion: 'neutral' as const,
            tags: [],
            _source: 'fallback' as const,
          },
        };
      });
    }
  };

  // 串行执行：每批处理完后等待 1s，避免触发限流
  for (let i = 0; i < batches.length; i += concurrency) {
    const parallelBatches = batches.slice(i, i + concurrency);
    console.log(`[批量分析] 启动第 ${Math.floor(i / concurrency) + 1} 轮，${parallelBatches.length} 个并行批次`);
    const batchResults = await Promise.all(parallelBatches.map(batch => processBatch(batch)));
    console.log(`[批量分析] 第 ${Math.floor(i / concurrency) + 1} 轮完成`);

    for (const batchResult of batchResults) {
      results.push(...batchResult);
      processedCount += batchResult.length;
      if (onProgress) {
        onProgress(processedCount, messages.length);
      }
      // 每批完成立即回调，供调用方实时入库
      if (onBatchComplete) {
        onBatchComplete(batchResult);
      }
    }

    // 批次间延迟
    if (i + concurrency < batches.length) {
      await new Promise(r => setTimeout(r, 1500));
    }
  }

  // 4. 合并结果（规则 + AI）
  return [...ruleResults, ...results];
}

/**
 * 批量 AI 分析（一次请求处理多条留言）
 */
async function analyzeBatchWithAI<T extends { id: string; message: string }>(
  batch: T[]
): Promise<Array<T & { analysis: SentimentAnalysisResult }>> {
  const client = await createOpenAIClient();
  const model = await getAIModel();

  // 构建批量 Prompt
  const batchContent = batch.map((item, index) => {
    return `${index + 1}. [${item.id}]\n"""${item.message}"""\n`;
  }).join('\n');

  const prompt = `你是一位专业的明信片留言情感分析师。请对以下 ${batch.length} 条留言的 3 个维度独立评分（每项 0-100）。

## 3 个维度（独立评分，可以同时高分）：

| 维度 | 含义 | 低分特征 | 高分特征 |
|------|------|----------|----------|
| **touching**（走心） | 真情实感、个人故事、深度共鸣 | 泛泛感谢、客套话 | 有个人故事、情感脆弱、让人共鸣 |
| **emotional**（情感温度） | 真诚祝愿、有温度的祝福 | 模板化万能祝福 | 针对收信人的真诚期盼，包含情感词 |
| **culturalInsight**（文化洞察） | 本地视角、文化对比、个人解读 | 景点介绍、百科式陈述 | 本地人视角、非显而易见的事实 |

## 评分锚点：

**touching（走心）：**
- 5-20：只有感谢，无个人情感
- 30-50：简单回应，有礼貌但不深入
- 60-80：提及个人细节（骑行、宠物、天气）
- 85+：有故事、情感脆弱（心理健康、家庭压力）、让人共鸣

**emotional（情感温度）：**
- 5-20：模板化万能祝福（"wishing you health, happiness, love and joy"）
- 30-60：普通祝福，有针对性但不算真诚
- 70+：包含情感词（strength, comfort, warmth, hope you feel），有温度

**culturalInsight（文化洞察）：**
- 5-20：没有文化内容
- 30-60：景点介绍（"The Eiffel Tower is in Paris"）
- 70+：本地人视角（"What strikes me about my hometown is..."），文化对比，个人解读

## 示例：
"Hi, thanks for the card!" → touching=20, emotional=40, culturalInsight=5
"恭喜宝宝！趁他们还小好好享受吧" → touching=80, emotional=50, culturalInsight=5

## 待分析的留言：

${batchContent}

请只输出 JSON 数组（不要解释，不要换行，按输入顺序）：
[{"categories":{"touching":<0-100>,"emotional":<0-100>,"culturalInsight":<0-100>},"emotion":"<positive/neutral/negative>","tags":["<中文标签1>","<中文标签2>"],"translation":"<中文翻译，保留完整语义，如果是中文则留空>"}]`;

  console.log(`[analyzeBatchWithAI] 开始批量分析 ${batch.length} 条留言，prompt 长度: ${prompt.length} 字符`);

  let content = '';
  try {
    const startTime = Date.now();
    console.log(`[analyzeBatchWithAI] 调用 AI API... (${batch.map(b => b.id).join(', ')})`);
    const response = await client.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: '你是情感分析专家，只输出 JSON 格式的分析结果。' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.3,
      max_tokens: 2048,
    });
    content = response.choices[0]?.message?.content || '';
    console.log(`[analyzeBatchWithAI] AI 返回 ${content.length} 字符，耗时 ${Date.now() - startTime}ms`);
  } catch (apiError) {
    console.error(`[analyzeBatchWithAI] API 调用失败:`, (apiError as Error).message, (apiError as any)?.status);
    throw apiError; // 让外层 processBatch 捕获并 fallback
  }
  
  // 解析批量结果
  try {
    const jsonMatch = content.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
    const jsonStr = jsonMatch ? jsonMatch[1] : content;
    const cleanJson = jsonStr.replace(/^\s*\[/, '[').replace(/\]\s*$/, ']');
    const parsedArray = JSON.parse(cleanJson);

    return buildBatchResults(batch, parsedArray);
  } catch (parseError) {
    console.warn('[analyzeBatchWithAI] JSON 解析失败，回退到规则引擎。错误:', (parseError as Error).message);
    console.warn('[analyzeBatchWithAI] 原始 AI 返回前 500 字符:', content.substring(0, 500));
    // 回退到规则引擎，不再逐条调用 AI（避免雪崩）
    return batch.map(item => {
      const ruleResult = analyzeByRules(item.message);
      if (ruleResult) return { ...item, analysis: ruleResult };
      const categories: SentimentAnalysisResult['categories'] = { touching: 20, emotional: 20, culturalInsight: 10 };
      return {
        ...item,
        analysis: {
          score: 20,
          categories,
          primaryCategory: 'emotional' as const,
          emotion: 'neutral' as const,
          tags: [],
          _source: 'fallback' as const,
        },
      };
    });
  }
}

/**
 * 构建批量分析结果
 */
function buildBatchResults<T extends { id: string; message: string }>(
  batch: T[],
  parsedArray: any[]
): Array<T & { analysis: SentimentAnalysisResult }> {
  return batch.map((item, index) => {
    const parsed = parsedArray[index];

    if (!parsed) {
      const categories: SentimentAnalysisResult['categories'] = { touching: 20, emotional: 20, culturalInsight: 10 };
      return {
        ...item,
        analysis: { score: 20, categories, primaryCategory: 'emotional', emotion: 'neutral', tags: [], _source: 'ai' },
      };
    }

    const categories: SentimentAnalysisResult['categories'] = {
      touching: Math.min(100, Math.max(0, Math.round(parsed.categories?.touching || 0))),
      emotional: Math.min(100, Math.max(0, Math.round(parsed.categories?.emotional || 0))),
      culturalInsight: Math.min(100, Math.max(0, Math.round(parsed.categories?.culturalInsight || 0))),
    };

    const entries = Object.entries(categories) as [SentimentAnalysisResult['primaryCategory'], number][];
    const [top] = entries.sort((a, b) => b[1] - a[1]);

    return {
      ...item,
      analysis: {
        score: Math.max(categories.touching, categories.emotional, categories.culturalInsight),
        categories,
        primaryCategory: top[0],
        emotion: parsed.emotion || 'neutral',
        tags: Array.isArray(parsed.tags) ? parsed.tags.slice(0, 5) : [],
        translation: parsed.translation || undefined,
        _source: 'ai', // AI 分析标记
      },
    };
  });
}
