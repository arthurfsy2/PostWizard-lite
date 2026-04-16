import { promises as fs } from 'fs';
import path from 'path';

const DICTIONARY_FILE = path.join(process.cwd(), 'data', 'wordcloud-dictionary.json');

interface DictionaryData {
  [word: string]: {
    translation: string;
    frequency: number;
    source: 'ai' | 'manual';
    createdAt: string;
    updatedAt: string;  // 新增：最后更新时间
  };
}

/**
 * 加载词典
 */
export async function loadDictionary(): Promise<DictionaryData> {
  try {
    const data = await fs.readFile(DICTIONARY_FILE, 'utf-8');
    return JSON.parse(data);
  } catch {
    // 文件不存在时返回空对象
    return {};
  }
}

/**
 * 保存词典
 */
export async function saveDictionary(data: DictionaryData): Promise<void> {
  // 确保目录存在
  const dir = path.dirname(DICTIONARY_FILE);
  await fs.mkdir(dir, { recursive: true });
  
  await fs.writeFile(DICTIONARY_FILE, JSON.stringify(data, null, 2), 'utf-8');
}
