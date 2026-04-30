import { PrismaClient } from '@prisma/client';
import { getAIConfigFromDB } from './ai-config';

const prisma = new PrismaClient();

// 稀有度概率配置
const RARITY_PROBABILITIES = {
  SSR: 0.05, // 5%
  SR: 0.15,  // 15%
  R: 0.40,   // 40%
  N: 0.40,   // 40%
};

// 稀有度配置
export interface RarityConfig {
  name: string;
  probability: number;
  minScore: number;
  color: string;
  glowColor: string;
}

export const RARITY_CONFIG: Record<string, RarityConfig> = {
  SSR: {
    name: 'SSR',
    probability: 0.05,
    minScore: 240,  // 三维度总分 >= 240 (均分 80+)
    color: '#FFD700',
    glowColor: 'rgba(255, 215, 0, 0.6)',
  },
  SR: {
    name: 'SR',
    probability: 0.15,
    minScore: 180,  // 三维度总分 >= 180 (均分 60+)
    color: '#C0C0C0',
    glowColor: 'rgba(192, 192, 192, 0.5)',
  },
  R: {
    name: 'R',
    probability: 0.40,
    minScore: 120,  // 三维度总分 >= 120 (均分 40+)
    color: '#CD7F32',
    glowColor: 'rgba(205, 127, 50, 0.4)',
  },
  N: {
    name: 'N',
    probability: 0.40,
    minScore: 0,
    color: '#888888',
    glowColor: 'rgba(136, 136, 136, 0.3)',
  },
};

// AI 评价（与收信 sentiment analysis 统一的三维度体系）
export interface AIEvaluation {
  touchingScore: number;        // 最走心 (0-100)
  emotionalScore: number;       // 情感温度 (0-100)
  culturalInsightScore: number; // 文化洞察 (0-100)
  summary: string;
  primaryCategory: 'touching' | 'culturalInsight' | 'emotional';
}

// 幸运等级类型（三级体系）
export type LuckyLevel = 'none' | 'lucky' | 'special' | 'superLucky';

// 抽卡结果（简化版）
export interface GachaResult {
  rarity?: 'SSR' | 'SR' | 'R' | 'N';
  cardName?: string;  // 例如："SSR 级明信片"
  description?: string;  // AI 评价摘要
  imageUrl?: string;  // 可选，不再强制
  category?: string;
  aiEvaluation?: AIEvaluation;
  isDuplicate?: boolean;  // 是否重复抽卡
  message?: string;  // 提示信息
  luckyLevel?: LuckyLevel;  // 幸运等级
  luckyBonus?: number;  // 幸运加分
}

