/**
 * 通用翻译服务 (Translation Service)
 * 
 * 提供底层翻译能力，供上层业务服务复用。
 * 统一处理 OpenAI 客户端、配置读取、错误处理和 Token 统计。
 */

import { createOpenAIClient, getAIConfigFromDB } from './ai-config';

export interface TranslateOptions {
  /** 源语言，默认为 'zh' */
  from?: string;
  /** 目标语言，默认为 'en' */
  to?: string;
  /** 翻译风格/语境提示 */
  style?: string;
  /** 最大 token 数 */
  maxTokens?: number;
  /** 温度参数，控制创造性 */
  temperature?: number;
}

export interface TranslateResult {
  /** 翻译后的文本 */
  text: string;
  /** Token 使用情况 */
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  /** 使用的模型 */
  model: string;
}

/**
 * 系统 Prompt 模板
 */
const TRANSLATION_SYSTEM_PROMPT = `You are a professional translator.

Rules:
- Translate naturally and fluently, not word-for-word
- Maintain the original tone and style
- For Postcrossing context: be warm, personal, and appropriate for postcard culture
- Output ONLY the translated text, no explanations
- Preserve any formatting (paragraphs, line breaks)`;

/**
 * 翻译文本
 * 
 * @param text - 需要翻译的文本
 * @param options - 翻译选项
 * @returns 翻译结果
 */
export async function translateText(
  text: string,
  options: TranslateOptions = {}
): Promise<TranslateResult> {
  const {
    from = 'zh',
    to = 'en',
    style,
    maxTokens = 1000,
    temperature = 0.7,
  } = options;

  if (!text.trim()) {
    return {
      text: '',
      usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
      model: '',
    };
  }

  // 获取 AI 配置和客户端
  const [aiConfig, openai] = await Promise.all([
    getAIConfigFromDB(),
    createOpenAIClient(),
  ]);

  // 构建用户提示词
  let userPrompt = `Translate the following text from ${from} to ${to}:`;
  
  if (style) {
    userPrompt += `\n\nStyle context: ${style}`;
  }
  
  userPrompt += `\n\n---\n${text}\n---`;

  const completion = await openai.chat.completions.create({
    model: aiConfig.model,
    messages: [
      {
        role: 'system',
        content: TRANSLATION_SYSTEM_PROMPT,
      },
      {
        role: 'user',
        content: userPrompt,
      },
    ],
    temperature,
    max_tokens: maxTokens,
  });

  const translatedText = completion.choices[0]?.message?.content?.trim() || '';

  // 清理可能残留的格式符号（如 "--- 翻译内容 ---"）
  const cleanedText = translatedText
    .replace(/^---\s*/, '')  // 移除开头 ---
    .replace(/\s*---$/, '')  // 移除结尾 ---
    .trim();

  return {
    text: cleanedText,
    usage: {
      promptTokens: completion.usage?.prompt_tokens || 0,
      completionTokens: completion.usage?.completion_tokens || 0,
      totalTokens: completion.usage?.total_tokens || 0,
    },
    model: aiConfig.model,
  };
}

/**
 * 批量翻译（优化多次翻译请求）
 * 
 * @param texts - 文本数组
 * @param options - 翻译选项
 * @returns 翻译结果数组
 */
export async function translateBatch(
  texts: string[],
  options: TranslateOptions = {}
): Promise<TranslateResult[]> {
  // 并行执行翻译请求，但限制并发数避免 API 限流
  const concurrency = 3;
  const results: TranslateResult[] = [];

  for (let i = 0; i < texts.length; i += concurrency) {
    const batch = texts.slice(i, i + concurrency);
    const batchResults = await Promise.all(
      batch.map(text => translateText(text, options))
    );
    results.push(...batchResults);
  }

  return results;
}

/**
 * 检测文本语言
 * 
 * @param text - 需要检测的文本
 * @returns 语言代码 (如 'zh', 'en')
 */
export function detectLanguage(text: string): string {
  // 简单检测：包含中文字符则认为是中文
  if (/[\u4e00-\u9fa5]/.test(text)) {
    return 'zh';
  }
  // 否则假设是英文
  return 'en';
}

/**
 * 自动翻译（根据检测的源语言自动决定）
 * 
 * @param text - 需要翻译的文本
 * @param targetLang - 目标语言，默认 'en'
 * @param options - 其他翻译选项
 * @returns 翻译结果
 */
export async function autoTranslate(
  text: string,
  targetLang: string = 'en',
  options: Omit<TranslateOptions, 'from' | 'to'> = {}
): Promise<TranslateResult> {
  const from = detectLanguage(text);
  const to = from === targetLang ? (targetLang === 'zh' ? 'en' : 'zh') : targetLang;
  
  return translateText(text, { ...options, from, to });
}
