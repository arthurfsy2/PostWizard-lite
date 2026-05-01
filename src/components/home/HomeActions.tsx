'use client';

import Link from 'next/link';
import { ClipboardPaste, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function HomeActions() {
  return (
    <div className="mt-12 flex justify-center items-center gap-4 flex-wrap">
      <Link href="/sent/parse">
        <Button size="lg" className="gap-2 h-12 px-8 text-base rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 shadow-lg shadow-orange-200 transition-warm">
          <ClipboardPaste className="h-4 w-4" />
          粘贴邮件开始
          <ArrowRight className="h-4 w-4" />
        </Button>
      </Link>
      <Link href="/sent/email-parse">
        <Button size="lg" variant="outline" className="gap-2 h-12 px-8 text-base rounded-xl transition-warm">
          邮件解析
          <ArrowRight className="h-4 w-4" />
        </Button>
      </Link>
    </div>
  );
}
