import { prisma } from '../prisma';
import { getAIConfigFromDB } from './ai-config';

/**
 * 素材质量评分接口
 */
export interface QualityScore {
  richness: number;        // 丰富度：内容长度和多样性（0-5）
  specificity: number;     // 具体性：是否有具体细节（0-5）
  matchPotential: number;  // 匹配潜力：与常见兴趣标签的关联度（0-5）
  authenticity: number;    // 真实性：避免模板化（0-5）
  overall: number;         // 综合评分（0-5）
}

/**
 * 评估维度详情
 */
export interface ScoreDetail {
  dimension: string;       // 维度名称
  score: number;          // 分数（0-5）
  maxScore: number;       // 满分
  label: string;          // 显示标签
  description: string;    // 维度说明
  feedback: string;       // 具体反馈
}

/**
 * AI评估结果
 */
export interface QualityEvaluationResult {
  scores: QualityScore;
  details: ScoreDetail[];
  suggestions: string[];
  summary: string;
  starRating: number;      // 星级评分（1-5星）
  isUsable: boolean;       // 是否可用
}

/**
 * 素材数据
 */
export interface MaterialData {
  category: string;
  content: string;
}

/**
 * 素材质量评估服务
 */
export class MaterialQualityService {
  
  /**
   * 从数据库获取 AI 配置（使用统一工具）
   */
  private async getAIConfig() {
    return getAIConfigFromDB();
  }

  /**
   * 评估单个素材的质量
   */
  async evaluateMaterial(category: string, content: string): Promise<QualityEvaluationResult> {
    if (!content || content.trim().length === 0) {
      return this.getEmptyEvaluation();
    }

    const aiConfig = await this.getAIConfig();
    
    if (!aiConfig.apiKey) {
      // 如果没有AI配置，使用规则评估
      return this.evaluateByRules(category, content);
    }

    try {
      return await this.evaluateByAI(category, content, aiConfig);
    } catch (error) {
      // console.error('AI评估失败，降级到规则评估:', error);
      return this.evaluateByRules(category, content);
    }
  }

  /**
   * 批量评估多个素材
   */
  async evaluateMaterials(materials: MaterialData[]): Promise<{
    evaluations: Map<string, QualityEvaluationResult>;
    averageScore: number;
    overallRating: number;
    category: string;
  }> {
    const evaluations = new Map<string, QualityEvaluationResult>();
    let totalScore = 0;
    let validCount = 0;

    for (const material of materials) {
      const evaluation = await this.evaluateMaterial(material.category, material.content);
      evaluations.set(material.category, evaluation);
      
      if (material.content && material.content.trim().length > 0) {
        totalScore += evaluation.scores.overall;
        validCount++;
      }
    }

    const averageScore = validCount > 0 ? totalScore / validCount : 0;
    const overallRating = this.calculateStarRating(averageScore);

    // 生成整体分类
    const category = this.categorizeOverallQuality(averageScore);

    return {
      evaluations,
      averageScore,
      overallRating,
      category,
    };
  }

