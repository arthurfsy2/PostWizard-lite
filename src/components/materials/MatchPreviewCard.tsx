'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  Sparkles, 
  Target, 
  CheckCircle2, 
  RefreshCw, 
  User,
  MapPin,
  Heart,
  Loader2,
  Quote
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// 示例收件人配置
const SAMPLE_RECIPIENTS = [
  {
    id: 'photography-lover',
    name: '摄影爱好者',
    country: 'US',
    city: 'San Francisco',
    interests: 'photography, travel, nature, hiking, landscape',
    bio: 'I love capturing beautiful moments with my camera. Always looking for new places to explore!',
    icon: '📸',
    color: 'from-blue-500 to-cyan-500',
  },
  {
    id: 'food-explorer',
    name: '美食探索者',
    country: 'FR',
    city: 'Paris',
    interests: 'food, cooking, culture, wine, baking',
    bio: 'Foodie at heart! I enjoy trying new cuisines and learning about different food cultures.',
    icon: '🍽️',
    color: 'from-orange-500 to-red-500',
  },
  {
    id: 'history-collector',
    name: '历史收藏家',
    country: 'DE',
    city: 'Berlin',
    interests: 'history, vintage, stamps, antiques, museums',
    bio: 'Passionate about history and collecting vintage items. Love visiting museums!',
    icon: '🏛️',
    color: 'from-amber-600 to-yellow-600',
  },
  {
    id: 'art-enthusiast',
    name: '艺术爱好者',
    country: 'IT',
    city: 'Florence',
    interests: 'art, painting, music, theater, gallery',
    bio: 'Art lover who enjoys all forms of creative expression. Love visiting galleries!',
    icon: '🎨',
    color: 'from-purple-500 to-pink-500',
  },
  {
    id: 'nature-lover',
    name: '自然爱好者',
    country: 'CA',
    city: 'Vancouver',
    interests: 'nature, gardening, animals, environment, outdoor',
    bio: 'Nature lover who enjoys gardening and outdoor activities. Protect our planet!',
    icon: '🌿',
    color: 'from-emerald-500 to-teal-500',
  },
];

// 匹配素材接口
interface MatchedMaterial {
  category: string;
  content: string;
  matchedKeyword: string;
  matchScore: number;
}

// 匹配结果接口
interface MatchResult {
  recipient: typeof SAMPLE_RECIPIENTS[0];
  matchedMaterials: MatchedMaterial[];
  matchScore: number;
  previewContent: string;
}

interface MatchPreviewCardProps {
  token: string;
}

