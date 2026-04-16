/**
 * 留言精选相关类型定义
 * 参考 PRD: arrivals-wordcloud-pm-final.md 第八点五节
 */

export type HighlightCategory = 'touching' | 'funny' | 'blessing' | 'cultural';

export interface HighlightCategoryInfo {
  key: HighlightCategory;
  label: string;
  icon: string;
  description: string;
}

export interface HighlightCategoryScore {
  name: HighlightCategory;
  confidence: number;
}

export interface HighlightItem {
  id: string;
  postcardId: string;
  message: string;
  translation?: string;        // 中文翻译（可选）
  aiScore: number;
  primaryCategory: HighlightCategory;
  categories: HighlightCategoryScore[];
  emotion: 'positive' | 'neutral' | 'negative';
  tags: string[];
  sender: string;
  country: string;
  arrivalDate: string;
  analyzedAt: string;
}

export interface HighlightsResponse {
  highlights: HighlightItem[];
  totalAnalyzed: number;
  totalCount: number;
  hasMore: boolean;
  category: HighlightCategory;
  cached: boolean;
  updatedAt: string;
}

export interface HighlightsEmptyState {
  type: 'insufficient_data' | 'low_score' | 'no_messages';
  message: string;
  action?: {
    text: string;
    href: string;
  };
}

// 分类配置
export const HIGHLIGHT_CATEGORIES: HighlightCategoryInfo[] = [
  {
    key: 'touching',
    label: '最走心',
    icon: '💝',
    description: '真诚温暖的深度留言',
  },
  {
    key: 'funny',
    label: '最有趣',
    icon: '😄',
    description: '幽默有趣的精彩留言',
  },
  {
    key: 'blessing',
    label: '最祝福',
    icon: '✨',
    description: '充满祝福的美好留言',
  },
  {
    key: 'cultural',
    label: '文化交流',
    icon: '🌍',
    description: '跨文化交流的精彩留言',
  },
];
