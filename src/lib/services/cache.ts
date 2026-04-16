/**
 * 简单的内存缓存实现
 * P2 阶段可替换为 Redis
 */

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

class MemoryCache {
  private cache = new Map<string, CacheEntry<any>>();
  private readonly defaultTTL = 3600 * 1000; // 1 小时

  /**
   * 获取缓存
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }
    
    return entry.data;
  }

  /**
   * 设置缓存
   */
  set<T>(key: string, data: T, ttlMs: number = this.defaultTTL): void {
    this.cache.set(key, {
      data,
      expiresAt: Date.now() + ttlMs,
    });
  }

  /**
   * 删除缓存
   */
  delete(key: string): void {
    this.cache.delete(key);
  }

  /**
   * 清空缓存
   */
  clear(): void {
    this.cache.clear();
  }
}

// 单例实例
export const memoryCache = new MemoryCache();

/**
 * 获取词云缓存
 */
export async function getCachedWordCloud<T>(key: string): Promise<T | null> {
  return memoryCache.get<T>(key);
}

/**
 * 设置词云缓存
 */
export async function cacheWordCloud<T>(key: string, data: T, ttlSeconds: number = 3600): Promise<void> {
  memoryCache.set(key, data, ttlSeconds * 1000);
}

/**
 * 清除用户的所有词云缓存
 */
export async function invalidateWordCloudCache(userId: string): Promise<void> {
  // 遍历所有缓存键，删除匹配的用户缓存
  for (const key of Array.from(memoryCache['cache'].keys())) {
    if (key.startsWith(`wordcloud:${userId}:`)) {
      memoryCache.delete(key);
    }
  }
}

// ============================================
// 留言精选缓存 (Highlights Cache)
// ============================================

const HIGHLIGHTS_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 小时

/**
 * 构建留言精选缓存 Key
 * 包含 userId、category、modelVersion，确保模型切换时自动刷新
 */
export function buildHighlightsCacheKey(
  userId: string,
  category: string,
  modelVersion: string
): string {
  return `highlights:${userId}:${category}:${modelVersion}`;
}

/**
 * 获取留言精选缓存
 */
export async function getCachedHighlights<T>(
  userId: string,
  category: string,
  modelVersion: string
): Promise<T | null> {
  const key = buildHighlightsCacheKey(userId, category, modelVersion);
  return memoryCache.get<T>(key);
}

/**
 * 设置留言精选缓存
 */
export async function cacheHighlights<T>(
  userId: string,
  category: string,
  modelVersion: string,
  data: T,
  ttlMs: number = HIGHLIGHTS_CACHE_TTL
): Promise<void> {
  const key = buildHighlightsCacheKey(userId, category, modelVersion);
  memoryCache.set(key, data, ttlMs);
}

/**
 * 清除用户的所有留言精选缓存
 */
export async function invalidateHighlightsCache(userId: string): Promise<void> {
  for (const key of Array.from(memoryCache['cache'].keys())) {
    if (key.startsWith(`highlights:${userId}:`)) {
      memoryCache.delete(key);
    }
  }
}

/**
 * 清除特定分类的留言精选缓存
 */
export async function invalidateHighlightsCacheByCategory(
  userId: string,
  category: string
): Promise<void> {
  for (const key of Array.from(memoryCache['cache'].keys())) {
    if (key.startsWith(`highlights:${userId}:${category}:`)) {
      memoryCache.delete(key);
    }
  }
}