export function MatchPreviewCard({ token }: MatchPreviewCardProps) {
  const [selectedRecipient, setSelectedRecipient] = useState<string | null>(null);
  const [matchResult, setMatchResult] = useState<MatchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);

  // 生成匹配预览
  const generatePreview = async (recipientId: string, useStream = true) => {
    if (!token) return;

    setLoading(true);
    setStreamingContent('');
    setMatchResult(null);

    try {
      if (useStream) {
        // 流式请求
        const response = await fetch('/api/materials/preview-match', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            recipientId,
            useAI: true,
            stream: true,
          }),
        });

        if (!response.ok) throw new Error('请求失败');
        if (!response.body) throw new Error('响应为空');

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let contentBuffer = '';

        setIsStreaming(true);

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split('\n');

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6);
              if (data === '[DONE]') continue;

              try {
                const parsed = JSON.parse(data);
                
                if (parsed.type === 'init') {
                  setMatchResult({
                    recipient: parsed.recipient,
                    matchedMaterials: parsed.matchedMaterials,
                    matchScore: parsed.matchScore,
                    previewContent: '',
                  });
                } else if (parsed.type === 'content') {
                  contentBuffer += parsed.content;
                  setStreamingContent(contentBuffer);
                } else if (parsed.type === 'done') {
                  setMatchResult(prev => prev ? {
                    ...prev,
                    previewContent: contentBuffer,
                  } : null);
                }
              } catch (e) {
                // 忽略解析错误
              }
            }
          }
        }

        setIsStreaming(false);
      } else {
        // 非流式请求
        const response = await fetch('/api/materials/preview-match', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            recipientId,
            useAI: true,
            stream: false,
          }),
        });

        if (!response.ok) throw new Error('请求失败');

        const data = await response.json();
        setMatchResult(data);
        setStreamingContent(data.previewContent);
      }
    } catch (error) {
      // console.error('生成预览失败:', error);
    } finally {
      setLoading(false);
    }
  };

  // 选择示例收件人
  const handleSelectRecipient = (recipientId: string) => {
    setSelectedRecipient(recipientId);
    generatePreview(recipientId);
  };

  // 重新生成
  const handleRegenerate = () => {
    if (selectedRecipient) {
      generatePreview(selectedRecipient);
    }
  };

  // 获取匹配分数颜色
  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-emerald-500';
    if (score >= 60) return 'text-amber-500';
    if (score >= 40) return 'text-orange-500';
    return 'text-red-500';
  };

  // 获取匹配分数背景色
  const getScoreBgColor = (score: number) => {
    if (score >= 80) return 'bg-emerald-500';
    if (score >= 60) return 'bg-amber-500';
    if (score >= 40) return 'bg-orange-500';
    return 'bg-red-500';
  };

  return (
    <Card className="border-0 shadow-xl shadow-slate-200/50 overflow-hidden h-full">
      <CardHeader className="bg-gradient-to-r from-slate-50 to-slate-100/50">
        <CardTitle className="flex items-center gap-2 text-lg">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-100 to-purple-100 flex items-center justify-center">
            <Target className="h-5 w-5 text-indigo-500" />
          </div>
          素材匹配预览
        </CardTitle>
        <CardDescription className="text-slate-500">
          选择示例收件人，预览您的素材如何被匹配使用
        </CardDescription>
      </CardHeader>

      <CardContent className="p-6 space-y-6">
        {/* 示例收件人选择器 */}
        <div className="space-y-3">
          <Label className="text-sm font-medium text-slate-700 flex items-center gap-2">
            <User className="w-4 h-4" />
            选择示例收件人
          </Label>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            {SAMPLE_RECIPIENTS.map((recipient) => (
              <button
                key={recipient.id}
                onClick={() => handleSelectRecipient(recipient.id)}
                disabled={loading}
                className={`
                  relative p-4 rounded-xl border-2 transition-all duration-200
                  flex flex-col items-center gap-2 text-center
                  ${selectedRecipient === recipient.id
                    ? `border-transparent bg-gradient-to-br ${recipient.color} text-white shadow-lg`
                    : 'border-slate-200 bg-white hover:border-indigo-300 hover:shadow-md'
                  }
                  ${loading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                `}
              >
                <span className="text-2xl">{recipient.icon}</span>
                <span className={`text-sm font-medium ${
                  selectedRecipient === recipient.id ? 'text-white' : 'text-slate-700'
                }`}>
                  {recipient.name}
                </span>
                <div className={`flex items-center gap-1 text-xs ${
                  selectedRecipient === recipient.id ? 'text-white/80' : 'text-slate-500'
                }`}>
                  <MapPin className="w-3 h-3" />
                  {recipient.country}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* 加载状态 */}
        {loading && !matchResult && (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="relative">
              <Loader2 className="w-12 h-12 text-indigo-500 animate-spin" />
              <div className="absolute inset-0 flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-amber-400" />
              </div>
            </div>
            <p className="mt-4 text-slate-600">正在分析素材匹配度...</p>
          </div>
        )}

        {/* 匹配结果 */}
        <AnimatePresence mode="wait">
          {matchResult && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
              className="space-y-6"
            >
              {/* 匹配度评分 */}
              <div className="p-5 rounded-2xl bg-gradient-to-br from-slate-50 to-slate-100/50 border border-slate-100">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Target className="w-5 h-5 text-indigo-500" />
                    <span className="font-medium text-slate-700">匹配度评分</span>
                  </div>
                  <span className={`text-3xl font-bold ${getScoreColor(matchResult.matchScore)}`}>
                    {matchResult.matchScore}%
                  </span>
                </div>
                <Progress 
                  value={matchResult.matchScore} 
                  className="h-3 bg-slate-200"
                />
                <div className={`h-3 -mt-3 rounded-full transition-all duration-500 ${getScoreBgColor(matchResult.matchScore)}`}
                  style={{ width: `${matchResult.matchScore}%`, opacity: 0.8 }}
                />
                <p className="mt-3 text-sm text-slate-500">
                  {matchResult.matchScore >= 80 
                    ? '太棒了！您的素材与这位收件人高度匹配' 
                    : matchResult.matchScore >= 60 
                      ? '不错！有一些匹配的内容可以使用'
                      : matchResult.matchScore >= 40
                        ? '还可以，建议补充更多相关内容'
                        : '匹配度较低，建议完善相关素材'}
                </p>
              </div>

              {/* 匹配到的素材 */}
              {matchResult.matchedMaterials.length > 0 && (
                <div className="space-y-3">
                  <Label className="text-sm font-medium text-slate-700 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    匹配到的素材 ({matchResult.matchedMaterials.length})
                  </Label>
                  <div className="space-y-2">
                    {matchResult.matchedMaterials.map((material, index) => (
                      <motion.div
                        key={index}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.1 }}
                        className="p-4 rounded-xl bg-emerald-50/50 border border-emerald-100"
                      >
                        <div className="flex items-start gap-3">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <Badge variant="secondary" className="bg-emerald-100 text-emerald-700">
                                {material.category}
                              </Badge>
                              <Badge variant="outline" className="text-xs border-amber-300 text-amber-600">
                                匹配: {material.matchedKeyword}
                              </Badge>
                            </div>
                            <p className="text-sm text-slate-700 line-clamp-2">
                              {material.content}
                            </p>
                          </div>
                          <div className={`text-sm font-bold ${getScoreColor(material.matchScore)}`}>
                            {material.matchScore}分
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </div>
              )}

              {/* AI生成预览 */}
              <div className="space-y-3">
                <Label className="text-sm font-medium text-slate-700 flex items-center gap-2">
                  <Quote className="w-4 h-4 text-indigo-500" />
                  AI生成预览
                </Label>
                <div className="relative p-6 rounded-xl bg-gradient-to-br from-indigo-50 to-purple-50/50 border border-indigo-100">
                  <Quote className="absolute top-4 left-4 w-6 h-6 text-indigo-200" />
                  <p className="pl-8 text-slate-700 leading-relaxed min-h-[60px]">
                    {streamingContent || matchResult.previewContent}
                    {isStreaming && (
                      <span className="inline-block w-2 h-4 ml-1 bg-indigo-400 animate-pulse" />
                    )}
                  </p>
                </div>
              </div>

              {/* 重新生成按钮 */}
              <div className="flex justify-center">
                <Button
                  variant="outline"
                  onClick={handleRegenerate}
                  disabled={loading}
                  className="rounded-xl border-slate-200 hover:bg-slate-50"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      生成中...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2" />
                      重新生成
                    </>
                  )}
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* 提示信息 */}
        {!selectedRecipient && !loading && (
          <div className="text-center py-8 text-slate-500">
            <Heart className="w-12 h-12 mx-auto mb-3 text-slate-300" />
            <p>选择上方任意示例收件人</p>
            <p className="text-sm mt-1">查看您的素材如何被匹配使用</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Label 组件（本地定义）
function Label({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <label className={`block text-sm font-medium ${className}`}>
      {children}
    </label>
  );
}
