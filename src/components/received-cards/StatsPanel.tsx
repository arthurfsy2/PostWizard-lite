'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Globe, Heart, Mail, TrendingUp, Award, MapPin } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

interface StatsPanelProps {
  total?: number;
  countries?: number;
  favorites?: number;
  className?: string;
}

export function StatsPanel({
  total = 0,
  countries = 0,
  favorites = 0,
  className = ''
}: StatsPanelProps) {
  const t = useTranslations('StatsPanel');
  const [animatedStats, setAnimatedStats] = useState({
    total: 0,
    countries: 0,
    favorites: 0,
  });

  // 数字动画
  useEffect(() => {
    const duration = 1000;
    const steps = 60;
    const interval = duration / steps;

    let step = 0;
    const timer = setInterval(() => {
      step++;
      const progress = step / steps;
      
      // easeOutQuart 缓动函数
      const ease = 1 - Math.pow(1 - progress, 4);
      
      setAnimatedStats({
        total: Math.round(total * ease),
        countries: Math.round(countries * ease),
        favorites: Math.round(favorites * ease),
      });

      if (step >= steps) {
        clearInterval(timer);
        setAnimatedStats({ total, countries, favorites });
      }
    }, interval);

    return () => clearInterval(timer);
  }, [total, countries, favorites]);

  const stats = [
    {
      icon: Mail,
      label: t('identifiedCards'),
      value: animatedStats.total,
      color: 'from-blue-500 to-blue-600',
      bgColor: 'bg-blue-50',
      iconColor: 'text-blue-600',
    },
    {
      icon: Globe,
      label: t('differentCountries'),
      value: animatedStats.countries,
      color: 'from-purple-500 to-purple-600',
      bgColor: 'bg-purple-50',
      iconColor: 'text-purple-600',
    },
    {
      icon: Heart,
      label: t('favorites'),
      value: animatedStats.favorites,
      color: 'from-red-500 to-red-600',
      bgColor: 'bg-red-50',
      iconColor: 'text-red-600',
    },
  ];

  return (
    <div className={`grid grid-cols-1 sm:grid-cols-3 gap-4 ${className}`}>
      {stats.map((stat) => {
        const Icon = stat.icon;
        return (
          <Card 
            key={stat.label}
            className="border-0 shadow-sm hover:shadow-md transition-shadow overflow-hidden"
          >
            <CardContent className="p-4">
              <div className="flex items-center gap-4">
                {/* 图标 */}
                <div className={`w-12 h-12 rounded-xl ${stat.bgColor} flex items-center justify-center flex-shrink-0`}>
                  <Icon className={`h-6 w-6 ${stat.iconColor}`} />
                </div>

                {/* 内容 */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-500 mb-1">
                    {stat.label}
                  </p>
                  <p className="text-2xl font-bold text-gray-900">
                    {stat.value}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

// 扩展版统计面板（用于首页或详情页）
export function ExtendedStatsPanel({ className = '' }: { className?: string }) {
  const t = useTranslations('StatsPanel');
  const [stats, setStats] = useState({
    total: 0,
    countries: 0,
    favorites: 0,
    topCountry: '',
    recentCount: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const response = await fetch('/api/received-cards/stats');
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (error) {
      // console.error('Failed to fetch stats:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className={`grid grid-cols-2 md:grid-cols-4 gap-4 ${className}`}>
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} className="border-0 shadow-sm animate-pulse">
            <CardContent className="p-4">
              <div className="h-8 bg-gray-200 rounded mb-2" />
              <div className="h-4 bg-gray-200 rounded w-2/3" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className={className}>
      {/* 基础统计 */}
      <StatsPanel 
        total={stats.total}
        countries={stats.countries}
        favorites={stats.favorites}
        className="mb-4"
      />

      {/* 扩展统计 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center">
                <TrendingUp className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">{t('recent30Days')}</p>
                <p className="text-xl font-bold text-gray-900">
                  {t('recentCount', { count: stats.recentCount })}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center">
                <MapPin className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">{t('mostReceived')}</p>
                <p className="text-xl font-bold text-gray-900">
                  {stats.topCountry || t('none')}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 成就徽章 */}
      {stats.total >= 10 && (
        <Card className="border-0 shadow-sm mt-4 bg-gradient-to-r from-amber-50 to-orange-50">
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center">
                <Award className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="text-sm text-amber-800 font-medium">
                  {t('achievementTitle')}
                </p>
                <p className="text-xs text-amber-600">
                  {t('achievementDesc', { count: stats.total })}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default StatsPanel;