  /**
   * 使用AI进行质量评估
   */
  private async evaluateByAI(
    category: string, 
    content: string,
    aiConfig: { apiKey: string; baseUrl: string; model: string }
  ): Promise<QualityEvaluationResult> {
    const prompt = this.buildEvaluationPrompt(category, content);

    const response = await fetch(aiConfig.baseUrl + '/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${aiConfig.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: aiConfig.model,
        messages: [
          {
            role: 'system',
            content: '你是一位专业的内容质量评估专家，专门评估Postcrossing明信片素材的质量。'
          },
          {
            role: 'user',
            content: prompt,
          }
        ],
        max_tokens: 1000,
        temperature: 0.3, // 低温度以获得更稳定的评分
      }),
    });

    if (!response.ok) {
      throw new Error(`AI API 错误: ${response.statusText}`);
    }

    const data = await response.json();
    const resultText = data.choices?.[0]?.message?.content || '';

    return this.parseAIResponse(resultText, category, content);
  }

  /**
   * 构建评估Prompt
   */
  private buildEvaluationPrompt(category: string, content: string): string {
    const categoryNames: Record<string, string> = {
      'self_intro': '自我介绍',
      'hobbies': '兴趣爱好',
      'hometown': '家乡介绍',
      'travel_stories': '旅行故事',
      'fun_facts': '有趣故事',
    };

    const categoryName = categoryNames[category] || category;

    return `请评估以下Postcrossing明信片素材的质量。

【素材分类】: ${categoryName}
【素材内容】: 
"""
${content}
"""

请从以下4个维度进行评估，每个维度给出0-5分的评分和具体反馈：

1. **丰富度(Richness)**: 内容长度是否充足，信息是否多样
   - 5分: 内容丰富，有多层信息
   - 3分: 内容适中，基本信息完整
   - 1分: 内容过于简短

2. **具体性(Specificity)**: 是否有具体细节，而非泛泛而谈
   - 5分: 有具体的时间/地点/事件/数字
   - 3分: 有一定细节但不够具体
   - 1分: 过于笼统，缺乏具体信息

3. **匹配潜力(Match Potential)**: 内容与常见兴趣标签的关联度
   - 5分: 能与多种常见兴趣匹配(旅行/摄影/美食/阅读等)
   - 3分: 能与部分兴趣匹配
   - 1分: 难以与兴趣标签建立关联

4. **真实性(Authenticity)**: 是否真实自然，避免模板化
   - 5分: 真实个人经历，独特视角
   - 3分: 较为真实，但有部分套话
   - 1分: 明显模板化，缺乏个性

请以JSON格式返回评估结果：
{
  "richness": { "score": 数字, "feedback": "具体评价" },
  "specificity": { "score": 数字, "feedback": "具体评价" },
  "matchPotential": { "score": 数字, "feedback": "具体评价" },
  "authenticity": { "score": 数字, "feedback": "具体评价" },
  "suggestions": ["改进建议1", "改进建议2"],
  "summary": "总体评价(50字以内)"
}`;
  }

  /**
   * 解析AI响应
   */
  private parseAIResponse(resultText: string, category: string, content: string): QualityEvaluationResult {
    try {
      // 尝试提取JSON部分
      const jsonMatch = resultText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('无法解析AI响应');
      }

      const parsed = JSON.parse(jsonMatch[0]);

      const richness = Math.min(5, Math.max(0, parsed.richness?.score || 3));
      const specificity = Math.min(5, Math.max(0, parsed.specificity?.score || 3));
      const matchPotential = Math.min(5, Math.max(0, parsed.matchPotential?.score || 3));
      const authenticity = Math.min(5, Math.max(0, parsed.authenticity?.score || 3));
      
      const overall = Math.round((richness + specificity + matchPotential + authenticity) / 4 * 10) / 10;

      const scores: QualityScore = {
        richness,
        specificity,
        matchPotential,
        authenticity,
        overall,
      };

      const categoryNames: Record<string, string> = {
        'self_intro': '自我介绍',
        'hobbies': '兴趣爱好',
        'hometown': '家乡介绍',
        'travel_stories': '旅行故事',
        'fun_facts': '有趣故事',
      };

      const details: ScoreDetail[] = [
        {
          dimension: 'richness',
          score: richness,
          maxScore: 5,
          label: '丰富度',
          description: '内容长度和多样性',
          feedback: parsed.richness?.feedback || '',
        },
        {
          dimension: 'specificity',
          score: specificity,
          maxScore: 5,
          label: '具体性',
          description: '是否有具体细节',
          feedback: parsed.specificity?.feedback || '',
        },
        {
          dimension: 'matchPotential',
          score: matchPotential,
          maxScore: 5,
          label: '匹配潜力',
          description: '与兴趣标签关联度',
          feedback: parsed.matchPotential?.feedback || '',
        },
        {
          dimension: 'authenticity',
          score: authenticity,
          maxScore: 5,
          label: '真实性',
          description: '避免模板化',
          feedback: parsed.authenticity?.feedback || '',
        },
      ];

      const suggestions = Array.isArray(parsed.suggestions) ? parsed.suggestions : [];
      const summary = parsed.summary || '';

      return {
        scores,
        details,
        suggestions,
        summary,
        starRating: this.calculateStarRating(overall),
        isUsable: overall >= 2.5,
      };
    } catch (error) {
      // console.error('解析AI响应失败:', error);
      // 降级到规则评估
      return this.evaluateByRules(category, content);
    }
  }

  /**
   * 基于规则的评估（备用方案）
   */
  private evaluateByRules(category: string, content: string): QualityEvaluationResult {
    const trimmedContent = content.trim();
    const length = trimmedContent.length;
    const words = trimmedContent.split(/\s+/).length;

    // 丰富度评分（基于长度）
    let richness = 2;
    if (length > 200) richness = 5;
    else if (length > 100) richness = 4;
    else if (length > 50) richness = 3;
    else if (length > 20) richness = 2;
    else richness = 1;

    // 具体性评分（基于具体指标）
    const hasNumbers = /\d+/.test(content);
    const hasPlaces = /(北京|上海|深圳|广州|杭州|成都|中国|美国|日本|法国|德国|意大利|西班牙|印度|澳大利亚|加拿大|英国|city|country|place|visited|travel)/i.test(content);
    const hasTime = /(年|月|日|岁|week|month|year|day|time|ago|last|recent)/i.test(content);
    
    let specificity = 2;
    const specificCount = [hasNumbers, hasPlaces, hasTime].filter(Boolean).length;
    if (specificCount >= 3) specificity = 5;
    else if (specificCount === 2) specificity = 4;
    else if (specificCount === 1) specificity = 3;
    else specificity = 1;

    // 匹配潜力评分（基于关键词）
    const interestKeywords = [
      '旅行', '旅游', '摄影', '拍照', '美食', '烹饪', '阅读', '读书', '电影', '音乐', '运动', '跑步', '瑜伽', '绘画', '艺术', '历史', '文化', '自然', '动物', '猫', '狗',
      'travel', 'photography', 'photo', 'food', 'cooking', 'reading', 'book', 'movie', 'music', 'sport', 'running', 'yoga', 'painting', 'art', 'history', 'culture', 'nature', 'animal', 'cat', 'dog', 'hiking', 'cycling', 'swimming'
    ];
    const matchedKeywords = interestKeywords.filter(kw => 
      content.toLowerCase().includes(kw.toLowerCase())
    ).length;
    
    let matchPotential = 2;
    if (matchedKeywords >= 4) matchPotential = 5;
    else if (matchedKeywords >= 3) matchPotential = 4;
    else if (matchedKeywords >= 2) matchPotential = 3;
    else if (matchedKeywords >= 1) matchPotential = 2;
    else matchPotential = 1;

    // 真实性评分（检测模板化内容）
    const templatePatterns = [
      'i am a student',
      'i like reading and traveling',
      'i am from china',
      'nice to meet you',
      'look forward to',
      '我是一名学生',
      '我喜欢阅读和旅游',
      '我来自中国',
      '很高兴认识你',
    ];
    const hasTemplate = templatePatterns.some(p => 
      content.toLowerCase().includes(p.toLowerCase())
    );
    const hasPersonalStory = /(记得|那次|有一次|last year|when i|my first|my favorite|我最喜欢的|我的第一次)/i.test(content);
    
    let authenticity = 3;
    if (hasPersonalStory && !hasTemplate) authenticity = 5;
    else if (hasPersonalStory) authenticity = 4;
    else if (!hasTemplate) authenticity = 3;
    else authenticity = 2;

    const overall = Math.round((richness + specificity + matchPotential + authenticity) / 4 * 10) / 10;

    const scores: QualityScore = {
      richness,
      specificity,
      matchPotential,
      authenticity,
      overall,
    };

    const details: ScoreDetail[] = [
      {
        dimension: 'richness',
        score: richness,
        maxScore: 5,
        label: '丰富度',
        description: '内容长度和多样性',
        feedback: this.getRichnessFeedback(richness, length),
      },
      {
        dimension: 'specificity',
        score: specificity,
        maxScore: 5,
        label: '具体性',
        description: '是否有具体细节',
        feedback: this.getSpecificityFeedback(specificity, specificCount),
      },
      {
        dimension: 'matchPotential',
        score: matchPotential,
        maxScore: 5,
        label: '匹配潜力',
        description: '与兴趣标签关联度',
        feedback: this.getMatchPotentialFeedback(matchPotential, matchedKeywords),
      },
      {
        dimension: 'authenticity',
        score: authenticity,
        maxScore: 5,
        label: '真实性',
        description: '避免模板化',
        feedback: this.getAuthenticityFeedback(authenticity, hasPersonalStory, hasTemplate),
      },
    ];

    const suggestions = this.generateSuggestions(scores, content);

    return {
      scores,
      details,
      suggestions,
      summary: this.generateSummary(scores),
      starRating: this.calculateStarRating(overall),
      isUsable: overall >= 2.5,
    };
  }

  /**
   * 获取空内容评估
   */
  private getEmptyEvaluation(): QualityEvaluationResult {
    const scores: QualityScore = {
      richness: 0,
      specificity: 0,
      matchPotential: 0,
      authenticity: 0,
      overall: 0,
    };

    const details: ScoreDetail[] = [
      { dimension: 'richness', score: 0, maxScore: 5, label: '丰富度', description: '内容长度和多样性', feedback: '内容为空' },
      { dimension: 'specificity', score: 0, maxScore: 5, label: '具体性', description: '是否有具体细节', feedback: '内容为空' },
      { dimension: 'matchPotential', score: 0, maxScore: 5, label: '匹配潜力', description: '与兴趣标签关联度', feedback: '内容为空' },
      { dimension: 'authenticity', score: 0, maxScore: 5, label: '真实性', description: '避免模板化', feedback: '内容为空' },
    ];

    return {
      scores,
      details,
      suggestions: ['请填写内容后再进行评估'],
      summary: '内容为空，无法评估',
      starRating: 0,
      isUsable: false,
    };
  }

  /**
   * 计算星级评分
   */
  private calculateStarRating(score: number): number {
    if (score >= 4.5) return 5;
    if (score >= 3.5) return 4;
    if (score >= 2.5) return 3;
    if (score >= 1.5) return 2;
    if (score >= 0.5) return 1;
    return 0;
  }

  /**
   * 整体质量分类
   */
  private categorizeOverallQuality(score: number): string {
    if (score >= 4) return 'excellent';
    if (score >= 3) return 'good';
    if (score >= 2) return 'average';
    return 'needs_improvement';
  }

  /**
   * 丰富度反馈
   */
  private getRichnessFeedback(score: number, length: number): string {
    if (score >= 5) return '内容非常丰富，信息量大';
    if (score >= 4) return '内容充实，信息多样';
    if (score >= 3) return '内容适中，基本信息完整';
    if (score >= 2) return '内容较为简短，可以适当扩展';
    return '内容过少，建议补充更多信息';
  }

  /**
   * 具体性反馈
   */
  private getSpecificityFeedback(score: number, count: number): string {
    if (score >= 5) return '非常具体，包含详细的时间/地点/事件';
    if (score >= 4) return '比较具体，有一定的细节描述';
    if (score >= 3) return '有一定细节，但可以更具体';
    if (score >= 2) return '较为笼统，建议添加具体例子';
    return '过于抽象，需要补充具体细节';
  }

  /**
   * 匹配潜力反馈
   */
  private getMatchPotentialFeedback(score: number, count: number): string {
    if (score >= 5) return '与多种常见兴趣高度相关';
    if (score >= 4) return '与多个兴趣标签相关';
    if (score >= 3) return '能与部分兴趣建立关联';
    if (score >= 2) return '关联度一般，可以扩展兴趣描述';
    return '难以与兴趣标签匹配，建议调整内容';
  }

  /**
   * 真实性反馈
   */
  private getAuthenticityFeedback(score: number, hasPersonal: boolean, hasTemplate: boolean): string {
    if (score >= 5) return '真实自然，有个人特色';
    if (score >= 4) return '比较真实，有个人经历';
    if (score >= 3) return '较为自然，但略显普通';
    if (score >= 2) return '有一定模板痕迹';
    return '明显模板化，建议增加个人经历';
  }

  /**
   * 生成改进建议
   */
  private generateSuggestions(scores: QualityScore, content: string): string[] {
    const suggestions: string[] = [];

    if (scores.richness < 3) {
      suggestions.push('内容可以更丰富一些，多分享一些细节和感受');
    }

    if (scores.specificity < 3) {
      suggestions.push('尝试添加具体时间、地点或事件，让内容更生动');
    }

    if (scores.matchPotential < 3) {
      suggestions.push('可以提及一些常见兴趣，如旅行、摄影、美食、阅读等，增加匹配机会');
    }

    if (scores.authenticity < 3) {
      suggestions.push('避免使用套话，用自己的话讲述真实的经历和感受');
    }

    if (suggestions.length === 0) {
      if (scores.overall >= 4) {
        suggestions.push('素材质量很好！可以继续保持这个水准');
      } else {
        suggestions.push('整体不错，稍微调整就能更出色');
      }
    }

    return suggestions.slice(0, 3); // 最多返回3条建议
  }

  /**
   * 生成总体评价
   */
  private generateSummary(scores: QualityScore): string {
    const overall = scores.overall;
    
    if (overall >= 4.5) return '素材质量优秀，内容丰富具体，匹配潜力高';
    if (overall >= 3.5) return '素材质量良好，能满足大多数场景的匹配需求';
    if (overall >= 2.5) return '素材质量尚可，建议根据提示进行优化';
    if (overall >= 1.5) return '素材需要改进，建议参考建议进行补充';
    return '素材质量不足，需要重新撰写或大幅修改';
  }
}

// 导出服务实例
export const materialQualityService = new MaterialQualityService();
