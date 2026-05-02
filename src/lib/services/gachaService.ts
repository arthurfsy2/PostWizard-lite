import { PrismaClient } from '@prisma/client';
import { getConfigForPurpose } from './ai-config';

const prisma = new PrismaClient();

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
export async function generateAIEvaluation(content: string): Promise<AIEvaluation> {
  try {
    // 从数据库动态获取 AI 配置
    const aiConfig = await getConfigForPurpose('text');
    
    if (!aiConfig.apiKey) {
      throw new Error('AI API key not configured');
    }

    const prompt = `你是一位专业的明信片内容评价师。请对以下明信片的 3 个维度独立评分（每项 0-100），并给出正面评价。

## 3 个维度（独立评分，可以同时高分）：

| 维度 | 含义 | 低分特征 | 高分特征 |
|------|------|----------|----------|
| **touchingScore**（走心） | 真情实感、个人故事、深度共鸣 | 泛泛感谢、客套话 | 有个人故事、情感脆弱、让人共鸣 |
| **emotionalScore**（情感温度） | 真诚祝愿、有温度的祝福 | 模板化万能祝福 | 针对收信人的真诚期盼，包含情感词 |
| **culturalInsightScore**（文化洞察） | 本地视角、文化对比、个人解读 | 景点介绍、百科式陈述 | 本地人视角、非显而易见的事实 |

## 评分锚点（严格对标）：

**touchingScore（走心）：**
- 5-20：只有感谢，无个人情感
- 30-50：简单回应，有礼貌但不深入
- 60-80：提及个人细节，但未展开（爱好、宠物、天气、年龄）
- 85+：满足以下任一——
  · 有完整故事或人生片段（职业经历、家庭故事、生活转折）
  · 情感脆弱（坦承困境、疲惫、思念、遗憾）
  · 有跨越距离的共鸣感（"让我想起…"、"我也有过…"）
  · 给出基于亲身经历的建议或感悟

**emotionalScore（情感温度）：**
- 5-20：模板化万能祝福，换任何人都能用（"祝你幸福快乐健康"）
- 30-60：有针对性，但仍是常见套路（"祝骑行顺利"、"Happy Postcrossing"）
- 70+：满足以下任一——
  · 祝福针对收信人的具体情况（孩子、爱好、处境）
  · 用了非母语表达祝福（多语言切换的努力感）
  · 结合自身文化给出特色祝福（节日传统、本地习俗）
  · 包含真诚的情感词或祈愿（不只是"best wishes"）

**culturalInsightScore（文化洞察）：**
- 5-20：没有文化内容
- 30-50：提及文化元素但停留在表面（景点名称、国家名、"I live in X"）
- 60-75：有文化内容但属于百科式（介绍本地节日、历史年份、传统习俗——有信息量但无个人视角）
- 85+：满足以下任一——
  · 本地人视角的非显而易见知识
  · 跨文化对比或个人解读
  · 分享文化细节并解释"为什么"

## Few-shot 示例：

**明信片**: "Thanks for the card! Happy Postcrossing! Hope you have a great day!"
→ touching=15, emotional=35, culturalInsight=5

**明信片**: "你好！这是我第一次寄明信片到中国，希望你能喜欢。今天东京下雪了，很美。祝你新年快乐！"
→ touching=35, emotional=55, culturalInsight=40

**明信片**: "我是一名退休教师，看到你也是老师，感到特别亲切。教育是一份神圣的工作，我们把最好的年华都献给了讲台。希望你桃李满天下！"
→ touching=75, emotional=60, culturalInsight=10

**明信片**: "收到你的卡片时我正在医院陪护母亲，你的祝福让我忍不住落泪。谢谢你，陌生人。世界因为有你这样温暖的人而美好。"
→ touching=95, emotional=50, culturalInsight=5

**明信片**: "作为柏林人，我想告诉你一个游客不知道的事：柏林墙倒塌那晚，我父亲骑着自行车穿过检查站，和陌生人拥抱哭泣。这座城市骨子里有一种经历过苦难后的坚韧和自由。"
→ touching=65, emotional=30, culturalInsight=90

**明信片**: "我养了三只猫，它们每天早上轮流踩我脸叫我起床。养猫的人都懂这种甜蜜的折磨。希望你也有毛茸茸的幸福！"
→ touching=55, emotional=65, culturalInsight=5

**明信片**: "I was a prison dental nurse for 20 years, then switched to transport logistics. Life takes funny turns!"
→ touching=82, emotional=25, culturalInsight=10

**明信片**: "In Finland we celebrate Christmas on the 24th, and we go to the sauna before dinner. It's our family tradition for 3 generations."
→ touching=40, emotional=55, culturalInsight=75

## 待评价的明信片内容：

"""
${content}
"""

请只输出 JSON（不要解释）：
{
  "touchingScore": <0-100>,
  "emotionalScore": <0-100>,
  "culturalInsightScore": <0-100>,
  "summary": "<1-2句正面评价>",
  "primaryCategory": "<touching|emotional|culturalInsight>"
}

## 重要规则

### primaryCategory 判定
- primaryCategory = 三个维度中得分最高的那个维度

### summary 评价风格
- 用欣赏的眼光看待每张明信片，每一张都是对方花时间手写、花钱买邮票寄出的心意
- 只需突出这张明信片最值得欣赏的亮点
- 禁止使用"建议"、"可以补充"、"如果能...就更好了"等建议性语句
- 禁止使用"缺乏"、"不足"、"有限"、"浅层"、"普通"等否定性词语
- 即使内容简短，也要找到积极的表达角度（如"简洁真挚"、"温馨问候"）
- summary 应为 1-2 句话，语气温暖、正面`;

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

/**
 * 批量 AI 评价（一次请求处理多条明信片）
 */
export async function generateAIEvaluationBatch(
  items: Array<{ id: string; content: string }>,
): Promise<Array<{ id: string; evaluation: AIEvaluation }>> {
  if (items.length === 0) return [];

  const aiConfig = await getConfigForPurpose('text');
  if (!aiConfig.apiKey) {
    return items.map(({ id, content }) => ({ id, evaluation: generateDefaultEvaluation(content) }));
  }

  const batchContent = items.map((item, index) => {
    return `${index + 1}. [${item.id}]\n"""${item.content}"""\n`;
  }).join('\n');

  const prompt = `你是一位专业的明信片内容评价师。请对以下 ${items.length} 张明信片的 3 个维度独立评分（每项 0-100），并给出正面评价。

## 3 个维度（独立评分，可以同时高分）：

| 维度 | 含义 | 低分特征 | 高分特征 |
|------|------|----------|----------|
| **touchingScore**（走心） | 真情实感、个人故事、深度共鸣 | 泛泛感谢、客套话 | 有个人故事、情感脆弱、让人共鸣 |
| **emotionalScore**（情感温度） | 真诚祝愿、有温度的祝福 | 模板化万能祝福 | 针对收信人的真诚期盼，包含情感词 |
| **culturalInsightScore**（文化洞察） | 本地视角、文化对比、个人解读 | 景点介绍、百科式陈述 | 本地人视角、非显而易见的事实 |

## 评分锚点（严格对标）：

**touchingScore（走心）：**
- 5-20：只有感谢，无个人情感
- 30-50：简单回应，有礼貌但不深入
- 60-80：提及个人细节，但未展开（爱好、宠物、天气、年龄）
- 85+：满足以下任一——
  · 有完整故事或人生片段（职业经历、家庭故事、生活转折）
  · 情感脆弱（坦承困境、疲惫、思念、遗憾）
  · 有跨越距离的共鸣感（"让我想起…"、"我也有过…"）
  · 给出基于亲身经历的建议或感悟

**emotionalScore（情感温度）：**
- 5-20：模板化万能祝福，换任何人都能用（"祝你幸福快乐健康"）
- 30-60：有针对性，但仍是常见套路（"祝骑行顺利"、"Happy Postcrossing"）
- 70+：满足以下任一——
  · 祝福针对收信人的具体情况（孩子、爱好、处境）
  · 用了非母语表达祝福（多语言切换的努力感）
  · 结合自身文化给出特色祝福（节日传统、本地习俗）
  · 包含真诚的情感词或祈愿（不只是"best wishes"）

**culturalInsightScore（文化洞察）：**
- 5-20：没有文化内容
- 30-50：提及文化元素但停留在表面（景点名称、国家名、"I live in X"）
- 60-75：有文化内容但属于百科式（介绍本地节日、历史年份、传统习俗——有信息量但无个人视角）
- 85+：满足以下任一——
  · 本地人视角的非显而易见知识
  · 跨文化对比或个人解读
  · 分享文化细节并解释"为什么"

## 示例：
"Thanks for the card!" → touching=15, emotional=35, culturalInsight=5
"退休教师看到你也是老师，感到特别亲切" → touching=75, emotional=60, culturalInsight=10
"柏林墙倒塌那晚，父亲骑自行车穿过检查站" → touching=65, emotional=30, culturalInsight=90

## 待评价的明信片内容：

${batchContent}

请只输出 JSON 数组（不要解释，按输入顺序）：
[{"touchingScore":<0-100>,"emotionalScore":<0-100>,"culturalInsightScore":<0-100>,"summary":"<1-2句正面评价>","primaryCategory":"<touching|emotional|culturalInsight>"}]

## 重要规则
- primaryCategory = 三个维度中得分最高的那个维度
- summary：用欣赏的眼光，突出亮点，禁止否定性词语，1-2句话`;

  try {
    const response = await fetch(aiConfig.baseUrl + '/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${aiConfig.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: aiConfig.model,
        messages: [
          { role: 'system', content: '你是一个专业的明信片内容评价助手，只输出 JSON。' },
          { role: 'user', content: prompt },
        ],
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      throw new Error(`API request failed: ${response.status}`);
    }

    const data = await response.json();
    const aiResponse = data.choices?.[0]?.message?.content || data.output?.choices?.[0]?.message?.content;
    if (!aiResponse) throw new Error('Empty AI response');

    const jsonMatch = aiResponse.match(/\[[\s\S]*\]/);
    if (!jsonMatch) throw new Error('Invalid AI response format');

    const parsedArray = JSON.parse(jsonMatch[0]);

    return items.map(({ id, content }, index) => {
      const parsed = parsedArray[index];
      if (!parsed) return { id, evaluation: generateDefaultEvaluation(content) };

      const evaluation: AIEvaluation = {
        touchingScore: Math.min(100, Math.max(0, Math.round(parsed.touchingScore || 0))),
        emotionalScore: Math.min(100, Math.max(0, Math.round(parsed.emotionalScore || 0))),
        culturalInsightScore: Math.min(100, Math.max(0, Math.round(parsed.culturalInsightScore || 0))),
        summary: parsed.summary || '这是一张用心书写的明信片。',
        primaryCategory: parsed.primaryCategory || 'emotional',
      };

      // 验证 primaryCategory
      const validCategories = ['touching', 'culturalInsight', 'emotional'] as const;
      if (!validCategories.includes(evaluation.primaryCategory as any)) {
        const scores = { touching: evaluation.touchingScore, emotional: evaluation.emotionalScore, culturalInsight: evaluation.culturalInsightScore };
        evaluation.primaryCategory = (Object.entries(scores).sort((a, b) => b[1] - a[1])[0][0]) as typeof evaluation.primaryCategory;
      }

      return { id, evaluation };
    });
  } catch (error) {
    console.error('[GachaService] Batch evaluation failed, using fallback:', (error as Error).message);
    return items.map(({ id, content }) => ({ id, evaluation: generateDefaultEvaluation(content) }));
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
    const modelName = (await getConfigForPurpose('text')).model;
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
        model: modelName,
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
  
}

// 导出单例
export const gachaService = new GachaService();

