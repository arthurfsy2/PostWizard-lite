'use client';

import { useState, useEffect } from 'react';
import { 
  Calculator, 
  TrendingUp, 
  Check, 
  ArrowRight,
  Sparkles,
  Crown,
  Zap,
  Star,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface Testimonial {
  name: string;
  avatarGradient: string;
  content: string;
  rating: number;
}

// 默认评价内容
const defaultTestimonials: Testimonial[] = [
  {
    name: '小明',
    avatarGradient: 'from-orange-400 to-amber-400',
    content: 'AI 写信太方便了，省了很多时间！',
    rating: 5
  },
  {
    name: '小红',
    avatarGradient: 'from-pink-400 to-rose-400',
    content: '收信识别功能超棒，晒单图也很好看~',
    rating: 5
  },
  {
    name: '玩家甲',
    avatarGradient: 'from-blue-400 to-cyan-400',
    content: '学生党福利，额度够用，支持！',
    rating: 4
  }
];

interface QuotaCalculatorProps {
  freeQuota: number;
  monthlyPrice: number;
  yearlyPrice: number;
  onSelectPlan?: (plan: 'monthly' | 'yearly') => void;
}

export function QuotaCalculator({
  freeQuota = 50,
  monthlyPrice = 15.9,
  yearlyPrice = 99,
  onSelectPlan
}: QuotaCalculatorProps) {
  const [usage, setUsage] = useState(10);

  // 计算免费版超出费用（假设超出部分每次 ¥1）
  const freeOverageCost = Math.max(0, usage - freeQuota);
  
  // 计算年度节省
  const monthlyYearlyCost = monthlyPrice * 12;
  const yearlySavings = (monthlyYearlyCost - yearlyPrice).toFixed(0);
  const dailyCost = (yearlyPrice / 365).toFixed(2);

  // 计算推荐
  const isWorthIt = usage > freeQuota;
  const recommendation = isWorthIt 
    ? (yearlyPrice / (usage - freeQuota) < 12 ? '年卡' : '月卡')
    : '免费版';

  return (
    <Card className="w-full bg-gradient-to-br from-orange-50 via-white to-amber-50 border-orange-200 shadow-lg">
      <CardHeader className="text-center pb-4">
        <div className="flex items-center justify-center gap-2 mb-2">
          <Calculator className="w-5 h-5 text-orange-500" />
          <CardTitle className="text-xl font-bold text-slate-900">额度计算器</CardTitle>
        </div>
        <p className="text-sm text-slate-600">输入每月预计使用次数，看看哪个方案最适合您</p>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* 滑动条 */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-700">每月预计使用次数</span>
            <span className="text-lg font-bold text-orange-600">{usage} 次</span>
          </div>
          
          <input
            type="range"
            min="1"
            max="100"
            value={usage}
            onChange={(e) => setUsage(parseInt(e.target.value))}
            className="w-full h-3 bg-gradient-to-r from-orange-200 to-amber-200 rounded-lg appearance-none cursor-pointer accent-orange-500"
            style={{
              background: `linear-gradient(to right, #f97316 0%, #f97316 ${usage}%, #fed7aa ${usage}%, #fed7aa 100%)`
            }}
          />
          
          <div className="flex justify-between text-xs text-slate-400">
            <span>1 次</span>
            <span>50 次</span>
            <span>100 次</span>
          </div>
        </div>

        {/* 对比卡片 */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* 免费版 */}
          <div className={cn(
            "p-4 rounded-xl border-2 transition-all",
            recommendation === 'free' 
              ? "border-orange-400 bg-orange-50 shadow-md" 
              : "border-slate-200 bg-white"
          )}>
            <div className="flex items-center gap-2 mb-3">
              <Zap className="w-5 h-5 text-slate-400" />
              <span className="font-semibold text-slate-700">免费版</span>
            </div>
            <div className="text-2xl font-bold text-slate-900 mb-2">¥0</div>
            <div className="text-sm text-slate-600 mb-3">
              每月 {freeQuota} 次
            </div>
            {usage <= freeQuota ? (
              <div className="flex items-center gap-1 text-xs text-emerald-600">
                <Check className="w-3 h-3" />
                <span>够用</span>
              </div>
            ) : (
              <div className="text-xs text-red-500">
                超出 {freeOverageCost} 次<br/>
                需额外 ¥{freeOverageCost}
              </div>
            )}
          </div>

          {/* 月卡 */}
          <div className={cn(
            "p-4 rounded-xl border-2 transition-all",
            recommendation === '月卡' 
              ? "border-orange-500 bg-orange-50 shadow-md scale-105" 
              : "border-slate-200 bg-white"
          )}>
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="w-5 h-5 text-orange-500" />
              <span className="font-semibold text-slate-700">月卡</span>
              {recommendation === '月卡' && (
                <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full">推荐</span>
              )}
            </div>
            <div className="text-2xl font-bold text-slate-900 mb-2">¥{monthlyPrice}</div>
            <div className="text-sm text-slate-600 mb-3">
              无限次使用
            </div>
            <div className="text-xs text-slate-500">
              {usage > freeQuota 
                ? `节省 ¥${freeOverageCost}/月`
                : '无限额度'}
            </div>
          </div>

          {/* 年卡 */}
          <div className={cn(
            "p-4 rounded-xl border-2 transition-all",
            recommendation === '年卡' 
              ? "border-purple-400 bg-purple-50 shadow-md" 
              : "border-slate-200 bg-white"
          )}>
            <div className="flex items-center gap-2 mb-3">
              <Crown className="w-5 h-5 text-purple-500" />
              <span className="font-semibold text-slate-700">年卡</span>
              {recommendation === '年卡' && (
                <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">推荐</span>
              )}
            </div>
            <div className="text-2xl font-bold text-slate-900 mb-2">¥{yearlyPrice}</div>
            <div className="text-sm text-slate-600 mb-3">
              无限次 × 365 天
            </div>
            <div className="text-xs text-purple-600">
              每天 ¥{dailyCost}<br/>
              省 ¥{yearlySavings}/年
            </div>
          </div>
        </div>

        {/* 推荐结论 */}
        {recommendation !== 'free' && onSelectPlan && (
          <div className="text-center pt-2">
            <Button
              onClick={() => onSelectPlan(recommendation === '年卡' ? 'yearly' : 'monthly')}
              className="bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white"
            >
              <ArrowRight className="w-4 h-4 mr-2" />
              立即开通 {recommendation}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// 用户评价展示组件
interface TestimonialsProps {
  testimonials?: Testimonial[];
  autoPlayInterval?: number;
}

export function Testimonials({
  testimonials = defaultTestimonials,
  autoPlayInterval = 5000
}: TestimonialsProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);

  // 自动轮播
  useEffect(() => {
    if (!isAutoPlaying) return;
    
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % testimonials.length);
    }, autoPlayInterval);

    return () => clearInterval(interval);
  }, [isAutoPlaying, testimonials.length, autoPlayInterval]);

  const goToPrev = () => {
    setCurrentIndex((prev) => (prev - 1 + testimonials.length) % testimonials.length);
  };

  const goToNext = () => {
    setCurrentIndex((prev) => (prev + 1) % testimonials.length);
  };

  const goToIndex = (index: number) => {
    setCurrentIndex(index);
  };

  const currentTestimonial = testimonials[currentIndex];

  return (
    <Card className="w-full bg-gradient-to-br from-purple-50 via-white to-pink-50 border-purple-200 shadow-lg overflow-hidden">
      <CardHeader className="text-center pb-2">
        <div className="flex items-center justify-center gap-2">
          <span className="text-2xl">💬</span>
          <CardTitle className="text-xl font-bold text-slate-900">用户评价</CardTitle>
        </div>
        <p className="text-sm text-slate-600">看看大家怎么说</p>
      </CardHeader>
      
      <CardContent className="pt-4">
        {/* 评价卡片 */}
        <div 
          className="relative min-h-[140px] flex items-center justify-center p-4"
          onMouseEnter={() => setIsAutoPlaying(false)}
          onMouseLeave={() => setIsAutoPlaying(true)}
        >
          <div className="text-center animate-in fade-in slide-in-from-bottom-2 duration-300">
            {/* 用户头像 - 渐变背景 */}
            <div className={`w-16 h-16 rounded-full bg-gradient-to-br ${currentTestimonial.avatarGradient} flex items-center justify-center mx-auto mb-3 shadow-md`}>
              <span className="text-2xl text-white font-bold">
                {currentTestimonial.name.charAt(0)}
              </span>
            </div>
            
            {/* 5星评分 - amber-400 填充 */}
            <div className="flex items-center justify-center gap-0.5 mb-3">
              {[...Array(5)].map((_, i) => (
                <Star 
                  key={i} 
                  className={cn(
                    "w-4 h-4",
                    i < currentTestimonial.rating 
                      ? "fill-amber-400 text-amber-400" 
                      : "fill-slate-200 text-slate-200"
                  )} 
                />
              ))}
            </div>
            
            <p className="text-base text-slate-700 leading-relaxed mb-4 max-w-md mx-auto">
              "{currentTestimonial.content}"
            </p>
            <p className="text-sm font-medium text-slate-600">{currentTestimonial.name}</p>
          </div>
        </div>

        {/* 导航控制 */}
        <div className="flex items-center justify-between mt-4">
          {/* 左箭头 */}
          <button
            onClick={goToPrev}
            className="w-10 h-10 rounded-full bg-white border border-purple-200 flex items-center justify-center hover:bg-purple-50 transition-colors"
            aria-label="上一条"
          >
            <ChevronLeft className="w-5 h-5 text-purple-500" />
          </button>

          {/* 轮播指示器 - 活跃时扩展宽度 */}
          <div className="flex items-center gap-2">
            {testimonials.map((_, index) => (
              <button
                key={index}
                onClick={() => goToIndex(index)}
                className={cn(
                  "h-2 rounded-full transition-all duration-300",
                  currentIndex === index 
                    ? "w-8 bg-purple-500" 
                    : "w-2 bg-purple-200 hover:bg-purple-300"
                )}
                aria-label={`查看评价 ${index + 1}`}
              />
            ))}
          </div>

          {/* 右箭头 */}
          <button
            onClick={goToNext}
            className="w-10 h-10 rounded-full bg-white border border-purple-200 flex items-center justify-center hover:bg-purple-50 transition-colors"
            aria-label="下一条"
          >
            <ChevronRight className="w-5 h-5 text-purple-500" />
          </button>
        </div>
      </CardContent>
    </Card>
  );
}

export type { Testimonial, QuotaCalculatorProps, TestimonialsProps };