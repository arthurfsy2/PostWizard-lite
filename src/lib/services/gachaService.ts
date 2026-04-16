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
    minScore: 70,  // 调整为70
    color: '#FFD700',
    glowColor: 'rgba(255, 215, 0, 0.6)',
  },
  SR: {
    name: 'SR',
    probability: 0.15,
    minScore: 50,  // 调整为50
    color: '#C0C0C0',
    glowColor: 'rgba(192, 192, 192, 0.5)',
  },
  R: {
    name: 'R',
    probability: 0.40,
    minScore: 30,  // 调整为30
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

// AI 评价维度
export interface Dimension {
  name: string;
  score: number;
  reason: string;
}

export interface AIEvaluation {
  overallScore: number;
  dimensions: Dimension[];
  summary: string;
  suggestedRarity: 'SSR' | 'SR' | 'R' | 'N';
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

// 分析 Lucky 等级（三级体系：Super → Special → Lucky）
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
  
  // ===== Super Lucky 检测（3位+，+15分）=====
  // 3位及以上相同数字：111, 2222, 33333
  if (/(.)\1{2,}/.test(numbers)) {
    return { 
      level: 'superLucky', 
      bonus: 15, 
      reason: '🌟 超级幸运！Postcard ID 包含稀有数字组合（重复数字）',
      label: 'Super Lucky!'
    };
  }
  
  // 4位及以上递增：1234, 5678, 12345
  if (/1234|2345|3456|4567|5678|6789|12345|23456|34567|45678|56789/.test(numbers)) {
    return { 
      level: 'superLucky', 
      bonus: 15, 
      reason: '🌟 超级幸运！Postcard ID 包含稀有数字组合（递增连号）',
      label: 'Super Lucky!'
    };
  }
  
  // 4位及以上递减：9876, 4321, 98765
  if (/9876|8765|7654|6543|5432|4321|98765|87654|76543|65432|54321/.test(numbers)) {
    return { 
      level: 'superLucky', 
      bonus: 15, 
      reason: '🌟 超级幸运！Postcard ID 包含稀有数字组合（递减连号）',
      label: 'Super Lucky!'
    };
  }
  
  // ===== Special 检测（ABAB/AABB/镜像，+10分）=====
  // ABAB 模式：0909, 1212, 2323, 4545
  if (/(\d)(\d)\1\2/.test(numbers)) {
    return { 
      level: 'special', 
      bonus: 10, 
      reason: '💎 特殊！Postcard ID 包含 ABAB 数字模式',
      label: 'Special'
    };
  }
  
  // AABB 模式：5566, 7788, 1122
  if (/(\d)\1(\d)\2/.test(numbers)) {
    return { 
      level: 'special', 
      bonus: 10, 
      reason: '💎 特殊！Postcard ID 包含 AABB 数字模式',
      label: 'Special'
    };
  }
  
  // 镜像模式：1221, 6996, 2332, 9889
  if (/(\d)(\d)\2\1/.test(numbers)) {
    return { 
      level: 'special', 
      bonus: 10, 
      reason: '💎 特殊！Postcard ID 包含镜像数字模式',
      label: 'Special'
    };
  }
  
  // ===== Lucky 检测（2-3位连号，+5分）=====
  if (/123|234|345|456|567|678|789|987|876|765|654|543|432|321/.test(numbers)) {
    return { 
      level: 'lucky', 
      bonus: 5, 
      reason: '🍀 幸运！Postcard ID 包含连号数字',
      label: 'Lucky'
    };
  }
  
  return { level: 'none', bonus: 0, reason: '', label: '' };
}



// 根据内容质量计算稀有度
function calculateRarity(aiScore: number, content: string): 'SSR' | 'SR' | 'R' | 'N' {
  const length = content.length;
  
  // 字数权重
  const lengthScore = Math.min(length / 100 * 20, 20); // 最多 20 分
  
  // 组合分数
  const totalScore = aiScore + lengthScore;
  
  // 根据总分数确定稀有度
  if (totalScore >= 80) return 'SSR';
  if (totalScore >= 60) return 'SR';
  if (totalScore >= 40) return 'R';
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

    const prompt = `请分析以下明信片内容，从 4 个维度进行专业评分（0-100 分）：

1. **内容详实度**（字数、信息量、描述丰富程度）
2. **文化价值**（是否包含历史、地理、文化知识）
3. **个人故事**（是否有情感表达、个人经历）
4. **语言表达**（流畅度、语法正确性、修辞手法）

明信片内容：
"""${content}"""

请返回以下 JSON 格式：
{
  "overallScore": 75,
  "dimensions": [
    { "name": "内容详实度", "score": 80, "reason": "描述详细，字数充足" },
    { "name": "文化价值", "score": 70, "reason": "提及了当地特色" },
    { "name": "个人故事", "score": 75, "reason": "有个人情感表达" },
    { "name": "语言表达", "score": 75, "reason": "语言流畅自然" }
  ],
  "summary": "这是一张充满情感的明信片，内容丰富，值得收藏。",
  "suggestedRarity": "SR"
}

评分标准：
- 内容详实度：字数多、描述详细、信息丰富得分高
- 文化价值：包含历史、地理、风俗、景点等文化元素得分高
- 个人故事：有情感表达、个人经历、独特观点得分高
- 语言表达：语法正确、修辞得当、流畅自然得分高

稀有度判定：
- SSR: 70分以上，内容优秀，值得珍藏
- SR: 50-69分，内容丰富，质量良好
- R: 30-49分，内容普通，标准明信片
- N: 30分以下，内容简短，简单问候`;

    const response = await fetch(aiConfig.baseUrl + '/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${aiConfig.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: aiConfig.model,
        input: {
          messages: [
            { role: 'system', content: '你是一个专业的明信片内容评价助手。' },
            { role: 'user', content: prompt },
          ],
        },
        parameters: {
          result_format: 'message',
          temperature: 0.7,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`API request failed: ${response.status}`);
    }

    const data = await response.json();
    const aiResponse = data.output?.choices?.[0]?.message?.content;
    
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
    if (!evaluation.overallScore || !evaluation.dimensions || !evaluation.summary) {
      throw new Error('Incomplete evaluation data');
    }

    return evaluation;
  } catch (error) {
    // console.error('AI evaluation error:', error);
    // 返回默认评价
    return generateDefaultEvaluation(content);
  }
}

