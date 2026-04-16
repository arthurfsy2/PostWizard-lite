/**
 * 智能素材推荐服务
 * 基于用户行为和历史数据，智能推荐可补充的素材内容
 */

import { prisma } from '@/lib/prisma';

// 推荐类型
export type RecommendationType = 
  | 'country_based'      // 基于寄信国家
  | 'match_based'        // 基于历史匹配
  | 'trending_tags'      // 热门标签趋势
  | 'seasonal';          // 季节性话题

// 推荐项
export interface Recommendation {
  id: string;
  type: RecommendationType;
  title: string;
  description: string;
  suggestion: string;
  category: string;        // 建议添加到哪个分类
  reason: string;          // 推荐理由
  confidence: number;      // 置信度 0-1
  metadata?: Record<string, unknown>;
}

// 用户寄信统计
interface CountryStats {
  country: string;
  count: number;
  percentage: number;
}

// 热门标签统计
interface TagStats {
  tag: string;
  count: number;
}

// 季节性话题配置
interface SeasonalTopic {
  months: number[];
  title: string;
  description: string;
  suggestion: string;
  category: string;
}

// 季节性话题库
const SEASONAL_TOPICS: SeasonalTopic[] = [
  {
    months: [1, 2],
    title: '🏮 春节文化分享',
    description: '春节是中国最重要的传统节日，外国收信人通常对此很感兴趣',
    suggestion: '可以分享春节的传统习俗、年夜饭、红包文化，或者你家乡独特的过年方式',
    category: 'fun_facts',
  },
  {
    months: [3, 4, 5],
    title: '🌸 春季赏花与户外活动',
    description: '春天是户外活动的最佳季节',
    suggestion: '分享你喜欢的春季活动，比如赏花、踏青、春游，或者你所在城市的春天景色',
    category: 'travel_stories',
  },
  {
    months: [6, 7, 8],
    title: '☀️ 夏日生活与消暑方式',
    description: '夏季的生活方式和消暑文化因地而异',
    suggestion: '描述你所在城市的夏天，有什么特别的消暑方式、夏日美食或夏季 traditions',
    category: 'hometown',
  },
  {
    months: [9, 10, 11],
    title: '🍂 秋季收获与美食',
    description: '秋天是收获的季节，各地都有独特的美食',
    suggestion: '分享秋天的特色美食、赏秋景点，或者你最喜欢的秋季活动',
    category: 'hobbies',
  },
  {
    months: [12],
    title: '🎄 年末节日与新年计划',
    description: '年末是分享节日祝福和新年愿望的好时机',
    suggestion: '分享你的年末传统、节日庆祝方式，或者对新一年的期待和计划',
    category: 'self_intro',
  },
];

// 国家相关的素材建议
const COUNTRY_SUGGESTIONS: Record<string, { suggestion: string; category: string }[]> = {
  'Germany': [
    { suggestion: '德国人对效率和组织很有兴趣，可以分享你日常生活中的时间管理习惯', category: 'self_intro' },
    { suggestion: '德国人喜欢讨论环保话题，可以分享你对环保的看法或实践经验', category: 'hobbies' },
  ],
  'Netherlands': [
    { suggestion: '荷兰人热爱骑行文化，可以分享你的骑行经历或所在城市的骑行环境', category: 'travel_stories' },
    { suggestion: '荷兰人喜欢郁金香和风车，可以分享你见过的美丽花卉或特色建筑', category: 'hometown' },
  ],
  'USA': [
    { suggestion: '美国人喜欢了解不同文化的日常，可以分享中国特色的日常生活细节', category: 'fun_facts' },
    { suggestion: '美国人热爱户外运动，可以分享你喜欢的运动或户外活动经历', category: 'hobbies' },
  ],
  'Japan': [
    { suggestion: '日本人对美食文化很有兴趣，可以分享你家乡的特色美食或你的烹饪爱好', category: 'hobbies' },
    { suggestion: '日本也是四季分明的国家，可以分享你对四季变化的感受', category: 'self_intro' },
  ],
  'France': [
    { suggestion: '法国人重视生活品质，可以分享你对美食、艺术或生活的看法', category: 'self_intro' },
    { suggestion: '法国有悠久的文学传统，可以分享你喜欢的书籍或作家', category: 'hobbies' },
  ],
  'UK': [
    { suggestion: '英国人喜欢花园和下午茶文化，可以分享你的休闲时光或园艺爱好', category: 'hobbies' },
    { suggestion: '英国人喜欢讨论天气，可以分享你所在城市的天气特点和应对方式', category: 'hometown' },
  ],
  'Russia': [
    { suggestion: '俄罗斯地域广阔，可以分享中国不同地区间的文化差异', category: 'fun_facts' },
    { suggestion: '俄罗斯人喜欢讨论历史，可以分享你所在城市的历史故事', category: 'hometown' },
  ],
  'Canada': [
    { suggestion: '加拿大也是幅员辽阔的国家，可以分享你在中国旅行的经历', category: 'travel_stories' },
    { suggestion: '加拿大人热爱自然，可以分享你喜欢的自然风光或环保习惯', category: 'hobbies' },
  ],
  'Australia': [
    { suggestion: '澳大利亚有独特的野生动物，可以分享你见过的有趣动物经历', category: 'fun_facts' },
    { suggestion: '澳大利亚人喜欢海滩文化，可以分享你所在城市的水边休闲方式', category: 'hometown' },
  ],
};

