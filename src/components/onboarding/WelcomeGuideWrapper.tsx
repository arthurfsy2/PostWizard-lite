'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { WelcomeGuide } from './WelcomeGuide';

function WelcomeGuideContent() {
  const searchParams = useSearchParams();
  const showGuide = searchParams.has('showGuide');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (showGuide) {
      // 使用 replaceState 清除 URL 参数，避免刷新时再次触发
      const url = window.location.pathname;
      window.history.replaceState({}, '', url);
    }
  }, [showGuide]);

  // 避免 SSR 时 hydration mismatch
  if (!mounted) return null;

  return <WelcomeGuide forceShow={showGuide} />;
}

export function WelcomeGuideWrapper() {
  return (
    <Suspense fallback={null}>
      <WelcomeGuideContent />
    </Suspense>
  );
}