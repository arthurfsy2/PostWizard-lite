import { englishStopWords } from '@/lib/data/stopwords/en';

/**
 * 常见短语库（Postcrossing 语境）
 * 这些短语会被优先识别为一个整体，避免拆分后语义失真
 */
export const commonPhrases = new Set([
  'thank you',
  'thanks for',
  'look forward',
  'forward to',
  'hope you',
  'wish you',
  'happy postcrossing',
  'best wishes',
  'best regards',
  'kind regards',
  'a lot',           // ⭐ 关键：避免 "lot" 单独翻译为"张"
  'a lot of',        // ⭐ 关键：确保翻译为"很多"
  'lots of',
  'postcard from',
  'received your',
  'love the',
  'like the',
  'beautiful card',
  'nice card',
  'great card',
  'wonderful card',
  'lovely card',
  'happy new',
  'new year',
  'merry christmas',
  'happy birthday',
  'take care',
  'stay safe',
  'good luck',
  'all the best',
  'sending you',
  'greetings from',
]);

/**
 * 英文分词 5 步法（MVP 版本）
 * 1. 转小写
 * 2. 移除标点
 * 3. 按空格分割
 * 4. 过滤短词（>2 字符）
 * 5. 过滤停用词
 * 
 * P1.5 增加：词干提取
 * P2.0 增加：短语识别
 */
export function tokenizeEnglish(text: string): string[] {
  return text
    .toLowerCase()                          // 1. 转小写
    .replace(/[^\w\s]/g, ' ')               // 2. 移除标点
    .split(/\s+/)                           // 3. 按空格分割
    .filter(word => word.length > 2)        // 4. 过滤短词
    .filter(word => !englishStopWords.has(word))  // 5. 过滤停用词
    .filter(word => !/^\d+$/.test(word))    // 额外：过滤纯数字
    .filter(word => !word.includes('http')) // 额外：过滤 URL
    .filter(word => !word.includes('@'));   // 额外：过滤邮箱
}

/**
 * 提取短语（Bigram 和 Trigram）
 * 
 * 识别常见的 2-3 词短语，避免单独翻译导致语义失真
 * 例如：
 * - "a lot of" → 翻译为"很多"（而不是 a=一, lot=张, of=的）
 * - "thank you" → 翻译为"谢谢"（而不是 thank=感谢, you=你）
 * 
 * @param text 原始文本
 * @returns 识别出的短语列表
 */
export function extractPhrases(text: string): string[] {
  // 清洗文本
  const cleaned = text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  
  const words = cleaned.split(' ');
  const phrases: string[] = [];
  
  // 滑动窗口提取 2-3 词短语
  for (let i = 0; i < words.length - 1; i++) {
    // Bigram (2词)
    const bigram = `${words[i]} ${words[i + 1]}`;
    if (commonPhrases.has(bigram)) {
      phrases.push(bigram);
    }
    
    // Trigram (3词)
    if (i < words.length - 2) {
      const trigram = `${words[i]} ${words[i + 1]} ${words[i + 2]}`;
      if (commonPhrases.has(trigram)) {
        phrases.push(trigram);
      }
    }
  }
  
  return phrases;
}

/**
 * 智能分词（单词 + 短语）
 * 
 * 结合单词分词和短语识别，优先使用高频短语
 * 
 * @param text 原始文本
 * @param options 配置选项
 * @returns 词列表（包含单词和短语）
 */
export function smartTokenize(
  text: string,
  options: { includePhrases?: boolean; minPhraseCount?: number } = {}
): string[] {
  const { includePhrases = true, minPhraseCount = 2 } = options;
  
  // 1. 基础单词分词
  const words = tokenizeEnglish(text);
  
  if (!includePhrases) {
    return words;
  }
  
  // 2. 提取短语
  const phrases = extractPhrases(text);
  
  // 3. 统计短语频率
  const phraseFreq = new Map<string, number>();
  for (const phrase of phrases) {
    phraseFreq.set(phrase, (phraseFreq.get(phrase) || 0) + 1);
  }
  
  // 4. 过滤低频短语
  const frequentPhrases = Array.from(phraseFreq.entries())
    .filter(([_, count]) => count >= minPhraseCount)
    .map(([phrase]) => phrase);
  
  // 5. 合并结果（短语 + 剩余单词）
  // 注意：包含短语的单词会被排除，避免重复计数
  const phraseWords = new Set<string>();
  for (const phrase of frequentPhrases) {
    phrase.split(' ').forEach(w => phraseWords.add(w));
  }
  
  const filteredWords = words.filter(word => !phraseWords.has(word));
  
  return [...frequentPhrases, ...filteredWords];
}

/**
 * 统计词频
 */
export function countFrequency(words: string[]): Map<string, number> {
  const freq = new Map<string, number>();
  for (const word of words) {
    freq.set(word, (freq.get(word) || 0) + 1);
  }
  return freq;
}

/**
 * 将词频 Map 转换为排序后的数组
 */
export function sortByFrequency(freq: Map<string, number>, minCount: number = 2) {
  return Array.from(freq.entries())
    .filter(([_, count]) => count >= minCount)
    .map(([text, count]) => ({
      text,
      count,
      weight: count,
    }))
    .sort((a, b) => b.count - a.count);
}