// 分析 Lucky 等级（扑克牌型体系，要求聚集检测）
function analyzeLuckyLevel(postcardId: string): {
  level: LuckyLevel;
  bonus: number;
  reason: string;
  label: string;
} {
  const numbers = postcardId.replace(/[^0-9]/g, '');

  if (numbers.length < 2) {
    return { level: 'none', bonus: 0, reason: '', label: '' };
  }

  // 提取所有连续相同数字的游程 [{ digit, len }]
  const runs: { digit: string; len: number }[] = [];
  let i = 0;
  while (i < numbers.length) {
    let j = i + 1;
    while (j < numbers.length && numbers[j] === numbers[i]) j++;
    runs.push({ digit: numbers[i], len: j - i });
    i = j;
  }

  const maxRun = Math.max(...runs.map(r => r.len));

  // ===== 🃏 扑克牌型检测（按稀有度从高到低，要求聚集）=====

  // Five of a Kind: 连续 5+ 个相同数字 → +20
  if (maxRun >= 5) {
    return {
      level: 'superLucky',
      bonus: 20,
      reason: '🃏 五条！Postcard ID 包含 5 个连续相同数字',
      label: 'Five of a Kind!'
    };
  }

  // Four of a Kind: 连续 4+ 个相同数字 → +15
  if (maxRun >= 4) {
    return {
      level: 'superLucky',
      bonus: 15,
      reason: '🃏 四条！Postcard ID 包含 4 个连续相同数字',
      label: 'Four of a Kind!'
    };
  }

  // Full House: 一组连续 3+ 相同 + 另一组连续 2+ 相同（不同数字） → +15
  const hasRun3 = runs.some(r => r.len >= 3);
  const hasRun2Other = (digit: string) => runs.some(r => r.digit !== digit && r.len >= 2);
  if (hasRun3) {
    const tripleDigit = runs.find(r => r.len >= 3)!.digit;
    if (hasRun2Other(tripleDigit)) {
      return {
        level: 'superLucky',
        bonus: 15,
        reason: '🃏 葫芦！Postcard ID 包含聚集的 3+2 数字组合',
        label: 'Full House!'
      };
    }
  }

  // Straight: 4位及以上连续递增或递减 → +10
  const straightUp = /1234|2345|3456|4567|5678|6789|12345|23456|34567|45678|56789/;
  const straightDown = /9876|8765|7654|6543|5432|4321|98765|87654|76543|65432|54321/;
  if (straightUp.test(numbers) || straightDown.test(numbers)) {
    return {
      level: 'special',
      bonus: 10,
      reason: '🃏 顺子！Postcard ID 包含 4 位及以上连续数字',
      label: 'Straight!'
    };
  }

  // Three of a Kind: 连续 3 个相同数字 → +10
  if (maxRun >= 3) {
    return {
      level: 'special',
      bonus: 10,
      reason: '🃏 三条！Postcard ID 包含 3 个连续相同数字',
      label: 'Three of a Kind!'
    };
  }

  // Two Pair: 两组相邻的连续 2+ 相同数字（如 3377、8811） → +5
  let hasAdjacentPair = false;
  for (let k = 0; k < runs.length - 1; k++) {
    if (runs[k].len >= 2 && runs[k + 1].len >= 2) { hasAdjacentPair = true; break; }
  }
  if (hasAdjacentPair) {
    return {
      level: 'lucky',
      bonus: 5,
      reason: '🃏 两对！Postcard ID 包含两对相邻的重复数字',
      label: 'Two Pair'
    };
  }

  // Alternate: ABABA 交替模式（两个不同数字交替 5+ 位） → +5
  const altMatch = numbers.match(/(\d)(\d)(?:\1\2)+\1/);
  if (altMatch && altMatch[1] !== altMatch[2]) {
    return {
      level: 'lucky',
      bonus: 5,
      reason: '🃏 交替！Postcard ID 包含 ABABA 交替数字模式',
      label: 'Alternate'
    };
  }

  // Palindrome: 回文模式（ABCBA） → +5
  const len = numbers.length;
  if (len >= 4) {
    const half = Math.floor(len / 2);
    const isPalindrome = numbers.slice(0, half) === numbers.slice(len - half).split('').reverse().join('');
    if (isPalindrome) {
      return {
        level: 'lucky',
        bonus: 5,
        reason: '🃏 回文！Postcard ID 数字呈镜像对称',
        label: 'Palindrome'
      };
    }
  }

  return { level: 'none', bonus: 0, reason: '', label: '' };
}



// 根据三维度总分 (0-300) 计算稀有度
function calculateRarity(totalScore: number): 'SSR' | 'SR' | 'R' | 'N' {
  if (totalScore >= 240) return 'SSR';  // avg 80+
  if (totalScore >= 180) return 'SR';   // avg 60+
  if (totalScore >= 120) return 'R';    // avg 40+
  return 'N';
}

