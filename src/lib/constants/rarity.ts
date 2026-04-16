/**
 * 稀有度颜色常量
 * 定义 SSR/SR/R/N 四种稀有度的视觉样式
 * 参考: docs/design/RECEIVED_CARD_RARITY_DESIGN.md
 */

export type Rarity = 'SSR' | 'SR' | 'R' | 'N' | null;

export interface RarityColors {
  border: string;
  background: string;
  glow: string;
  text: string;
  badgeBg: string;
  badgeText: string;
  badgeBorder: string;
}

/**
 * 颜色方案（根据设计规范 2.1-2.4）
 */
export const RARITY_COLORS: Record<string, RarityColors> = {
  SSR: {
    border: '#FFD700',
    background: 'linear-gradient(135deg, rgba(255,215,0,0.15) 0%, rgba(255,165,0,0.05) 50%, transparent 100%)',
    glow: 'rgba(255, 215, 0, 0.6)',
    text: '#92400E',
    badgeBg: 'linear-gradient(135deg, #FFD700, #FFA500)',
    badgeText: '#FFFFFF',
    badgeBorder: '#FFF8DC',
  },
  SR: {
    border: '#C0C0C0',
    background: 'linear-gradient(135deg, rgba(192,192,192,0.12) 0%, rgba(168,168,168,0.04) 50%, transparent 100%)',
    glow: 'rgba(192, 192, 192, 0.4)',
    text: '#374151',
    badgeBg: 'linear-gradient(135deg, #E8E8E8, #C0C0C0)',
    badgeText: '#374151',
    badgeBorder: '#FFFFFF',
  },
  R: {
    border: '#CD7F32',
    background: 'linear-gradient(135deg, rgba(205,127,50,0.1) 0%, rgba(184,115,51,0.03) 50%, transparent 100%)',
    glow: 'rgba(205, 127, 50, 0.3)',
    text: '#78350F',
    badgeBg: 'linear-gradient(135deg, #CD7F32, #B87333)',
    badgeText: '#FFFFFF',
    badgeBorder: '#FFE4C4',
  },
  N: {
    border: '#9CA3AF',
    background: '#FAFAFA',
    glow: 'rgba(156, 163, 175, 0.1)',
    text: '#374151',
    badgeBg: 'linear-gradient(135deg, #F3F4F6, #E5E7EB)',
    badgeText: '#6B7280',
    badgeBorder: '#D1D5DB',
  },
  default: {
    border: '#E5E7EB',
    background: '#FFFFFF',
    glow: 'none',
    text: '#374151',
    badgeBg: '#E5E7EB',
    badgeText: '#6B7280',
    badgeBorder: '#D1D5DB',
  },
};

/**
 * 获取指定稀有度的颜色配置
 */
export function getRarityColors(rarity: Rarity): RarityColors {
  if (!rarity) return RARITY_COLORS.default;
  return RARITY_COLORS[rarity] || RARITY_COLORS.default;
}

/**
 * 稀有度排序（用于排序，从高到低）
 */
export const RARITY_ORDER: Record<string, number> = {
  SSR: 4,
  SR: 3,
  R: 2,
  N: 1,
  null: 0,
};

/**
 * 稀有度显示名称
 */
export const RARITY_LABELS: Record<string, string> = {
  SSR: 'SSR · 超稀有',
  SR: 'SR · 稀有',
  R: 'R · 稀有',
  N: 'N · 普通',
};

/**
 * 稀有度概率（抽卡用）
 */
export const RARITY_PROBABILITY: Record<string, number> = {
  SSR: 0.03,  // 3%
  SR: 0.12,   // 12%
  R: 0.25,    // 25%
  N: 0.60,    // 60%
};

/**
 * 角标尺寸（根据设计规范 4.1）
 */
export const RARITY_BADGE_SIZES = {
  grid: {
    width: 36,
    height: 20,
    fontSize: 10,
  },
  list: {
    width: 32,
    height: 18,
    fontSize: 9,
  },
};
