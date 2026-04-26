/**
 * 留言精选相关类型定义
 * 参考 PRD: arrivals-wordcloud-pm-final.md 第八点五节
 */

export type HighlightCategory = 'touching' | 'emotional' | 'culturalInsight';

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
    description: '有个人故事的留言，真诚而不只是礼貌',
  },
  {
    key: 'emotional',
    label: '情感温度',
    icon: '💗',
    description: '祝福有温度，不是套话',
  },
  {
    key: 'culturalInsight',
    label: '文化洞察',
    icon: '🌍',
    description: '有本地视角，不是景点介绍',
  },
];