// 使用 Qwen API 生成 AI 评价
async function generateAIEvaluation(content: string): Promise<AIEvaluation> {
  try {
    // 从数据库动态获取 AI 配置
    const aiConfig = await getAIConfigFromDB();
    
    if (!aiConfig.apiKey) {
      throw new Error('AI API key not configured');
    }

    const prompt = `请分析以下明信片内容，从 3 个维度进行评分（每个维度 0-100 分），并给出一段正面评价。

## 评分维度

1. **touchingScore**（最走心）— 情感真挚度、个人故事、走心程度
2. **emotionalScore**（情感温度）— 温暖程度、美好祝愿、正能量传递
3. **culturalInsightScore**（文化洞察）— 文化知识、地域特色、独特视角

## 评分锚点

### touchingScore（最走心）
- 5-20：仅简单感谢或套话（"谢谢你的明信片"）
- 30-50：简单但真诚的问候，有一定个人色彩
- 60-80：包含个人故事、旅行经历、真实情感流露
- 80-100：深刻的情感表达、独特的人生感悟、令人动容的叙述

### emotionalScore（情感温度）
- 5-20：模板化内容，缺乏温度
- 30-50：通用祝福语，有基本善意
- 60-80：真诚的祝愿、温暖的问候、积极的能量
- 80-100：极具感染力的温暖表达、深度共情、让人感到被关怀

### culturalInsightScore（文化洞察）
- 5-20：无任何文化元素
- 30-50：提及基本事实（地名、景点名称等）
- 60-80：包含当地视角、文化背景、历史故事
- 80-100：独特的文化见解、深度的文化分享、令人增长见识的内容

## 明信片内容
"""${content}"""

## 输出格式
请严格返回以下 JSON 格式（不要包含其他内容）：
{
  "touchingScore": 75,
  "emotionalScore": 60,
  "culturalInsightScore": 50,
  "summary": "这是一张充满个人故事的明信片，字里行间流露出真挚的情感。",
  "primaryCategory": "touching"
}

## 重要规则

### summary 评价风格
- 用欣赏的眼光看待每张明信片，每一张都是对方花时间手写、花钱买邮票寄出的心意
- 只需突出这张明信片最值得欣赏的亮点
- 禁止使用"建议"、"可以补充"、"如果能...就更好了"等建议性语句
- 禁止使用"缺乏"、"不足"、"有限"、"浅层"、"普通"等否定性词语
- 即使内容简短，也要找到积极的表达角度（如"简洁真挚"、"温馨问候"）
- summary 应为 1-2 句话，语气温暖、正面

### primaryCategory 判定
- primaryCategory = 三个维度中得分最高的那个维度
- touching：touchingScore 最高
- emotional：emotionalScore 最高
- culturalInsight：culturalInsightScore 最高

### 评分原则
- 每个维度独立评分，0-100 分
- 不要因为某个维度高就压低另一个维度
- 三个分数的总和决定了最终稀有度（SSR: 240+, SR: 180+, R: 120+, N: <120）`;

    const response = await fetch(aiConfig.baseUrl + '/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${aiConfig.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: aiConfig.model,
        messages: [
          { role: 'system', content: '你是一个专业的明信片内容评价助手。' },
          { role: 'user', content: prompt },
        ],
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => '');
      throw new Error(`API request failed: ${response.status} ${errorBody.substring(0, 200)}`);
    }

    const data = await response.json();
    // 兼容 OpenAI 格式和 DashScope 原生格式
    const aiResponse = data.choices?.[0]?.message?.content || data.output?.choices?.[0]?.message?.content;
    
    if (!aiResponse) {
      throw new Error('Empty AI response');
    }

    // 解析 JSON
    const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Invalid AI response format');
    }

    const evaluation: AIEvaluation = JSON.parse(jsonMatch[0]);

    // 验证数据结构
    if (
      typeof evaluation.touchingScore !== 'number' ||
      typeof evaluation.emotionalScore !== 'number' ||
      typeof evaluation.culturalInsightScore !== 'number' ||
      !evaluation.summary
    ) {
      throw new Error('Incomplete evaluation data');
    }

    // 钳位分数到 0-100
    evaluation.touchingScore = Math.min(100, Math.max(0, evaluation.touchingScore));
    evaluation.emotionalScore = Math.min(100, Math.max(0, evaluation.emotionalScore));
    evaluation.culturalInsightScore = Math.min(100, Math.max(0, evaluation.culturalInsightScore));

    // 验证 primaryCategory = 最高分维度
    const validCategories = ['touching', 'culturalInsight', 'emotional'] as const;
    if (!evaluation.primaryCategory || !validCategories.includes(evaluation.primaryCategory as any)) {
      // 自动推导：取最高分维度
      const scores = {
        touching: evaluation.touchingScore,
        emotional: evaluation.emotionalScore,
        culturalInsight: evaluation.culturalInsightScore,
      };
      evaluation.primaryCategory = (Object.entries(scores).sort((a, b) => b[1] - a[1])[0][0]) as typeof evaluation.primaryCategory;
    }

    return evaluation;
  } catch (error) {
    console.error('[GachaService] AI evaluation failed, using fallback:', (error as Error).message);
    return generateDefaultEvaluation(content);
  }
}

