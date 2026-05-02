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
const TAG_EXTRACTION_SYSTEM_PROMPT = `你是一位内容分析专家，服务于 Postcrossing（全球明信片交换平台）。

任务：
从用户内容中提取相关标签/关键词。

规则：
- 标签应描述用户的兴趣爱好、性格特征或喜欢讨论的话题
- 标签使用中文，简洁明了（2-4 个字）
- 根据内容自然提取，不限制数量
- 只包含准确反映用户兴趣的标签
- 避免泛泛的标签如"明信片"、"旅行"、"邮票"，除非用户特别强调
- 关注用户的独特之处和想与片友分享的内容

输出格式（仅 JSON）：
{
  "tags": ["标签1", "标签2", "标签3", ...]
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

  const userPrompt = `从以下内容中提取标签：\n\n---\n${content}\n---`;

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

  // Step 2: 提取标签（合并 aboutMe 和 casualNotes，支持 JSON 数组格式）
  let notesText = casualNotes || '';
  try {
    const parsed = JSON.parse(notesText);
    if (Array.isArray(parsed)) {
      notesText = parsed.map((e: any) => (e.content || '').trim()).filter(Boolean).join('\n');
    }
  } catch {}
  const combinedContent = `${aboutMe}\n${notesText}`.trim();
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