// 通用推荐（当数据不足时使用）
const GENERAL_RECOMMENDATIONS: Omit<Recommendation, 'id' | 'type' | 'confidence'>[] = [
  {
    title: '💡 补充具体爱好细节',
    description: '具体的爱好描述更容易引起共鸣',
    suggestion: '不要只说"我喜欢读书"，可以说"我喜欢悬疑小说，尤其是阿加莎·克里斯蒂的作品，周末经常泡在图书馆"',
    category: 'hobbies',
    reason: '具体的爱好描述能让收信人找到更多共同话题',
  },
  {
    title: '📍 添加家乡特色',
    description: '家乡的独特之处往往最能引起外国人的兴趣',
    suggestion: '分享你家乡的特色美食、著名景点、方言俚语，或者只有当地人才知道的秘密地方',
    category: 'hometown',
    reason: '外国收信人对中国的地域文化差异很感兴趣',
  },
  {
    title: '✈️ 记录旅行见闻',
    description: '旅行故事是明信片最好的素材',
    suggestion: '描述一次难忘的旅行经历，包括看到的风景、遇到的人、品尝的美食，以及当时的感受',
    category: 'travel_stories',
    reason: '旅行故事能让收信人"身临其境"',
  },
  {
    title: '🎭 分享有趣的生活细节',
    description: '日常生活中的小趣事往往最打动人',
    suggestion: '分享你最近遇到的有趣事情、学到的冷知识、或者中西文化差异的观察',
    category: 'fun_facts',
    reason: '有趣的故事能让明信片更有温度',
  },
];

/**
 * 获取用户寄信国家分布统计
 */