// 生成默认评价（AI 失败时使用）
function generateDefaultEvaluation(content: string): AIEvaluation {
  const length = content.length;
  
  // 基于字数的简单评分
  const detailScore = Math.min(length / 1.5, 100);
  const cultureScore = content.includes('文化') || content.includes('历史') ? 75 : 50;
  const storyScore = content.includes('我') || content.includes('我的') ? 70 : 50;
  const languageScore = 70;
  
  const overallScore = Math.round((detailScore + cultureScore + storyScore + languageScore) / 4);
  
  let rarity: 'SSR' | 'SR' | 'R' | 'N' = 'N';
  if (overallScore >= 80) rarity = 'SSR';
  else if (overallScore >= 60) rarity = 'SR';
  else if (overallScore >= 40) rarity = 'R';
  
  return {
    overallScore,
    dimensions: [
      { name: '内容详实度', score: Math.round(detailScore), reason: length > 100 ? '内容充实详细' : '内容较为简短' },
      { name: '文化价值', score: cultureScore, reason: cultureScore > 60 ? '包含文化元素' : '文化元素较少' },
      { name: '个人故事', score: storyScore, reason: storyScore > 60 ? '有个人情感表达' : '个人故事较少' },
      { name: '语言表达', score: languageScore, reason: '语言流畅自然' },
    ],
    summary: length > 100 
      ? '这是一张内容丰富、充满情感的明信片，展现了寄信人的用心。'
      : '这是一张简洁的明信片，传递着简单的问候与祝福。',
    suggestedRarity: rarity,
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
          overallScore: existing.aiScore || 0,
          dimensions: [
            { name: '内容详实度', score: existing.contentScore || 0, reason: '历史评价' },
            { name: '文化价值', score: existing.cultureScore || 0, reason: '历史评价' },
            { name: '个人故事', score: existing.storyScore || 0, reason: '历史评价' },
            { name: '语言表达', score: 70, reason: '历史评价' },
          ],
          summary: existing.summary || '这是一张已收藏的明信片。',
          suggestedRarity: existing.rarity as 'SSR' | 'SR' | 'R' | 'N',
        },
      };
    }
    
    // 2. 生成 AI 评价
    let aiEvaluation = await generateAIEvaluation(content);
    
    // 3. 添加随机因子（±5分）
    const randomFactor = Math.floor(Math.random() * 11) - 5; // -5 到 +5
    aiEvaluation.overallScore = Math.min(100, Math.max(0, aiEvaluation.overallScore + randomFactor));
    
    // 4. 检测 Lucky 等级
    const luckyInfo = analyzeLuckyLevel(postcardId);
    
    // 5. 应用 Lucky 加分并添加维度
    if (luckyInfo.level !== 'none') {
      aiEvaluation.overallScore = Math.min(100, aiEvaluation.overallScore + luckyInfo.bonus);
      
      // 添加幸运加成维度
      aiEvaluation.dimensions.push({
        name: '幸运加成',
        score: luckyInfo.bonus,
        reason: luckyInfo.reason
      });
      
      // 在 summary 中体现
      aiEvaluation.summary += luckyInfo.level === 'superLucky' 
        ? ' 此外，这张明信片的编号超级幸运！' 
        : ' 此外，这张明信片的编号很lucky！';
    }
    
    // 6. 根据调整后分数重新计算稀有度（使用新阈值）
    const finalScore = aiEvaluation.overallScore;
    let rarity: 'SSR' | 'SR' | 'R' | 'N';
    if (finalScore >= 70) rarity = 'SSR';
    else if (finalScore >= 50) rarity = 'SR';
    else if (finalScore >= 30) rarity = 'R';
    else rarity = 'N';
    
    // 更新 suggestedRarity
    aiEvaluation.suggestedRarity = rarity;
    
    // 7. 持久化评估记录到 UserGachaLog
    await prisma.userGachaLog.create({
      data: {
        userId,
        postcardId,
        rarity,
        aiScore: finalScore,
        contentScore: aiEvaluation.dimensions.find(d => d.name === '内容详实度')?.score,
        cultureScore: aiEvaluation.dimensions.find(d => d.name === '文化价值')?.score,
        storyScore: aiEvaluation.dimensions.find(d => d.name === '个人故事')?.score,
        languageScore: aiEvaluation.dimensions.find(d => d.name === '语言表达')?.score,
        summary: aiEvaluation.summary,
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

