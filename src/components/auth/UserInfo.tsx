"use client";

import { useAuthStore } from '@/lib/stores/auth-store';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { User, LogOut, Crown } from 'lucide-react';
import { useNewUserQuota } from '@/hooks/useNewUserQuota';

export function UserInfo() {
  const { user, logout, fetchUser } = useAuthStore();

  // 使用统一的 Hook 获取新用户额度
  const { newUserQuota } = useNewUserQuota();

  const handleLogout = () => {
    logout();
    window.location.href = '/';
  };

  if (!user) return null;

  const remainingQuota = user.isPaidUser 
    ? '无限' 
    : user.freeQuota - user.freeUsedCount;

  return (
    <Card className="w-full max-w-sm">
      <CardContent className="pt-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
              <User className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="font-medium">{user.email}</p>
              <div className="flex items-center gap-2">
                {user.isPaidUser ? (
                  <Badge variant="default" className="bg-amber-500 hover:bg-amber-600">
                    <Crown className="h-3 w-3 mr-1" />
                    {user.plan === 'monthly' ? '月卡会员' : '年卡会员'}
                  </Badge>
                ) : (
                  <Badge variant="secondary">免费用户</Badge>
                )}
              </div>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={handleLogout} title="退出登录">
            <LogOut className="h-4 w-4" />
          </Button>
        </div>

        <div className="mt-4 rounded-lg bg-muted p-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">剩余额度</span>
          <span className="font-semibold">
            {remainingQuota} {user.isPaidUser ? '' : `/ ${newUserQuota} 次`}
          </span>
        </div>
        {!user.isPaidUser && (
            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-secondary">
              <div
                className="h-full bg-primary transition-all"
                style={{
                  width: `${Math.min(100, (remainingQuota as number) / newUserQuota * 100)}%`,
                }}
              />
            </div>
          )}
        </div>

        {user.isPaidUser && user.planExpiresAt && (
          <p className="mt-2 text-xs text-muted-foreground">
            会员有效期至：{new Date(user.planExpiresAt).toLocaleDateString()}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
