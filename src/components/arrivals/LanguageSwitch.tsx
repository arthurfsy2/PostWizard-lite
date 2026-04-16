'use client';

import { cn } from '@/lib/utils';
import { LanguageSwitchProps } from '@/types/wordcloud';

const OPTIONS = [
  { value: 'en' as const, label: '英文' },
  { value: 'zh' as const, label: '中文' },
  { value: 'all' as const, label: '全部' },
] as const;

/**
 * 语言切换组件
 * 
 * 切换词云显示语言：英文 / 中文 / 全部
 */
export function LanguageSwitch({ value, onChange }: LanguageSwitchProps) {
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
