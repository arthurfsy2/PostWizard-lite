'use client';

import React, { useState, useEffect } from 'react';
import { Star, AlertCircle, CheckCircle, Lightbulb, TrendingUp, Award } from 'lucide-react';

/**
 * 质量评分数据结构
 */
export interface QualityScore {
  richness: number;
  specificity: number;
  matchPotential: number;
  authenticity: number;
  overall: number;
}

export interface ScoreDetail {
  dimension: string;
  score: number;
  maxScore: number;
  label: string;
  description: string;
  feedback: string;
}

export interface QualityEvaluationResult {
  scores: QualityScore;
  details: ScoreDetail[];
  suggestions: string[];
  summary: string;
  starRating: number;
  isUsable: boolean;
}

interface QualityScoreCardProps {
  category: string;
  content: string;
  evaluation?: QualityEvaluationResult;
  isLoading?: boolean;
  onEvaluate?: () => void;
  compact?: boolean;
  showSuggestions?: boolean;
}

/**
 * 素材质量评分卡片组件
 */
export function QualityScoreCard({
  category,
  content,
  evaluation,
  isLoading = false,
  onEvaluate,
  compact = false,
  showSuggestions = true,
}: QualityScoreCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // 分类名称映射
  const categoryNames: Record<string, string> = {
    'self_intro': '自我介绍',
    'hobbies': '兴趣爱好',
    'hometown': '家乡介绍',
    'travel_stories': '旅行故事',
    'fun_facts': '有趣故事',
  };

  // 获取星级颜色
  const getStarColor = (rating: number): string => {
    if (rating >= 4) return 'text-yellow-500';
    if (rating >= 3) return 'text-blue-500';
    if (rating >= 2) return 'text-orange-500';
    return 'text-gray-400';
  };

  // 获取评分背景色
  const getScoreBgColor = (score: number): string => {
    if (score >= 4) return 'bg-green-100 text-green-800';
    if (score >= 3) return 'bg-blue-100 text-blue-800';
    if (score >= 2) return 'bg-yellow-100 text-yellow-800';
    return 'bg-red-100 text-red-800';
  };

  // 获取评分标签
  const getRatingLabel = (rating: number): string => {
    const labels: Record<number, string> = {
      5: '优秀',
      4: '良好',
      3: '一般',
      2: '较差',
      1: '不足',
      0: '未评估',
    };
    return labels[rating] || '未评估';
  };

  // 渲染星级
  const renderStars = (rating: number, size: 'sm' | 'md' | 'lg' = 'md') => {
    const sizeClasses = {
      sm: 'w-3 h-3',
      md: 'w-4 h-4',
      lg: 'w-5 h-5',
    };

    return (
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`${sizeClasses[size]} ${
              star <= rating
                ? getStarColor(rating)
                : 'text-gray-300'
            } ${star <= rating ? 'fill-current' : ''}`}
          />
        ))}
      </div>
    );
  };

  // 渲染评分条
  const renderScoreBar = (score: number, maxScore: number = 5) => {
    const percentage = (score / maxScore) * 100;
    let barColor = 'bg-gray-400';
    if (percentage >= 80) barColor = 'bg-green-500';
    else if (percentage >= 60) barColor = 'bg-blue-500';
    else if (percentage >= 40) barColor = 'bg-yellow-500';
    else barColor = 'bg-red-500';

    return (
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div
          className={`h-2 rounded-full transition-all duration-500 ${barColor}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    );
  };

  // 如果没有评估数据
  if (!evaluation && !isLoading) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="font-medium text-gray-900">
              {categoryNames[category] || category}
            </h4>
            <p className="text-sm text-gray-500 mt-1">
              尚未评估素材质量
            </p>
          </div>
          {onEvaluate && (
            <button
              onClick={onEvaluate}
              className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors text-sm font-medium"
            >
              评估质量
            </button>
          )}
        </div>
      </div>
    );
  }

  // 加载状态
  if (isLoading) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-gray-200 rounded-full animate-pulse" />
          <div className="flex-1">
            <div className="h-4 bg-gray-200 rounded animate-pulse w-1/3" />
            <div className="h-3 bg-gray-200 rounded animate-pulse w-1/2 mt-2" />
          </div>
        </div>
      </div>
    );
  }

  if (!evaluation) return null;

  // 紧凑模式
  if (compact) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${getScoreBgColor(evaluation.scores.overall)}`}>
              <Award className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-medium text-gray-900">
                  {categoryNames[category] || category}
                </span>
                <span className={`text-xs px-2 py-0.5 rounded-full ${getScoreBgColor(evaluation.scores.overall)}`}>
                  {getRatingLabel(evaluation.starRating)}
                </span>
              </div>
              {renderStars(evaluation.starRating, 'sm')}
            </div>
          </div>
          <div className="text-right">
            <div className="text-lg font-bold text-gray-900">
              {evaluation.scores.overall.toFixed(1)}
            </div>
            <div className="text-xs text-gray-500">/ 5.0</div>
          </div>
        </div>
      </div>
    );
  }

  // 完整模式
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      {/* 头部：总体评分 */}
      <div className="bg-gradient-to-r from-orange-50 to-amber-50 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-3 rounded-xl ${getScoreBgColor(evaluation.scores.overall)}`}>
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-semibold text-gray-900">
                {categoryNames[category] || category}
              </h4>
              <div className="flex items-center gap-2 mt-1">
                {renderStars(evaluation.starRating)}
                <span className={`text-xs px-2 py-0.5 rounded-full ${getScoreBgColor(evaluation.scores.overall)}`}>
                  {getRatingLabel(evaluation.starRating)}
                </span>
              </div>
            </div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-gray-900">
              {evaluation.scores.overall.toFixed(1)}
            </div>
            <div className="text-sm text-gray-500">综合评分</div>
          </div>
        </div>

        {/* 总体评价 */}
        <p className="mt-3 text-sm text-gray-600 bg-white/60 rounded-lg p-2">
          {evaluation.summary}
        </p>

        {/* 可用性状态 */}
        <div className="mt-3 flex items-center gap-2">
          {evaluation.isUsable ? (
            <>
              <CheckCircle className="w-4 h-4 text-green-500" />
              <span className="text-sm text-green-600 font-medium">
                素材可用，可用于明信片生成
              </span>
            </>
          ) : (
            <>
              <AlertCircle className="w-4 h-4 text-orange-500" />
              <span className="text-sm text-orange-600 font-medium">
                建议优化后再使用
              </span>
            </>
          )}
        </div>
      </div>

      {/* 详细评分 */}
      <div className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h5 className="font-medium text-gray-900">详细评分</h5>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-sm text-orange-600 hover:text-orange-700"
          >
            {isExpanded ? '收起' : '展开'}
          </button>
        </div>

        <div className="space-y-3">
          {evaluation.details.map((detail) => (
            <div key={detail.dimension} className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-gray-700">{detail.label}</span>
                  <span className="text-xs text-gray-400">({detail.description})</span>
                </div>
                <span className={`font-semibold ${
                  detail.score >= 4 ? 'text-green-600' :
                  detail.score >= 3 ? 'text-blue-600' :
                  detail.score >= 2 ? 'text-yellow-600' : 'text-red-600'
                }`}>
                  {detail.score}/{detail.maxScore}
                </span>
              </div>
              {renderScoreBar(detail.score, detail.maxScore)}
              {isExpanded && detail.feedback && (
                <p className="text-xs text-gray-500 mt-1 pl-1">
                  {detail.feedback}
                </p>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* 改进建议 */}
      {showSuggestions && evaluation.suggestions.length > 0 && (
        <div className="border-t border-gray-100 p-4 bg-gray-50">
          <div className="flex items-center gap-2 mb-3">
            <Lightbulb className="w-4 h-4 text-amber-500" />
            <h5 className="font-medium text-gray-900">改进建议</h5>
          </div>
          <ul className="space-y-2">
            {evaluation.suggestions.map((suggestion, index) => (
              <li
                key={index}
                className="flex items-start gap-2 text-sm text-gray-600"
              >
                <span className="w-5 h-5 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center text-xs font-medium flex-shrink-0 mt-0.5">
                  {index + 1}
                </span>
                <span>{suggestion}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/**
 * 批量质量评分概览组件
 */
interface QualityScoreOverviewProps {
  averageScore: number;
  overallRating: number;
  category: string;
  evaluatedCount: number;
  totalCount: number;
}

export function QualityScoreOverview({
  averageScore,
  overallRating,
  category,
  evaluatedCount,
  totalCount,
}: QualityScoreOverviewProps) {
  const categoryLabels: Record<string, string> = {
    'excellent': '优秀',
    'good': '良好',
    'average': '一般',
    'needs_improvement': '需改进',
  };

  const getCategoryColor = (cat: string): string => {
    const colors: Record<string, string> = {
      'excellent': 'text-green-600 bg-green-50 border-green-200',
      'good': 'text-blue-600 bg-blue-50 border-blue-200',
      'average': 'text-yellow-600 bg-yellow-50 border-yellow-200',
      'needs_improvement': 'text-orange-600 bg-orange-50 border-orange-200',
    };
    return colors[cat] || colors['needs_improvement'];
  };

  return (
    <div className="bg-gradient-to-br from-orange-500 to-amber-500 rounded-xl p-6 text-white">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">素材质量总览</h3>
          <p className="text-orange-100 text-sm mt-1">
            已评估 {evaluatedCount}/{totalCount} 个素材
          </p>
        </div>
        <div className="text-right">
          <div className="text-4xl font-bold">{averageScore.toFixed(1)}</div>
          <div className="text-orange-100 text-sm">平均评分</div>
        </div>
      </div>

      <div className="mt-4 flex items-center gap-4">
        <div className={`px-3 py-1 rounded-full text-sm font-medium border ${getCategoryColor(category)}`}>
          {categoryLabels[category] || '评估中'}
        </div>
        <div className="flex items-center gap-1">
          {[1, 2, 3, 4, 5].map((star) => (
            <Star
              key={star}
              className={`w-5 h-5 ${
                star <= overallRating
                  ? 'text-yellow-300 fill-current'
                  : 'text-white/30'
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * 质量评分触发按钮组件
 */
interface QualityEvaluateButtonProps {
  onEvaluate: () => void;
  isLoading?: boolean;
  disabled?: boolean;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'primary' | 'secondary' | 'ghost';
}

export function QualityEvaluateButton({
  onEvaluate,
  isLoading = false,
  disabled = false,
  size = 'md',
  variant = 'primary',
}: QualityEvaluateButtonProps) {
  const sizeClasses = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-sm',
    lg: 'px-6 py-3 text-base',
  };

  const variantClasses = {
    primary: 'bg-orange-500 text-white hover:bg-orange-600',
    secondary: 'bg-orange-100 text-orange-700 hover:bg-orange-200',
    ghost: 'text-orange-600 hover:bg-orange-50',
  };

  return (
    <button
      onClick={onEvaluate}
      disabled={disabled || isLoading}
      className={`
        rounded-lg font-medium transition-colors
        flex items-center gap-2
        disabled:opacity-50 disabled:cursor-not-allowed
        ${sizeClasses[size]}
        ${variantClasses[variant]}
      `}
    >
      {isLoading ? (
        <>
          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          <span>评估中...</span>
        </>
      ) : (
        <>
          <Star className="w-4 h-4" />
          <span>评估质量</span>
        </>
      )}
    </button>
  );
}

export default QualityScoreCard;