// 生成默认评价（AI 失败时使用，基于关键词的三维度 fallback）
function generateDefaultEvaluation(content: string): AIEvaluation {
  const length = content.length;

  // 基于内容特征的关键词检测
  const hasCulture = /文化|历史|传统|风俗|节日|美食|建筑|景点/.test(content);
  const hasEmotion = /喜欢|爱|想念|感动|开心|快乐|幸福|感谢|希望|梦想/.test(content);
  const hasStory = /我|我的|我们|旅行|经历|故事|第一次/.test(content);
  const hasNature = /海|山|花|天空|星星|月亮|太阳|森林|河流/.test(content);

  // touchingScore：基于 hasStory, hasEmotion, length
  let touchingScore = 20;
  if (hasStory) touchingScore += 30;
  if (hasEmotion) touchingScore += 20;
  if (length > 100) touchingScore += 15;
  if (length > 200) touchingScore += 10;
  touchingScore = Math.min(touchingScore, 100);

  // emotionalScore：基于 hasEmotion, hasNature, length
  let emotionalScore = 20;
  if (hasEmotion) emotionalScore += 30;
  if (hasNature) emotionalScore += 15;
  if (length > 80) emotionalScore += 15;
  if (length > 150) emotionalScore += 10;
  emotionalScore = Math.min(emotionalScore, 100);

  // culturalInsightScore：基于 hasCulture, length
  let culturalInsightScore = 15;
  if (hasCulture) culturalInsightScore += 40;
  if (length > 100) culturalInsightScore += 15;
  if (length > 200) culturalInsightScore += 10;
  culturalInsightScore = Math.min(culturalInsightScore, 100);

  // 根据内容特征生成多样化 summary
  const summaryParts: string[] = [];
  if (length > 200) summaryParts.push('这是一封内容详实的明信片');
  else if (length > 100) summaryParts.push('这是一封用心书写的明信片');
  else summaryParts.push('这是一封简洁的明信片');

  if (hasCulture) summaryParts.push('蕴含着丰富的文化气息');
  if (hasEmotion) summaryParts.push('字里行间流露出真挚的情感');
  if (hasNature) summaryParts.push('描绘了美好的自然意象');
  if (hasStory) summaryParts.push('承载着独特的个人故事');

  const summary = summaryParts.join('，') + '。';

  // primaryCategory = 最高分维度
  const scores = {
    touching: touchingScore,
    emotional: emotionalScore,
    culturalInsight: culturalInsightScore,
  };
  const primaryCategory = (Object.entries(scores).sort((a, b) => b[1] - a[1])[0][0]) as 'touching' | 'culturalInsight' | 'emotional';

  return {
    touchingScore,
    emotionalScore,
    culturalInsightScore,
    summary,
    primaryCategory,
  };
}

