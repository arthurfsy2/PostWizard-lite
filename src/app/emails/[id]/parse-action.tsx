'use client';

import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Loader2, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

interface ParseActionProps {
  emailId: string;
  emailSubject: string;
  emailFrom: string;
}

export function ParseAction({ emailId, emailSubject, emailFrom }: ParseActionProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  const handleParse = async (e: React.MouseEvent) => {
    e.stopPropagation(); // 阻止事件冒泡到父级 Card
    setIsLoading(true);
    try {
      const token = typeof window !== 'undefined' 
        ? (localStorage.getItem('auth-storage') ? JSON.parse(localStorage.getItem('auth-storage')!).state.token : null)
        : null;
      
      const res = await fetch(`/api/emails/${emailId}/parse`, { 
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
      });
      
      if (!res.ok) {
        const data = await res.json();
        if (res.status === 402) {
          toast.error('功能需升级到付费', { 
            description: data.error || '当前账户为免费版，请升级后使用',
            duration: 5000,
          });
          return;
        }
        toast.error(data.error || '解析失败，请稍后重试');
        return;
      }
      
      const data = await res.json();
      if (data.success) {
        // 使用 postcardId 作为 key（更简洁）
        const postcardId = data.data.postcardId;
        const storageKey = `email_parse_data_${postcardId}`;
        
        // 检查是否已存在相同 postcardId 的数据
        const existing = sessionStorage.getItem(storageKey);
        if (existing) {
          try {
            const existingData = JSON.parse(existing);
            // 比较日期，保留最新的
            const existingDate = new Date(existingData.createdAt || 0);
            const newDate = new Date(data.data.createdAt || Date.now());
            
            if (newDate > existingDate) {
              // 新数据更新，覆盖
              sessionStorage.setItem(storageKey, JSON.stringify(data.data));
              console.log(`[ParseAction] postcardId ${postcardId} 已存在，使用最新日期的数据`);
            } else {
              // 旧数据更新，使用旧的但添加时间戳区分
              const uniqueKey = `${storageKey}_${Date.now()}`;
              sessionStorage.setItem(uniqueKey, JSON.stringify(data.data));
              console.log(`[ParseAction] postcardId ${postcardId} 已存在，创建唯一 key: ${uniqueKey}`);
              // 使用唯一 key 跳转
              setTimeout(() => {
                router.push(`/emails/${postcardId}?parseKey=${encodeURIComponent(uniqueKey)}`);
              }, 800);
              setIsLoading(false);
              return;
            }
          } catch (e) {
            console.error('[ParseAction] 解析已有数据失败:', e);
            // 解析失败，直接覆盖
            sessionStorage.setItem(storageKey, JSON.stringify(data.data));
          }
        } else {
          // 不存在，直接保存
          sessionStorage.setItem(storageKey, JSON.stringify(data.data));
        }
        
        toast.success('解析成功，正在跳转...');
        
        // 跳转到详情页（使用 postcardId，更简洁的 URL）
        setTimeout(() => {
          router.push(`/emails/${postcardId}`);
        }, 800);
      } else {
        toast.error(data.error || '解析失败，请稍后重试');
      }
    } catch (error) {
      console.error('解析失败:', error);
      toast.error('解析失败，请稍后重试');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Button
      onClick={handleParse}
      disabled={isLoading}
      size="sm"
      className="bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600"
    >
      {isLoading ? (
        <>
          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          解析中...
        </>
      ) : (
        <>
          <Sparkles className="w-4 h-4 mr-2" />
          解析收件人
        </>
      )}
    </Button>
  );
}
