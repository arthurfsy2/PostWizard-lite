import type { HighlightCategory } from '@/types/highlights';

/**
 * 分类 key 标准化
 * 
 * 兼容历史旧 key：
 * - funny → touching（合并到最走心，funny 覆盖率仅 2.4%）
 * - blessing → emotional（更名映射）
 * - cultural → culturalInsight（更名映射）
 * - 无效值 → null（返回空数组，而非 404）
 */
export function normalizeCategory(cat: string | null | undefined): HighlightCategory | null {
  if (!cat) return null;

  // 历史旧 key 兼容映射
  const legacyMap: Record<string, HighlightCategory> = {
    'funny':     'touching',        // 合并到最走心
    'blessing':  'emotional',       // 更名映射
    'cultural':  'culturalInsight', // 更名映射
  };

  if (cat in legacyMap) {
    return legacyMap[cat];
  }

  // 验证是否为有效分类 key
  const validKeys: readonly HighlightCategory[] = ['touching', 'emotional', 'culturalInsight'];
  return validKeys.includes(cat as HighlightCategory) ? cat as HighlightCategory : null;
}

/**
 * 前端路由重定向策略
 * 
 * 用于前端路由守卫：访问旧分类 URL 时自动 redirect 到新分类
 */
export function getRedirectCategory(oldCategory: string): HighlightCategory {
  const normalized = normalizeCategory(oldCategory);
  
  // 无效分类 → 回退到 touching
  return normalized || 'touching';
}
