/**
 * Profile AI 服务
 * 提供翻译和标签提取功能
 * 
 * 重构后：复用 translationService 进行翻译，本服务专注于业务逻辑（标签提取）
 */

import { translateText, TranslateResult } from './translationService';
import { createOpenAIClient, getAIConfigFromDB } from './ai-config';

/**
 * AI Prompt - 标签提取专用
 */
const TAG_EXTRACTION_SYSTEM_PROMPT = `You are a content analyst for Postcrossing (a global postcard exchange platform).

Your task:
Extract relevant tags/keywords from the user's content.

Rules:
- Tags should describe hobbies, interests, personality traits, or topics the user enjoys discussing
- Tags should be concise (1-3 words each) and in English
- Extract as many relevant tags as the content naturally supports - no strict minimum or maximum
- Quality matters: only include tags that accurately represent the user's interests
- Avoid generic tags like "postcard", "travel", "stamp" unless they are specifically emphasized
- Focus on what makes the user unique and what they want to share with postcard partners

Output format (JSON only):
{
  "tags": ["tag1", "tag2", "tag3", ...]
}`;

export interface AnalyzeProfileResult {
  translation: string;
  tags: string[];
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

/**
 * 从内容中提取标签
 * @param content - 要分析的内容
 * @returns 标签数组和 Token 使用情况
 */
async function extractTags(content: string): Promise<{ tags: string[]; usage: TranslateResult['usage'] }> {
  const [aiConfig, openai] = await Promise.all([
    getAIConfigFromDB(),
    createOpenAIClient(),
  ]);

  const userPrompt = `Extract tags from the following content:\n\n---\n${content}\n---`;

  const completion = await openai.chat.completions.create({
    model: aiConfig.model,
    messages: [
      {
        role: 'system',
        content: TAG_EXTRACTION_SYSTEM_PROMPT,
      },
      {
        role: 'user',
        content: userPrompt,
      },
    ],
    temperature: 0.7,
    max_tokens: 500,
  });

  const response = completion.choices[0]?.message?.content || '';

  // 解析 JSON 响应
  const jsonMatch = response.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('AI 返回格式错误，无法解析 JSON');
  }

  const parsed = JSON.parse(jsonMatch[0]);

  // 验证返回格式
  if (!Array.isArray(parsed.tags)) {
    throw new Error('AI 返回数据不完整');
  }

  // 清理标签格式
  const tags = parsed.tags.map((tag: string) =>
    String(tag).trim().toLowerCase()
  );

  return {
    tags,
    usage: {
      promptTokens: completion.usage?.prompt_tokens || 0,
      completionTokens: completion.usage?.completion_tokens || 0,
      totalTokens: completion.usage?.total_tokens || 0,
    },
  };
}

/**
 * 分析个人要素内容，翻译并提取标签
 * @param aboutMe - 个人简介（需要翻译的中文内容）
 * @param casualNotes - 随心记（参考上下文，用于提取标签）
 */
export async function analyzeProfileContent(
  aboutMe: string,
  casualNotes: string
): Promise<AnalyzeProfileResult> {
  console.log('[Profile AI] Starting analysis...');

  // Step 1: 使用 translationService 翻译 aboutMe
  const translateResult = await translateText(aboutMe, {
    from: 'zh',
    to: 'en',
    style: 'warm, personal, suitable for Postcrossing profile',
    temperature: 0.7,
  });

  console.log('[Profile AI] Translation completed:', translateResult.text.substring(0, 50) + '...');

  // Step 2: 提取标签（合并 aboutMe 和 casualNotes）
  const combinedContent = `${aboutMe}\n${casualNotes || ''}`.trim();
  const tagResult = await extractTags(combinedContent);

  console.log('[Profile AI] Tags extracted:', tagResult.tags);

  // 合并 Token 使用情况
  const totalUsage = {
    promptTokens: translateResult.usage.promptTokens + tagResult.usage.promptTokens,
    completionTokens: translateResult.usage.completionTokens + tagResult.usage.completionTokens,
    totalTokens: translateResult.usage.totalTokens + tagResult.usage.totalTokens,
  };

  return {
    translation: translateResult.text,
    tags: tagResult.tags,
    usage: totalUsage,
  };
}

/**
 * 检测是否包含中文字符
 */
export function containsChinese(text: string): boolean {
  return /[\u4e00-\u9fa5]/.test(text);
}
