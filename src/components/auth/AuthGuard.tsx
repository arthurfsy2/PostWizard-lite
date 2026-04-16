"use client";

import { useAuthStore } from '@/lib/stores/auth-store';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

interface AuthGuardProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function AuthGuard({ children, fallback }: AuthGuardProps) {
  const router = useRouter();
  const { token, isLoading, fetchUser } = useAuthStore();
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    const init = async () => {
      if (token) {
        await fetchUser();
      }
      setIsInitialized(true);
    };
    init();
  }, [token, fetchUser]);

  useEffect(() => {
    if (isInitialized && !token) {
      router.push('/login');
    }
  }, [isInitialized, token, router]);

  // 显示加载状态
  if (!isInitialized || isLoading) {
    return (
      fallback || (
        <div className="min-h-screen flex items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">加载中...</p>
          </div>
        </div>
      )
    );
  }

  // 未登录时不渲染内容（等待跳转）
  if (!token) {
    return null;
  }

  return <>{children}</>;
}
