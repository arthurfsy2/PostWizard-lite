'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Globe,
  MapPin,
  Copy,
  Trash2,
  X,
  Loader2,
  Languages,
  Edit3,
  Calendar,
  Mail,
  Crop,
  RotateCw,
  ImageIcon,
} from 'lucide-react';
import { getFlagEmoji } from '@/lib/flag-emoji';
import { getCountryNameCN } from '@/lib/country-codes';


interface ReceivedCard {
  id: string;
  postcardId?: string | null;
  postcardIdConfirmed?: boolean;
  senderUsername: string | null;
  senderCountry: string | null;
  senderCity: string | null;
  handwrittenText: string | null;
  translatedText: string | null;
  detectedLang: string | null;
  backImageUrl: string | null;
  processedImageUrl: string | null;
  originalImageUrl: string | null;
  frontImageUrl: string | null;
  shareImageUrl: string | null;
  isPublic: boolean;
  receivedAt: string | null;
  createdAt: string;
}

interface CardDetailModalProps {
  card: ReceivedCard | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDelete?: (cardId: string) => void; // 删除回调
}

// 国家代码转国家名称（使用共享工具）
// getCountryNameCN 已从 @/lib/country-codes 导入

// 国家代码转国旗emoji（使用共享工具）
// getFlagEmoji 已从 @/lib/flag-emoji 导入

// 语言代码转语言名称
function getLanguageName(langCode: string | null): string {
  if (!langCode) return '未知';
  
  const langNames: Record<string, string> = {
    'en': '英语',
    'ja': '日语',
    'ko': '韩语',
    'de': '德语',
    'fr': '法语',
    'es': '西班牙语',
    'it': '意大利语',
    'pt': '葡萄牙语',
    'nl': '荷兰语',
    'pl': '波兰语',
    'ru': '俄语',
    'zh': '中文',
    'cs': '捷克语',
    'fi': '芬兰语',
    'sv': '瑞典语',
  };

  return langNames[langCode.toLowerCase()] || langCode;
}