// 抽卡服务类
export class GachaService {
  // 执行抽卡（简化版：直接用 AI 评价，不再抽取模板卡片）
  async draw(userId: string, postcardId: string, content: string): Promise<GachaResult> {
    // 1. 检查 postcardId 是否已存在（重复检测）
    const existing = await prisma.userGachaLog.findUnique({
      where: { postcardId }
    });
    
    if (existing) {
      // 重复明信片，返回历史评价
      return {
        isDuplicate: true,
        message: '该明信片已经评估过了',
        rarity: existing.rarity as 'SSR' | 'SR' | 'R' | 'N',
        luckyLevel: 'none',
        luckyBonus: 0,
        aiEvaluation: {
          touchingScore: existing.touchingScore || 0,
          emotionalScore: existing.emotionalScore || 0,
          culturalInsightScore: existing.culturalInsightScore || 0,
          summary: existing.summary || '这是一张已收藏的明信片。',
          primaryCategory: (existing.primaryCategory as 'touching' | 'culturalInsight' | 'emotional') || 'emotional',
        },
      };
    }
    
    // 2. 生成 AI 评价
    const aiEvaluation = await generateAIEvaluation(content);

    // 3. 检测 Lucky 等级（仅用于展示，不影响稀有度）
    const luckyInfo = analyzeLuckyLevel(postcardId);

    // 在 summary 中附带幸运信息
    if (luckyInfo.level !== 'none') {
      aiEvaluation.summary += ' ' + luckyInfo.reason;
    }

    // 4. 计算总分和稀有度（lucky 不影响稀有度）
    const totalScore = aiEvaluation.touchingScore + aiEvaluation.emotionalScore + aiEvaluation.culturalInsightScore;
    const rarity = calculateRarity(totalScore);

    // 5. 持久化评估记录到 UserGachaLog
    await prisma.userGachaLog.create({
      data: {
        userId,
        postcardId,
        rarity,
        aiScore: totalScore,
        touchingScore: aiEvaluation.touchingScore,
        emotionalScore: aiEvaluation.emotionalScore,
        culturalInsightScore: aiEvaluation.culturalInsightScore,
        summary: aiEvaluation.summary,
        primaryCategory: aiEvaluation.primaryCategory,
        luckyLevel: luckyInfo.level === 'none' ? null : luckyInfo.level,
        luckyBonus: luckyInfo.bonus || null,
        obtainedAt: new Date(),
      }
    });
    
    return {
      rarity,
      cardName: `${rarity}级明信片`,  // 简化：直接用稀有度命名
      description: aiEvaluation.summary,
      imageUrl: '',  // 不再使用模板图片
      category: '个性化评价',
      aiEvaluation,
      isDuplicate: false,
      luckyLevel: luckyInfo.level,
      luckyBonus: luckyInfo.bonus,
    };
  }
  
  // 获取用户抽卡历史（简化版，不再包含卡片信息）
  async getUserGachaHistory(userId: string, limit: number = 20) {
    return prisma.userGachaLog.findMany({
      where: { userId },
      select: {
        id: true,
        rarity: true,
        postcardId: true,
        obtainedAt: true,
      },
      orderBy: { obtainedAt: 'desc' },
      take: limit,
    });
  }
  
  // 获取用户稀有度统计
  async getUserRarityStats(userId: string) {
    const stats = await prisma.userGachaLog.groupBy({
      by: ['rarity'],
      where: { userId },
      _count: { rarity: true },
    });
    
    const result: Record<string, number> = { SSR: 0, SR: 0, R: 0, N: 0 };
    stats.forEach(stat => {
      result[stat.rarity] = stat._count.rarity;
    });
    
    return result;
  }
  
  // 获取卡池信息
  async getGachaPool() {
    return prisma.gachaPool.findFirst({
      where: { isActive: true },
      include: { cards: { where: { isActive: true } } },
    });
  }
}

// 导出单例
export const gachaService = new GachaService();

