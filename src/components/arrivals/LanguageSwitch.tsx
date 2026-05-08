'use client';

import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import { LanguageSwitchProps } from '@/types/wordcloud';

/**
 * 语言切换组件
 *
 * 切换词云显示语言
 */
export function LanguageSwitch({ value, onChange }: LanguageSwitchProps) {
  const t = useTranslations('LanguageSwitch');

  const OPTIONS = [
    { value: 'en' as const, label: t('en') },
    { value: 'zh' as const, label: t('zh') },
    { value: 'all' as const, label: t('all') },
  ] as const;
  return (
    <div className="inline-flex gap-1 p-1 bg-slate-100 rounded-lg">
      {OPTIONS.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={cn(
            'px-4 py-1.5 rounded-md text-sm font-medium transition-all duration-200',
            value === opt.value
              ? 'bg-white text-orange-600 shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
