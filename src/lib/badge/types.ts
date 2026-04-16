// 徽章系统类型定义

// 徽章等级
export type BadgeTier = 'bronze' | 'silver' | 'gold' | 'special';

// 徽章类型
export type BadgeType = 
  | 'story_novice'      // 🌱 故事新手
  | 'story_expert'      // 🌿 故事达人
  | 'story_master'      // 🌳 故事大师
  | 'perfect_match'     // ✨ 完美匹配
  | 'popular_material'; // 🔥 热门素材（新增）

// 徽章定义
export interface Badge {
  id: string;
  key: BadgeType;
  name: string;
  description: string;
  icon: string;
  tier: BadgeTier;
  condition: string;
  quotaReward: number;
  daysReward: number;
  sortOrder: number;
  isActive: boolean;
}

// 用户徽章
export interface UserBadge {
  id: string;
  userId: string;
  badgeId: string;
  badge: Badge;
  unlockedAt: string;
  isNew: boolean;
  viewedAt: string | null;
}

// 素材分类进度
export interface CategoryProgress {
  self_intro: boolean;
  hobbies: boolean;
  hometown: boolean;
  travel_stories: boolean;
  fun_facts: boolean;
}

// 素材完善度
export interface MaterialProgress {
  id: string;
  userId: string;
  completionRate: number;    // 0-100
  qualityScore: number;      // 0-5
  categoryProgress: CategoryProgress;
  lastEvaluatedAt: string | null;
  totalMatches: number;      // 素材被成功匹配使用的次数
}

// 徽章解锁结果
export interface BadgeUnlockResult {
  badge: Badge;
  isNewUnlock: boolean;
  rewards: {
    quota: number;
    days: number;
  };
}

// 进度响应
export interface ProgressResponse {
  progress: MaterialProgress;
  badges: UserBadge[];
  unlockedThisTime: BadgeUnlockResult[];
  nextAchievements: {
    badge: Badge;
    currentProgress: number;
    requiredProgress: number;
    percentage: number;
  }[];
}

// 分类配置
export const MATERIAL_CATEGORIES = [
  { key: 'self_intro', name: '自我介绍', description: '简单介绍你自己，你是谁，做什么工作' },
  { key: 'hobbies', name: '兴趣爱好', description: '分享你的兴趣爱好，让收件人了解你' },
  { key: 'hometown', name: '家乡介绍', description: '介绍你的家乡，有哪些特色' },
  { key: 'travel_stories', name: '旅行故事', description: '分享你的旅行经历和故事' },
  { key: 'fun_facts', name: '有趣故事', description: '分享有趣的生活故事或冷知识' },
] as const;

// 徽章配置（系统默认徽章）
export const DEFAULT_BADGES: Omit<Badge, 'id' | 'isActive'>[] = [
  {
    key: 'story_novice',
    name: '故事新手',
    description: '迈出了分享自我的第一步',
    icon: '🌱',
    tier: 'bronze',
    condition: '完成基础素材填写（至少1个分类）',
    quotaReward: 10,
    daysReward: 0,
    sortOrder: 1,
  },
  {
    key: 'story_expert',
    name: '故事达人',
    description: '每个分类都留下了你的足迹',
    icon: '🌿',
    tier: 'silver',
    condition: '所有5个分类都有内容',
    quotaReward: 20,
    daysReward: 3,
    sortOrder: 2,
  },
  {
    key: 'story_master',
    name: '故事大师',
    description: '素材质量获得高度认可',
    icon: '🌳',
    tier: 'gold',
    condition: '素材质量评分≥4星',
    quotaReward: 50,
    daysReward: 7,
    sortOrder: 3,
  },
  {
    key: 'perfect_match',
    name: '完美匹配',
    description: '素材帮助生成了10封明信片',
    icon: '✨',
    tier: 'special',
    condition: '素材被成功匹配使用10次',
    quotaReward: 0,
    daysReward: 0,
    sortOrder: 4,
  },
  {
    key: 'popular_material',
    name: '热门素材',
    description: '你的素材被广泛使用的认可',
    icon: '🔥',
    tier: 'gold',
    condition: '单条素材使用次数达到5次',
    quotaReward: 30,
    daysReward: 3,
    sortOrder: 5,
  },
];

// 徽章等级样式配置
export const BADGE_TIER_STYLES: Record<BadgeTier, {
  bgGradient: string;
  borderColor: string;
  textColor: string;
  glowColor: string;
}> = {
  bronze: {
    bgGradient: 'from-amber-700 to-amber-500',
    borderColor: 'border-amber-600',
    textColor: 'text-amber-700',
    glowColor: 'shadow-amber-500/50',
  },
  silver: {
    bgGradient: 'from-slate-400 to-slate-300',
    borderColor: 'border-slate-400',
    textColor: 'text-slate-600',
    glowColor: 'shadow-slate-400/50',
  },
  gold: {
    bgGradient: 'from-yellow-500 to-yellow-300',
    borderColor: 'border-yellow-500',
    textColor: 'text-yellow-700',
    glowColor: 'shadow-yellow-500/50',
  },
  special: {
    bgGradient: 'from-purple-500 via-pink-500 to-orange-500',
    borderColor: 'border-purple-500',
    textColor: 'text-purple-700',
    glowColor: 'shadow-purple-500/50',
  },
};
