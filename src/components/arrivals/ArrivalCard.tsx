'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Trash2, Link, Clock, MapPin, ArrowRight } from 'lucide-react';
import { getFlagEmoji } from '@/lib/flag-emoji';
import type { ArrivalReply } from '@/lib/types';

interface ArrivalCardProps {
  arrival: ArrivalReply;
  onDelete?: (id: string) => void;
}

export function ArrivalCard({ arrival, onDelete }: ArrivalCardProps) {
  const [showDetail, setShowDetail] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const formatDistance = (km?: number) => {
    if (!km) return '-';
    return `${km.toLocaleString('en-US')} km`;
  };

  const formatDate = (d?: Date | string) => {
    if (!d) return '-';
    const date = new Date(d);
    const utc8Time = date.getTime() - 8 * 60 * 60 * 1000;
    return new Date(utc8Time).toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      const token =
        typeof window !== 'undefined'
          ? localStorage.getItem('auth-storage')
            ? JSON.parse(localStorage.getItem('auth-storage')!).state.token
            : null
          : null;

      const response = await fetch('/api/arrivals', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ ids: [arrival.id] }),
      });

      if (response.ok) {
        onDelete?.(arrival.id);
        setShowDeleteConfirm(false);
      } else {
        alert('删除失败，请稍后重试');
      }
    } catch (error) {
      console.error('删除失败:', error);
      alert('删除失败，请稍后重试');
    } finally {
      setIsDeleting(false);
    }
  };

  const flagEmoji = getFlagEmoji(arrival.destinationCountry);

  return (
    <>
      <div className="group relative flex gap-4 md:gap-6">
        <div className="hidden w-[60px] flex-shrink-0 md:flex md:justify-center">
          <div className="relative mt-6 flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-orange-500 to-amber-500 text-2xl shadow-xl shadow-orange-500/30 transition-transform duration-300 group-hover:scale-105 group-hover:-rotate-3">
            {flagEmoji}
          </div>
        </div>

        <div
          className="relative flex-1 cursor-pointer overflow-hidden rounded-[28px] border border-white/80 bg-white/95 shadow-[0_20px_60px_rgba(15,23,42,0.06)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_24px_70px_rgba(249,115,22,0.12)]"
          onClick={() => setShowDetail(true)}
        >
          <div className="pointer-events-none absolute inset-y-0 left-0 w-1.5 bg-gradient-to-b from-orange-500 via-amber-400 to-emerald-400" />

          <div className="relative p-4 sm:p-5">
            <div className="mb-3 flex items-start justify-between gap-4">
              <div className="flex min-w-0 flex-1 gap-3">
                <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-orange-500 to-amber-500 text-2xl shadow-lg shadow-orange-500/20 md:hidden">
                  {flagEmoji}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="mb-1.5 flex flex-wrap items-center gap-2">
                    <h3 className="truncate text-lg font-bold tracking-tight text-slate-900 sm:text-xl">
                      {arrival.destinationCountry}
                    </h3>
                    {arrival.destinationCity && (
                      <span className="truncate text-sm text-slate-500">· {arrival.destinationCity}</span>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
                    <span className="rounded-full bg-orange-50 px-2.5 py-0.5 font-medium text-orange-700">
                      {formatDate(arrival.arrivedAt)}
                    </span>
                    {arrival.recipientName && (
                      <span className="rounded-full bg-slate-100 px-2.5 py-0.5 font-medium text-slate-600">
                        回复人 · {arrival.recipientName}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="absolute right-4 top-4 opacity-0 transition-opacity duration-300 group-hover:opacity-100 sm:right-5 sm:top-5">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-9 w-9 rounded-full p-0 hover:bg-red-50 hover:text-red-600"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowDeleteConfirm(true);
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="mb-3 flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700">
                <Link className="h-3 w-3 text-slate-500" />
                {arrival.postcardId}
              </span>

              {arrival.travelDays && (
                <span className="inline-flex items-center gap-1 rounded-full border border-orange-100 bg-orange-50 px-2.5 py-1 text-xs font-medium text-orange-700">
                  <Clock className="h-3 w-3" />
                  {arrival.travelDays} 天
                </span>
              )}

              {arrival.distance && (
                <span className="inline-flex items-center gap-1 rounded-full border border-blue-100 bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700">
                  <MapPin className="h-3 w-3" />
                  {formatDistance(arrival.distance)}
                </span>
              )}
            </div>

            <div className="rounded-xl border border-orange-100/70 bg-gradient-to-r from-orange-50/90 via-white to-amber-50/70 p-3 sm:p-4">
              <div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.14em] text-orange-700">
                对方回复
                <ArrowRight className="h-3 w-3" />
              </div>

              {arrival.message ? (
                <div>
                  <p className="line-clamp-2 text-sm leading-7 text-slate-600 italic">
                    “{arrival.message.slice(0, 140)}{arrival.message.length > 140 ? '...' : ''}”
                  </p>
                </div>
              ) : (
                <p className="text-sm leading-6 text-slate-400">暂无留言内容</p>
              )}
            </div>
          </div>
        </div>
      </div>

      <Dialog open={showDetail} onOpenChange={setShowDetail}>
        <DialogContent className="max-h-[80vh] max-w-lg overflow-auto rounded-[28px] border-white/80 bg-white/98 p-0">
          <div className="border-b border-slate-100 bg-gradient-to-r from-orange-500/8 via-white to-amber-500/8 px-6 py-5">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-3 text-xl">
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-500 to-amber-500 text-2xl shadow-lg shadow-orange-500/20">
                  {flagEmoji}
                </span>
                <span>
                  {arrival.destinationCountry}
                  {arrival.destinationCity && ` · ${arrival.destinationCity}`}
                </span>
              </DialogTitle>
            </DialogHeader>
          </div>

          <div className="px-6 py-5">
            <div className="mb-5 grid grid-cols-3 gap-3 text-center">
              <div className="rounded-2xl bg-slate-50 p-3">
                <div className="mb-1 text-xs text-slate-500">明信片 ID</div>
                <div className="font-mono text-sm font-semibold text-slate-900">{arrival.postcardId}</div>
              </div>
              <div className="rounded-2xl bg-orange-50 p-3">
                <div className="mb-1 text-xs text-orange-600">旅途天数</div>
                <div className="text-sm font-bold text-orange-700">{arrival.travelDays || '-'}</div>
              </div>
              <div className="rounded-2xl bg-blue-50 p-3">
                <div className="mb-1 text-xs text-blue-600">距离</div>
                <div className="text-sm font-bold text-blue-700">{formatDistance(arrival.distance)}</div>
              </div>
            </div>

            {/* 留言内容 - 原文 + 中文翻译 */}
            {arrival.message && (
              <div className="space-y-3">
                {/* 原文 */}
                <div className="rounded-[22px] border border-orange-100 bg-gradient-to-r from-orange-50/90 via-white to-amber-50/80 p-4">
                  <div className="mb-2 text-xs font-medium text-orange-700 uppercase tracking-wider">原文</div>
                  <p className="whitespace-pre-wrap text-sm leading-8 text-slate-600 italic">{arrival.message}</p>
                </div>
                
                {/* 中文翻译（如果有） */}
                {arrival.messageAnalysis?.translation && (
                  <div className="rounded-[22px] border border-emerald-100 bg-gradient-to-r from-emerald-50/90 via-white to-teal-50/80 p-4">
                    <div className="mb-2 text-xs font-medium text-emerald-700 uppercase tracking-wider">中文翻译</div>
                    <p className="whitespace-pre-wrap text-sm leading-8 text-slate-700">{arrival.messageAnalysis.translation}</p>
                  </div>
                )}
              </div>
            )}

            {arrival.recipientName && (
              <p className="mt-3 text-sm text-slate-500">— {arrival.recipientName}</p>
            )}

            <div className="mt-5 flex gap-2">
              <Button variant="outline" onClick={() => setShowDetail(false)} className="flex-1 rounded-2xl">
                关闭
              </Button>
              <Button
                variant="outline"
                className="flex-1 rounded-2xl text-red-600 hover:bg-red-50 hover:text-red-700"
                onClick={() => {
                  setShowDetail(false);
                  setShowDeleteConfirm(true);
                }}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                删除
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent className="max-w-sm rounded-[26px]">
          <DialogHeader>
            <DialogTitle>确认删除</DialogTitle>
            <DialogDescription>确定要删除这张明信片记录吗？此操作无法撤销。</DialogDescription>
          </DialogHeader>
          <div className="mb-4 rounded-2xl bg-slate-50 p-3">
            <div className="text-sm font-semibold">{arrival.postcardId}</div>
            <div className="text-xs text-slate-500">{arrival.destinationCountry}</div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowDeleteConfirm(false)} disabled={isDeleting}>
              取消
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={isDeleting}>
              {isDeleting ? '删除中...' : '删除'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
