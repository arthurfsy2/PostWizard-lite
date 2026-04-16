'use client';

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { motion } from 'framer-motion';
import { MapPin, Heart, Sparkles } from 'lucide-react';

// 示例收件人配置
export const SAMPLE_RECIPIENTS = [
  {
    id: 'photography-lover',
    name: '摄影爱好者',
    country: 'US',
    city: 'San Francisco',
    interests: 'photography, travel, nature, hiking, landscape',
    bio: 'I love capturing beautiful moments with my camera. Always looking for new places to explore!',
    icon: '📸',
    gradient: 'from-blue-500 via-cyan-500 to-teal-500',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
    interestTags: ['摄影', '旅行', '自然', '徒步'],
  },
  {
    id: 'food-explorer',
    name: '美食探索者',
    country: 'FR',
    city: 'Paris',
    interests: 'food, cooking, culture, wine, baking',
    bio: 'Foodie at heart! I enjoy trying new cuisines and learning about different food cultures.',
    icon: '🍽️',
    gradient: 'from-orange-500 via-red-500 to-pink-500',
    bgColor: 'bg-orange-50',
    borderColor: 'border-orange-200',
    interestTags: ['美食', '烹饪', '文化', '红酒'],
  },
  {
    id: 'history-collector',
    name: '历史收藏家',
    country: 'DE',
    city: 'Berlin',
    interests: 'history, vintage, stamps, antiques, museums',
    bio: 'Passionate about history and collecting vintage items. Love visiting museums!',
    icon: '🏛️',
    gradient: 'from-amber-600 via-yellow-600 to-amber-500',
    bgColor: 'bg-amber-50',
    borderColor: 'border-amber-200',
    interestTags: ['历史', '收藏', '邮票', '博物馆'],
  },
  {
    id: 'art-enthusiast',
    name: '艺术爱好者',
    country: 'IT',
    city: 'Florence',
    interests: 'art, painting, music, theater, gallery',
    bio: 'Art lover who enjoys all forms of creative expression. Love visiting galleries!',
    icon: '🎨',
    gradient: 'from-purple-500 via-pink-500 to-rose-500',
    bgColor: 'bg-purple-50',
    borderColor: 'border-purple-200',
    interestTags: ['艺术', '绘画', '音乐', '戏剧'],
  },
  {
    id: 'nature-lover',
    name: '自然爱好者',
    country: 'CA',
    city: 'Vancouver',
    interests: 'nature, gardening, animals, environment, outdoor',
    bio: 'Nature lover who enjoys gardening and outdoor activities. Protect our planet!',
    icon: '🌿',
    gradient: 'from-emerald-500 via-teal-500 to-green-500',
    bgColor: 'bg-emerald-50',
    borderColor: 'border-emerald-200',
    interestTags: ['自然', '园艺', '动物', '环保'],
  },
  {
    id: 'book-worm',
    name: '阅读爱好者',
    country: 'UK',
    city: 'London',
    interests: 'books, literature, writing, poetry, libraries',
    bio: 'Avid reader and aspiring writer. I love getting lost in a good book!',
    icon: '📚',
    gradient: 'from-indigo-500 via-purple-500 to-violet-500',
    bgColor: 'bg-indigo-50',
    borderColor: 'border-indigo-200',
    interestTags: ['阅读', '文学', '写作', '诗歌'],
  },
];

interface SampleRecipientSelectorProps {
  selectedId?: string;
  onSelect: (recipientId: string) => void;
  disabled?: boolean;
}

export function SampleRecipientSelector({
  selectedId,
  onSelect,
  disabled = false,
}: SampleRecipientSelectorProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      {/* 标题 */}
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-100 to-purple-100 flex items-center justify-center">
          <Sparkles className="w-4 h-4 text-indigo-500" />
        </div>
        <h3 className="font-semibold text-slate-800">选择示例收件人</h3>
      </div>

      {/* 选择器网格 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {SAMPLE_RECIPIENTS.map((recipient, index) => {
          const isSelected = selectedId === recipient.id;
          const isHovered = hoveredId === recipient.id;

          return (
            <motion.div
              key={recipient.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <Card
                onClick={() => !disabled && onSelect(recipient.id)}
                onMouseEnter={() => setHoveredId(recipient.id)}
                onMouseLeave={() => setHoveredId(null)}
                className={`
                  relative cursor-pointer overflow-hidden
                  transition-all duration-300 border-2
                  ${isSelected 
                    ? `${recipient.borderColor} shadow-lg scale-[1.02]` 
                    : 'border-transparent hover:border-slate-200 hover:shadow-md'
                  }
                  ${disabled ? 'opacity-60 cursor-not-allowed' : ''}
                `}
              >
                {/* 选中状态指示器 */}
                {isSelected && (
                  <motion.div
                    layoutId="selectedIndicator"
                    className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${recipient.gradient}`}
                  />
                )}

                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    {/* 图标 */}
                    <div className={`
                      w-14 h-14 rounded-2xl flex items-center justify-center text-2xl
                      transition-transform duration-300
                      ${isSelected || isHovered ? 'scale-110' : ''}
                      ${recipient.bgColor}
                    `}>
                      {recipient.icon}
                    </div>

                    {/* 内容 */}
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold text-slate-800 truncate">
                        {recipient.name}
                      </h4>
                      <div className="flex items-center gap-1 text-sm text-slate-500 mt-1">
                        <MapPin className="w-3 h-3" />
                        {recipient.city}, {recipient.country}
                      </div>
                    </div>

                    {/* 选中标记 */}
                    {isSelected && (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className={`
                          w-6 h-6 rounded-full flex items-center justify-center
                          bg-gradient-to-r ${recipient.gradient}
                        `}
                      >
                        <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      </motion.div>
                    )}
                  </div>

                  {/* 兴趣标签 */}
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {recipient.interestTags.map((tag) => (
                      <Badge
                        key={tag}
                        variant="secondary"
                        className={`
                          text-xs font-normal
                          ${isSelected 
                            ? `${recipient.bgColor} ${recipient.borderColor} border` 
                            : 'bg-slate-100 text-slate-600'
                          }
                        `}
                      >
                        <Heart className="w-3 h-3 mr-1" />
                        {tag}
                      </Badge>
                    ))}
                  </div>

                  {/* 简介 */}
                  <p className="mt-3 text-xs text-slate-500 line-clamp-2">
                    {recipient.bio}
                  </p>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>

      {/* 提示信息 */}
      <p className="text-sm text-slate-500 text-center">
        点击任意卡片，预览您的素材与该类型收件人的匹配效果
      </p>
    </div>
  );
}

// 重新导出示例收件人配置，方便其他组件使用
export { SAMPLE_RECIPIENTS };