export function CardDetailModal({ 
  card, 
  open, 
  onOpenChange,
  onDelete 
}: CardDetailModalProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('content');
  const [copying, setCopying] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editedHandwrittenText, setEditedHandwrittenText] = useState(card?.handwrittenText || '');
  const [showAdjustDialog, setShowAdjustDialog] = useState(false);
  const [adjusting, setAdjusting] = useState(false);
  const [rotation, setRotation] = useState(0);

  useEffect(() => {
    if (card) {
      setActiveTab('content');
      setEditedHandwrittenText(card.handwrittenText || '');
    }
  }, [card]);

  const handleDelete = async () => {
    if (!card || !onDelete) return;
    
    setDeleting(true);
    try {
      await onDelete(card.id);
      onOpenChange(false);
      // 显示成功提示（由父组件的 onDelete 处理）
    } catch (error: any) {
      console.error('Failed to delete:', error);
      alert('删除失败，请重试');
    } finally {
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  const handleCopy = async (text: string) => {
    try {
      setCopying(true);
      await navigator.clipboard.writeText(text);
      // 可以添加 toast 提示
    } catch (err) {
      // console.error('Failed to copy:', err);
    } finally {
      setCopying(false);
    }
  };

  const handleSaveEdit = async () => {
    if (!card) return;
    
    try {
      const token = localStorage.getItem('auth-storage');
      const response = await fetch(`/api/received-cards/${card.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          handwrittenText: editedHandwrittenText,
          isOcrManualEdit: true,
        }),
      });

      if (response.ok) {
        setIsEditing(false);
        // 刷新页面数据
        window.location.reload();
      } else {
        throw new Error('保存失败');
      }
    } catch (error: any) {
      alert(error.message || '保存失败，请重试');
    }
  };



  if (!card) return null;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl md:max-w-5xl lg:max-w-6xl w-[95vw] max-h-[90vh] overflow-hidden p-0" showClose={false}>
        {/* 渐变头部 */}
        <div className="relative bg-gradient-to-r from-orange-500 to-amber-500 p-5 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {/* 国旗图标 */}
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/20 backdrop-blur-sm text-3xl shadow-lg">
                {getFlagEmoji(card.senderCountry || '')}
              </div>
              
              <div>
                <DialogTitle className="text-xl font-bold">
                  {card.senderUsername ? `@${card.senderUsername}` : '未知寄件人'}
                </DialogTitle>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-white/80">
                  {card.senderCity && (
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3.5 w-3.5" />
                      {card.senderCity}
                    </span>
                  )}
                  <span className="flex items-center gap-1">
                    <Globe className="h-3.5 w-3.5" />
                    {getCountryNameCN(card.senderCountry || '') || card.senderCountry || '未知国家'}
                  </span>
                  {card.receivedAt && (
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3.5 w-3.5" />
                      {new Date(card.receivedAt).toLocaleDateString('zh-CN')}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* 关闭按钮 */}
            <button
              onClick={() => onOpenChange(false)}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-white/20 hover:bg-white/30 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Postcard ID Badge */}
          {card.postcardId && (
            <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-white/20 px-3 py-1.5 text-sm font-mono backdrop-blur-sm">
              <span>🆔 {card.postcardId}</span>
              {card.postcardIdConfirmed && (
                <span className="rounded-full bg-green-400/80 px-2 py-0.5 text-xs font-bold text-white">
                  已确认
                </span>
              )}
            </div>
          )}
        </div>

        {/* 内容区域 */}
        <div className="overflow-y-auto p-5 max-h-[calc(90vh-120px)]">
          {/* 明信片图片 */}
          <div className="relative bg-slate-50 rounded-2xl overflow-hidden mb-5 shadow-inner h-[180px] md:h-[200px]">
            {(card.processedImageUrl || card.backImageUrl || card.frontImageUrl) ? (
              <img
                src={(card.processedImageUrl || card.backImageUrl || card.frontImageUrl) || undefined}
                alt="明信片背面"
                className="w-full h-full object-contain"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-8xl">
                🏺️
              </div>
            )}
            
            {/* 语言标签 */}
            {card.detectedLang && (
              <div className="absolute top-3 right-3">
                <span className="px-3 py-1.5 bg-slate-900/70 backdrop-blur-sm text-white text-sm rounded-full flex items-center gap-1.5">
                  <Languages className="h-4 w-4" />
                  {getLanguageName(card.detectedLang)}
                </span>
              </div>
            )}
          </div>

          {/* Tab 切换 */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="w-full mb-4 bg-slate-100 p-1 rounded-xl">
              <TabsTrigger 
                value="content" 
                className="flex-1 rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-orange-600"
              >
                <Mail className="h-4 w-4 mr-1.5" />
                手写内容
              </TabsTrigger>
              <TabsTrigger 
                value="translation" 
                className="flex-1 rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-orange-600"
              >
                <Languages className="h-4 w-4 mr-1.5" />
                中文翻译
              </TabsTrigger>
            </TabsList>

            {/* 手写内容 */}
            <TabsContent value="content" className="space-y-4">
              {isEditing ? (
                <div className="relative rounded-2xl border border-orange-100 bg-gradient-to-br from-orange-50/80 to-amber-50/80 p-5 shadow-inner">
                  <textarea
                    value={editedHandwrittenText}
                    onChange={(e) => setEditedHandwrittenText(e.target.value)}
                    className="w-full h-[200px] bg-transparent border-0 resize-none focus:ring-0 text-gray-800 font-serif text-lg leading-relaxed"
                    placeholder="请输入手写内容..."
                  />
                  <p className="text-xs text-orange-600 mt-2">
                    💡 直接编辑文字内容，然后点击保存
                  </p>
                </div>
              ) : (
                <div className="relative rounded-2xl border border-orange-100 bg-gradient-to-br from-orange-50/80 to-amber-50/80 p-5 shadow-inner">
                  <pre className="whitespace-pre-wrap text-gray-800 font-serif text-lg leading-relaxed pr-20">
                    {card.handwrittenText || '暂无手写内容'}
                  </pre>
                  {card.handwrittenText && (
                    <div className="absolute top-3 right-3">
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => handleCopy(card.handwrittenText!)}
                        disabled={copying}
                        className="border-orange-200 text-orange-600 hover:bg-orange-50"
                      >
                        <Copy className="h-4 w-4 mr-1" />
                        复制原文
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </TabsContent>

            {/* 中文翻译 */}
            <TabsContent value="translation" className="space-y-4">
              <div className="relative rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50/80 to-cyan-50/80 p-5 shadow-inner">
                <pre className="whitespace-pre-wrap text-gray-800 text-lg leading-relaxed pr-20">
                  {card.translatedText || '暂无翻译内容'}
                </pre>
                {card.translatedText && (
                  <div className="absolute top-3 right-3">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => handleCopy(card.translatedText!)}
                      disabled={copying}
                      className="border-blue-200 text-blue-600 hover:bg-blue-50"
                    >
                      <Copy className="h-4 w-4 mr-1" />
                      复制翻译
                    </Button>
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>

          {/* 操作按钮 */}
          <div className="flex items-center justify-end gap-2 mt-6 pt-4 border-t border-slate-100">
            {isEditing ? (
              <>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={handleSaveEdit}
                  className="border-green-200 text-green-600 hover:bg-green-50"
                >
                  保存
                </Button>
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => {
                    setIsEditing(false);
                    setEditedHandwrittenText(card?.handwrittenText || '');
                  }}
                >
                  取消
                </Button>
              </>
            ) : showDeleteConfirm ? (
              <div className="flex items-center gap-2">
                <Button 
                  variant="destructive" 
                  size="sm"
                  onClick={handleDelete}
                  disabled={deleting}
                >
                  {deleting ? '删除中...' : '确认删除'}
                </Button>
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => setShowDeleteConfirm(false)}
                >
                  取消
                </Button>
              </div>
            ) : (
              <>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setShowAdjustDialog(true)}
                  className="border-amber-200 text-amber-600 hover:bg-amber-50 hover:border-amber-300"
                >
                  <Crop className="h-4 w-4 mr-1" />
                  调整图片
                </Button>

                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setIsEditing(true)}
                  className="border-orange-200 text-orange-600 hover:bg-orange-50 hover:border-orange-300"
                >
                  <Edit3 className="h-4 w-4 mr-1" />
                  编辑
                </Button>

                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setShowDeleteConfirm(true)}
                  className="text-red-500 hover:text-red-600 hover:bg-red-50 border-red-200"
                >
                  <Trash2 className="h-4 w-4 mr-1" />
                  删除
                </Button>
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>

    {/* 调整图片对话框 - 使用嵌套 Dialog */}
    <Dialog open={showAdjustDialog} onOpenChange={setShowAdjustDialog}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-400 to-amber-500 flex items-center justify-center">
              <Crop className="w-5 h-5 text-white" />
            </div>
            <DialogTitle className="text-xl font-bold">调整图片</DialogTitle>
          </div>
        </DialogHeader>

        <div className="space-y-6 pt-2">
          {/* 图片预览 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              当前图片
            </label>
            <div className="relative aspect-[4/3] bg-gray-100 rounded-xl overflow-hidden border-2 border-gray-200">
              {(card?.processedImageUrl || card?.backImageUrl) ? (
                <img
                  src={card.processedImageUrl || card.backImageUrl || undefined}
                  alt="明信片背面"
                  className="w-full h-full object-contain"
                  style={{
                    transform: `rotate(${rotation}deg)`,
                    transition: 'transform 0.3s ease',
                  }}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-400">
                  <ImageIcon className="w-12 h-12" />
                </div>
              )}
            </div>
            <p className="text-xs text-gray-500 mt-2">
              旋转后预览效果，实际处理由后端完成
            </p>
          </div>

          {/* 旋转 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              旋转图片
            </label>
            <div className="flex items-center gap-4">
              <button
                onClick={() => setRotation((prev) => (prev - 90 + 360) % 360)}
                className="p-3 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors"
              >
                <RotateCw className="w-5 h-5" />
              </button>
              <div className="flex-1">
                <input
                  type="range"
                  min="0"
                  max="360"
                  step="90"
                  value={rotation}
                  onChange={(e) => setRotation(Number(e.target.value))}
                  className="w-full"
                />
              </div>
              <span className="text-sm text-gray-600 w-16 text-right">
                {rotation}°
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              点击按钮或拖动滑块，每次旋转 90°
            </p>
          </div>

          {/* 提示信息 */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
            <p className="text-sm text-blue-800">
              💡 当前版本支持旋转和基础增强。裁剪功能即将推出，敬请期待。
            </p>
          </div>

          {/* 操作按钮 */}
          <div className="flex gap-3 pt-4">
            <Button
              onClick={async () => {
                if (!card) return;
                setAdjusting(true);
                try {
                  const storage = localStorage.getItem('auth-storage');
                  const token = storage ? JSON.parse(storage).state.token : null;
                  const response = await fetch(`/api/received-cards/${card.id}/adjust-image`, {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                      Authorization: `Bearer ${token}`,
                    },
                    body: JSON.stringify({
                      rotation,
                      enhance: true,
                      quality: 85,
                    }),
                  });

                  if (response.ok) {
                    alert('图片调整完成！');
                    setShowAdjustDialog(false);
                    setRotation(0);
                    window.location.reload();
                  } else {
                    throw new Error('调整失败');
                  }
                } catch (error: any) {
                  alert(error.message || '调整失败，请重试');
                } finally {
                  setAdjusting(false);
                }
              }}
              disabled={adjusting}
              className="flex-1 bg-gradient-to-r from-orange-500 to-amber-500 text-white hover:from-orange-600 hover:to-amber-600 disabled:opacity-50"
            >
              {adjusting ? (
                <>
                  <Loader2 className="animate-spin h-4 w-4 inline mr-2" />
                  处理中...
                </>
              ) : (
                '确认调整'
              )}
            </Button>
            <Button
              variant="outline"
              onClick={() => setShowAdjustDialog(false)}
              className="border-gray-200"
            >
              取消
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
    </>
  );
}

export default CardDetailModal;
