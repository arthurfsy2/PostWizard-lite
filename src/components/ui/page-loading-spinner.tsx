'use client';

import { Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';

export function PageLoadingSpinner({ text }: { text?: string }) {
  const t = useTranslations('Common');
  const displayText = text || t('loading');
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
      <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
      <p className="text-sm text-muted-foreground">{displayText}</p>
    </div>
  );
}