async function getUserCountryStats(userId: string): Promise<CountryStats[]> {
  const postcards = await prisma.postcard.findMany({
    where: { userId },
    select: { recipientCountry: true },
  });

  const countryCount = new Map<string, number>();
  postcards.forEach(p => {
    const country = p.recipientCountry;
    countryCount.set(country, (countryCount.get(country) || 0) + 1);
  });

  const total = postcards.length;
  if (total === 0) return [];

  return Array.from(countryCount.entries())
    .map(([country, count]) => ({
      country,
      count,
      percentage: Math.round((count / total) * 100),
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5); // 取前5个国家
}

/**
 * 获取热门标签统计
 */
async function getTrendingTags(userId: string): Promise<TagStats[]> {
  // 获取用户的收信人兴趣标签
  const postcards = await prisma.postcard.findMany({
    where: { userId },
    select: { recipientInterests: true },
  });

  const tagCount = new Map<string, number>();
  postcards.forEach(p => {
    if (p.recipientInterests) {
      const tags = p.recipientInterests.split(/[,，]/).map(t => t.trim()).filter(Boolean);
      tags.forEach(tag => {
        tagCount.set(tag, (tagCount.get(tag) || 0) + 1);
      });
    }
  });

  return Array.from(tagCount.entries())
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);
}

/**
 * 获取用户已有的素材分类
 */
async function getUserExistingCategories(userId: string): Promise<Set<string>> {
  const materials = await prisma.userMaterial.findMany({
    where: { userId },
    select: { category: true, content: true },
  });

  return new Set(
    materials
      .filter(m => m.content && m.content.trim().length > 10)
      .map(m => m.category)
  );
}

/**
 * 生成基于国家的推荐
 */
async function generateCountryBasedRecommendations(
  userId: string,
  existingCategories: Set<string>
): Promise<Recommendation[]> {
  const countryStats = await getUserCountryStats(userId);
  const recommendations: Recommendation[] = [];

  for (const stat of countryStats) {
    const suggestions = COUNTRY_SUGGESTIONS[stat.country];
    if (!suggestions) continue;

    for (const item of suggestions) {
      // 如果该分类已有内容，降低优先级
      const hasContent = existingCategories.has(item.category);
      const confidence = hasContent ? 0.4 : 0.7 + (stat.percentage / 200);

      recommendations.push({
        id: `country-${stat.country}-${item.category}`,
        type: 'country_based',
        title: `📍 写给${stat.country}用户的素材建议`,
        description: `你经常寄信给${stat.country}的用户（${stat.percentage}%），补充以下内容会有更好的匹配效果`,
        suggestion: item.suggestion,
        category: item.category,
        reason: `基于你寄往${stat.country}的${stat.count}封明信片历史`,
        confidence: Math.min(confidence, 0.9),
        metadata: { country: stat.country, count: stat.count },
      });
    }
  }

  return recommendations;
}

/**
 * 生成基于热门标签的推荐
 */
async function generateTrendingTagRecommendations(
  userId: string,
  existingCategories: Set<string>
): Promise<Recommendation[]> {
  const trendingTags = await getTrendingTags(userId);
  const recommendations: Recommendation[] = [];

  // 标签到建议的映射
  const tagSuggestions: Record<string, { suggestion: string; category: string; title: string }> = {
    'photography': {
      title: '📷 摄影相关素材',
      suggestion: '分享你的摄影爱好：喜欢拍什么主题？用过什么相机？有什么拍摄技巧？',
      category: 'hobbies',
    },
    'travel': {
      title: '✈️ 旅行爱好者素材',
      suggestion: '作为同样热爱旅行的人，分享你最难忘的旅行目的地和旅途故事',
      category: 'travel_stories',
    },
    'reading': {
      title: '📚 阅读相关素材',
      suggestion: '分享你的阅读习惯：喜欢什么类型的书？最近在读什么？有推荐的作者吗？',
      category: 'hobbies',
    },
    'cooking': {
      title: '🍳 烹饪与美食',
      suggestion: '分享你擅长的菜肴、家乡美食，或者你学习烹饪的有趣经历',
      category: 'hobbies',
    },
    'music': {
      title: '🎵 音乐爱好',
      suggestion: '分享你喜欢的音乐类型、乐器演奏经历，或者最喜欢的歌手/乐队',
      category: 'hobbies',
    },
    'sports': {
      title: '⚽ 运动健身',
      suggestion: '分享你喜欢的运动项目、健身习惯，或者参与过的体育比赛经历',
      category: 'hobbies',
    },
    'hiking': {
      title: '🥾 徒步与户外',
      suggestion: '分享你的徒步经历：去过哪些路线？遇到过什么有趣的事情？',
      category: 'travel_stories',
    },
    'cats': {
      title: '🐱 猫咪主题',
      suggestion: '分享你与猫咪的故事：养猫经历、有趣的猫咪行为、或者对猫的喜爱',
      category: 'fun_facts',
    },
    'dogs': {
      title: '🐕 狗狗主题',
      suggestion: '分享你与狗狗的故事：养狗经历、遛狗日常、或者对狗的感情',
      category: 'fun_facts',
    },
    'tea': {
      title: '🍵 茶文化',
      suggestion: '分享中国的茶文化：喜欢什么茶？喝茶的习惯？或者茶艺经历',
      category: 'hobbies',
    },
    'coffee': {
      title: '☕ 咖啡文化',
      suggestion: '分享你对咖啡的喜爱：喜欢什么口味？常去咖啡馆吗？',
      category: 'hobbies',
    },
    'art': {
      title: '🎨 艺术与创作',
      suggestion: '分享你的艺术爱好：绘画、手工、设计，或者对艺术的欣赏',
      category: 'hobbies',
    },
    'gardening': {
      title: '🌱 园艺种植',
      suggestion: '分享你的园艺经历：种过什么植物？有什么心得？',
      category: 'hobbies',
    },
    'history': {
      title: '🏛️ 历史与文化',
      suggestion: '分享你对历史的兴趣：喜欢的历史时期、去过的历史遗迹、或者历史故事',
      category: 'fun_facts',
    },
    'languages': {
      title: '🗣️ 语言学习',
      suggestion: '分享你的语言学习经历：学过哪些语言？学习过程中的趣事？',
      category: 'self_intro',
    },
  };

  for (const tagStat of trendingTags.slice(0, 5)) {
    const tag = tagStat.tag.toLowerCase();
    const suggestion = tagSuggestions[tag];
    
    if (suggestion) {
      const hasContent = existingCategories.has(suggestion.category);
      const confidence = hasContent ? 0.4 : 0.6 + (tagStat.count / 20);

      recommendations.push({
        id: `tag-${tag}`,
        type: 'trending_tags',
        title: suggestion.title,
        description: `你的收信人中有${tagStat.count}人对"${tagStat.tag}"感兴趣`,
        suggestion: suggestion.suggestion,
        category: suggestion.category,
        reason: `基于收信人的兴趣标签统计`,
        confidence: Math.min(confidence, 0.85),
        metadata: { tag: tagStat.tag, count: tagStat.count },
      });
    }
  }

  return recommendations;
}

/**
 * 生成季节性推荐
 */
function generateSeasonalRecommendations(
  existingCategories: Set<string>
): Recommendation[] {
  const currentMonth = new Date().getMonth() + 1; // 1-12
  const topic = SEASONAL_TOPICS.find(t => t.months.includes(currentMonth));
  
  if (!topic) return [];

  const hasContent = existingCategories.has(topic.category);
  const confidence = hasContent ? 0.35 : 0.75;

  return [{
    id: `seasonal-${currentMonth}`,
    type: 'seasonal',
    title: topic.title,
    description: topic.description,
    suggestion: topic.suggestion,
    category: topic.category,
    reason: `当前季节推荐（${currentMonth}月）`,
    confidence,
    metadata: { month: currentMonth },
  }];
}

/**
 * 生成通用推荐
 */
function generateGeneralRecommendations(
  existingCategories: Set<string>
): Recommendation[] {
  return GENERAL_RECOMMENDATIONS
    .filter(item => !existingCategories.has(item.category))
    .map((item, index) => ({
      id: `general-${index}`,
      type: 'match_based' as const,
      title: item.title,
      description: item.description,
      suggestion: item.suggestion,
      category: item.category,
      reason: item.reason,
      confidence: 0.5,
    }));
}

/**
 * 获取个性化素材推荐
 */
export async function getRecommendations(userId: string): Promise<Recommendation[]> {
  try {
    const existingCategories = await getUserExistingCategories(userId);
    
    // 并行获取各种推荐
    const [
      countryRecommendations,
      tagRecommendations,
      seasonalRecommendations,
      generalRecommendations,
    ] = await Promise.all([
      generateCountryBasedRecommendations(userId, existingCategories),
      generateTrendingTagRecommendations(userId, existingCategories),
      Promise.resolve(generateSeasonalRecommendations(existingCategories)),
      Promise.resolve(generateGeneralRecommendations(existingCategories)),
    ]);

    // 合并所有推荐
    const allRecommendations = [
      ...countryRecommendations,
      ...tagRecommendations,
      ...seasonalRecommendations,
      ...generalRecommendations,
    ];

    // 按置信度排序
    allRecommendations.sort((a, b) => b.confidence - a.confidence);

    // 返回前6个推荐
    return allRecommendations.slice(0, 6);
  } catch (error) {
    // console.error('获取推荐失败:', error);
    // 出错时返回通用推荐
    return generateGeneralRecommendations(new Set());
  }
}

/**
 * 记录推荐反馈
 */
export async function recordRecommendationFeedback(
  userId: string,
  recommendationId: string,
  action: 'accepted' | 'dismissed',
  category?: string
): Promise<void> {
  try {
    // 这里可以扩展为保存到数据库
    // 目前先记录到日志
    // console.log('推荐反馈:', {
    //   userId,
    //   recommendationId,
    //   action,
    //   category,
    //   timestamp: new Date().toISOString(),
    // });

    // TODO: 可以创建 RecommendationFeedback 模型来存储反馈数据
    // 用于后续优化推荐算法
  } catch (error) {
    // console.error('记录推荐反馈失败:', error);
  }
}

/**
 * 获取推荐统计信息
 */
export async function getRecommendationStats(userId: string): Promise<{
  totalSent: number;
  topCountries: CountryStats[];
  topTags: TagStats[];
  completionRate: number;
}> {
  const [
    postcardCount,
    countryStats,
    tagStats,
    materials,
  ] = await Promise.all([
    prisma.postcard.count({ where: { userId } }),
    getUserCountryStats(userId),
    getTrendingTags(userId),
    prisma.userMaterial.findMany({ where: { userId } }),
  ]);

  // 计算素材完善度
  const categoriesWithContent = materials.filter(
    m => m.content && m.content.trim().length > 10
  ).length;
  const totalCategories = 5; // self_intro, hobbies, hometown, travel_stories, fun_facts
  const completionRate = Math.round((categoriesWithContent / totalCategories) * 100);

  return {
    totalSent: postcardCount,
    topCountries: countryStats.slice(0, 3),
    topTags: tagStats.slice(0, 5),
    completionRate,
  };
}
