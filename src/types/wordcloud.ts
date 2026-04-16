// 词云类型定义

export interface WordCloudWord {
  text: string;
  weight: number;
  count?: number;
}

export interface WordCloudData {
  words: WordCloudWord[];
  svg?: string | null;  // QuickChart 生成的 SVG
  totalWords: number;
  uniqueWords?: number;
  language: string;
  generatedAt?: string;
}

export interface WordCloudProps {
  data: WordCloudData;
  width?: number;
  height?: number;
  onWordClick?: (word: WordCloudWord) => void;
}

export interface LanguageSwitchProps {
  value: 'zh' | 'en' | 'all';
  onChange: (lang: 'zh' | 'en' | 'all') => void;
}
