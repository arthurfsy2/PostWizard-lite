import { loadDictionary, saveDictionary } from './persistence';
import { translateText } from './translationService';
import { commonPhrases } from './tokenizer';

// 预定义的短语翻译（高于 AI 翻译）
const phraseTranslations: Record<string, string> = {
  'a lot': '很多',
  'a lot of': '很多',
  'lots of': '很多',
  'thank you': '谢谢',
  'thanks for': '感谢',
  'look forward': '期待',
  'hope you': '希望你',
  'wish you': '祝你',
  'best wishes': '最好的祝福',
  'best regards': '此致敬礼',
  'kind regards': '此致敬礼',
  'take care': '保重',
  'stay safe': '注意安全',
  'good luck': '好运',
  'happy new year': '新年快乐',
  'merry christmas': '圣诞快乐',
  'happy birthday': '生日快乐',
};

interface DictionaryEntry {
  translation: string;
  frequency: number;
  source: 'ai' | 'manual';
  createdAt: string;
  updatedAt: string;  // 新增：最后更新时间
}

/**
 * 自学习词典类
 * 
 * 核心逻辑：
 * 1. 查询词典（已有 → 直接返回）
 * 2. AI 兜底（未知 → AI 翻译）
 * 3. 自动学习（保存新词汇）
 * 4. 防抖持久化（10 秒）
 */
class SelfLearningDictionary {
  private dictionary: Map<string, DictionaryEntry> = new Map();
  private dirty = false;
  private saveTimer: NodeJS.Timeout | null = null;
  private initialized = false;

  /**
   * 初始化词典（从文件加载）
   */
  async init() {
    if (this.initialized) return;
    
    const data = await loadDictionary();
    this.dictionary = new Map(Object.entries(data));
    this.initialized = true;
    
    console.log(`📚 [词典初始化] 加载 ${this.dictionary.size} 个词汇`);
    if (this.dictionary.size > 0) {
      console.log(`   已学词汇示例：${Array.from(this.dictionary.keys()).slice(0, 5).join(', ')}...`);
    }
  }

  /**
   * 翻译词汇
   * 优先级：
   * 1. 预定义短语翻译（最高优先级）
   * 2. 词典命中
   * 3. AI 翻译并自动学习
   */
  async translateWord(word: string): Promise<string> {
    await this.init();
    
    const normalizedWord = word.toLowerCase().trim();
    
    // 1. 检查预定义短语翻译（最高优先级）
    if (phraseTranslations[normalizedWord]) {
      console.log(`📖 [短语命中] "${normalizedWord}" → "${phraseTranslations[normalizedWord]}" (预定义)`);
      return phraseTranslations[normalizedWord];
    }
    
    // 2. 检查词典
    const existing = this.dictionary.get(normalizedWord);
    
    if (existing) {
      // ✅ 词典命中：直接返回，并更新频率和时间戳
      console.log(`📖 [词典命中] "${normalizedWord}" → "${existing.translation}" (第 ${existing.frequency + 1} 次查询)`);
      existing.frequency++;
      existing.updatedAt = new Date().toISOString();  // 更新最后访问时间
      this.markDirty();
      return existing.translation;
    }

    // 3. 检查是否是常见短语的一部分（提供上下文）
    let contextHint = '';
    if (commonPhrases.has(normalizedWord)) {
      contextHint = '（在短语中表示"很多"）';
    }
    
    // 🔥 词典未命中：调用 AI 翻译
    console.log(`🔍 [词典未命中] "${normalizedWord}" - 开始 AI 翻译...${contextHint}`);
    const result = await translateText(normalizedWord, {
      from: 'en',
      to: 'zh',
      maxTokens: 10,
      temperature: 0.1,
    });
    const translation = result.text;
    
    console.log(`✅ [AI 翻译完成] "${normalizedWord}" → "${translation}"`);
    
    // 自动学习到词典
    const now = new Date().toISOString();
    this.dictionary.set(normalizedWord, {
      translation,
      frequency: 1,
      source: 'ai',
      createdAt: now,
      updatedAt: now,  // 新增词汇的创建时间和更新时间相同
    });
    
    console.log(`💾 [已学习到词典] "${normalizedWord}" (当前词典大小：${this.dictionary.size} 词)`);
    this.markDirty();
    return translation;
  }

  /**
   * 批量翻译（用于词云生成）
   */
  async translateWords(words: string[]): Promise<Map<string, string>> {
    await this.init();
    
    const results = new Map<string, string>();
    
    for (const word of words) {
      const translation = await this.translateWord(word);
      results.set(word, translation);
    }
    
    return results;
  }

  /**
   * 标记词典为脏（需要保存）
   */
  private markDirty() {
    this.dirty = true;
    
    // 防抖保存（10 秒）
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => this.save(), 10000);
  }

  /**
   * 保存词典到文件
   */
  private async save() {
    if (!this.dirty) return;
    
    const data = Object.fromEntries(this.dictionary);
    await saveDictionary(data);
    this.dirty = false;
    
    const newWords = Array.from(this.dictionary.values()).filter(e => e.source === 'ai' && e.frequency === 1).length;
    const updatedWords = Array.from(this.dictionary.values()).filter(e => e.frequency > 1).length;
    
    console.log(`💾 [词典持久化] 已保存 ${this.dictionary.size} 个词汇到 data/word-dictionary.json`);
    console.log(`   新增词汇：${newWords} 个，更新访问频率：${updatedWords} 个`);
    if (newWords > 0) {
      console.log(`   最新词汇：${Array.from(this.dictionary.entries())
        .filter(([_, v]) => v.source === 'ai' && v.frequency === 1)
        .slice(0, 3)
        .map(([k, v]) => `"${k}" → "${v.translation}"`)
        .join(', ')}`);
    }
  }

  /**
   * 获取词典统计
   */
  getStats() {
    const entries = Array.from(this.dictionary.values());
    return {
      totalWords: this.dictionary.size,
      aiTranslated: entries.filter(e => e.source === 'ai').length,
      manualTranslated: entries.filter(e => e.source === 'manual').length,
      totalFrequency: entries.reduce((sum, e) => sum + e.frequency, 0),
    };
  }

  /**
   * 获取词典条目
   */
  getEntry(word: string): DictionaryEntry | undefined {
    return this.dictionary.get(word.toLowerCase().trim());
  }
}

// 单例导出
export const dictionary = new SelfLearningDictionary();
