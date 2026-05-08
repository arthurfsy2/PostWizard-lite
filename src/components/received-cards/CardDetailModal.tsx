'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
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
  Star,
  Check,
} from 'lucide-react';
import { getFlagEmoji } from '@/lib/flag-emoji';
import { getCountryNameCN } from '@/lib/country-codes';


interface GachaEvaluation {
  aiScore: number | null;
  touchingScore: number | null;
  emotionalScore: number | null;
  culturalInsightScore: number | null;
  summary: string | null;
}

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
  rarity?: string | null;
  luckyLevel?: string | null;
  gachaEvaluation?: GachaEvaluation | null;
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
function getLanguageName(langCode: string | null, unknownLabel?: string): string {
  if (!langCode) return unknownLabel || '未知';
  
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
  const t = useTranslations('CardDetail');
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
  const [isEditingId, setIsEditingId] = useState(false);
  const [editedPostcardId, setEditedPostcardId] = useState('');
  const [savingId, setSavingId] = useState(false);

  useEffect(() => {
    if (card) {
      setActiveTab('content');
      setEditedHandwrittenText(card.handwrittenText || '');
      setIsEditingId(false);
      setEditedPostcardId(card.postcardId || '');
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
      alert(t('alertDeleteFailed'));
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
      alert(error.message || t('alertSaveEditFailed'));
    }
  };

  const handleSavePostcardId = async () => {
    if (!card) return;

    const newId = editedPostcardId.trim();
    if (!newId) {
      alert(t('alertEnterId'));
      return;
    }

    setSavingId(true);
    try {
      const token = localStorage.getItem('auth-storage');
      const response = await fetch(`/api/received-cards/${card.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          postcardId: newId,
          postcardIdConfirmed: true,
        }),
      });

      if (response.ok) {
        setIsEditingId(false);
        window.location.reload();
      } else {
        const data = await response.json().catch(() => ({}));
        if (data.error === 'DUPLICATE_POSTCARD_ID') {
          alert(t('alertDuplicateId', { id: newId }));
        } else {
          throw new Error(data.message || data.error || '保存失败');
        }
      }
    } catch (error: any) {
      alert(error.message || t('alertSaveEditFailed'));
    } finally {
      setSavingId(false);
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
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/20 text-3xl shadow-lg">
                {getFlagEmoji(card.senderCountry || '')}
              </div>
              
              <div>
                <DialogTitle className="text-xl font-bold">
                  {card.senderUsername ? `@${card.senderUsername}` : t('unknownSender')}
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
                    {getCountryNameCN(card.senderCountry || '') || card.senderCountry || t('unknownCountry')}
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
          <div className="mt-3">
            {isEditingId ? (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={editedPostcardId}
                  onChange={(e) => setEditedPostcardId(e.target.value)}
                  className="px-3 py-1.5 rounded-lg bg-white/90 text-gray-900 text-sm font-mono focus:ring-2 focus:ring-white/50 focus:outline-none w-48"
                  placeholder={t('idPlaceholder')}
                  autoFocus
                />
                <button
                  onClick={handleSavePostcardId}
                  disabled={savingId}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-green-500/80 hover:bg-green-500 text-white text-xs font-medium transition-colors disabled:opacity-50"
                >
                  {savingId ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                  {t('save')}
                </button>
                <button
                  onClick={() => setIsEditingId(false)}
                  className="px-3 py-1.5 rounded-full bg-white/20 hover:bg-white/30 text-white text-xs font-medium transition-colors"
                >
                  {t('cancel')}
                </button>
              </div>
            ) : (
              <button
                onClick={() => {
                  setEditedPostcardId(card.postcardId || '');
                  setIsEditingId(true);
                }}
                className="inline-flex items-center gap-2 rounded-full bg-white/20 px-3 py-1.5 text-sm font-mono hover:bg-white/30 transition-colors cursor-pointer"
                title={t('modifyId')}
              >
                {card.postcardId ? (
                  <>
                    <span>🆔 {card.postcardId}</span>
                    {card.postcardIdConfirmed && (
                      <span className="rounded-full bg-green-400/80 px-2 py-0.5 text-xs font-bold text-white">
                        {t('confirmed')}
                      </span>
                    )}
                  </>
                ) : (
                  <span className="opacity-70">{t('clickToSetId')}</span>
                )}
                <Edit3 className="h-3 w-3 opacity-70" />
              </button>
            )}
          </div>
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
                <span className="px-3 py-1.5 bg-slate-900/70 text-white text-sm rounded-full flex items-center gap-1.5">
                  <Languages className="h-4 w-4" />
                  {getLanguageName(card.detectedLang, t('unknownLanguage'))}
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
                {t('tabContent')}
              </TabsTrigger>
              <TabsTrigger
                value="translation"
                className="flex-1 rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-orange-600"
              >
                <Languages className="h-4 w-4 mr-1.5" />
                {t('tabTranslation')}
              </TabsTrigger>
              {card.gachaEvaluation && (
                <TabsTrigger
                  value="evaluation"
                  className="flex-1 rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-orange-600"
                >
                  <Star className="h-4 w-4 mr-1.5" />
                  {t('tabEvaluation')}
                </TabsTrigger>
              )}
            </TabsList>

            {/* 手写内容 */}
            <TabsContent value="content" className="space-y-4">
              {isEditing ? (
                <div className="relative rounded-2xl border border-orange-100 bg-gradient-to-br from-orange-50/80 to-amber-50/80 p-5 shadow-inner">
                  <textarea
                    value={editedHandwrittenText}
                    onChange={(e) => setEditedHandwrittenText(e.target.value)}
                    className="w-full h-[200px] bg-transparent border-0 resize-none focus:ring-0 text-gray-800 font-serif text-lg leading-relaxed"
                    placeholder={t('textareaPlaceholder')}
                  />
                  <p className="text-xs text-orange-600 mt-2">
                    {t('editHint')}
                  </p>
                </div>
              ) : (
                <div className="relative rounded-2xl border border-orange-100 bg-gradient-to-br from-orange-50/80 to-amber-50/80 p-5 shadow-inner">
                  <pre className="whitespace-pre-wrap text-gray-800 font-serif text-lg leading-relaxed pr-20">
                    {card.handwrittenText || t('noHandwrittenText')}
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
                        {t('copyOriginal')}
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
                  {card.translatedText || t('noTranslation')}
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
                      {t('copyTranslation')}
                    </Button>
                  </div>
                )}
              </div>
            </TabsContent>

            {/* 抽卡评价 */}
            {card.gachaEvaluation && (
              <TabsContent value="evaluation" className="space-y-4">
                {/* 总分 + 稀有度 */}
                <div className="flex items-center gap-3">
                  {card.gachaEvaluation.aiScore != null && (
                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gradient-to-r from-orange-100 to-amber-100 text-orange-700 text-sm font-semibold">
                      <Star className="w-4 h-4 fill-current" />
                      {t('totalScore', { score: (card.gachaEvaluation.aiScore / 10).toFixed(1) })}
                    </div>
                  )}
                  {card.rarity && (
                    <span className="px-2.5 py-1 rounded-full bg-yellow-100 text-yellow-700 border border-yellow-200 text-xs font-medium">
                      {card.rarity}
                    </span>
                  )}
                  {card.luckyLevel && card.luckyLevel !== "none" && (
                    <span className="text-xs text-amber-600">
                      {card.luckyLevel === "superLucky" ? t('superLucky') : card.luckyLevel === "special" ? t('special') : t('lucky')}
                    </span>
                  )}
                </div>

                {/* AI 评语 */}
                {card.gachaEvaluation.summary && (
                  <div className="rounded-2xl border border-purple-100 bg-gradient-to-br from-purple-50/80 to-pink-50/80 p-5 shadow-inner">
                    <p className="text-xs font-medium text-purple-600 mb-2">{t('aiComment')}</p>
                    <p className="text-sm text-gray-700 leading-relaxed">
                      {card.gachaEvaluation.summary}
                    </p>
                  </div>
                )}

                {/* 维度评分 */}
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { name: t('dimMostTouching'), score: card.gachaEvaluation.touchingScore, icon: "💝" },
                    { name: t('dimEmotional'), score: card.gachaEvaluation.emotionalScore, icon: "💗" },
                    { name: t('dimCultural'), score: card.gachaEvaluation.culturalInsightScore, icon: "🌍" },
                  ].map((dim) => (
                    <div key={dim.name} className="bg-gray-50 rounded-xl p-3">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs text-gray-500">
                          {dim.icon} {dim.name}
                        </span>
                        <span className="text-sm font-bold text-gray-900">
                          {dim.score != null ? (dim.score / 10).toFixed(1) : "-"}
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-1.5 overflow-hidden">
                        <div
                          className="bg-gradient-to-r from-orange-400 to-amber-400 h-full rounded-full transition-all duration-500"
                          style={{ width: `${Math.min(100, dim.score || 0)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </TabsContent>
            )}
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
                  {t('saveEdit')}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setIsEditing(false);
                    setEditedHandwrittenText(card?.handwrittenText || '');
                  }}
                >
                  {t('cancelEdit')}
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
                  {deleting ? t('deleting') : t('confirmDelete')}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowDeleteConfirm(false)}
                >
                  {t('cancelDelete')}
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
                  {t('adjustImage')}
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsEditing(true)}
                  className="border-orange-200 text-orange-600 hover:bg-orange-50 hover:border-orange-300"
                >
                  <Edit3 className="h-4 w-4 mr-1" />
                  {t('edit')}
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowDeleteConfirm(true)}
                  className="text-red-500 hover:text-red-600 hover:bg-red-50 border-red-200"
                >
                  <Trash2 className="h-4 w-4 mr-1" />
                  {t('delete')}
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
            <DialogTitle className="text-xl font-bold">{t('adjustTitle')}</DialogTitle>
          </div>
        </DialogHeader>

        <div className="space-y-6 pt-2">
          {/* 图片预览 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              {t('currentImage')}
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
              {t('rotateHint')}
            </p>
          </div>

          {/* 旋转 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              {t('rotateImage')}
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
              {t('rotateStepHint')}
            </p>
          </div>

          {/* 提示信息 */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
            <p className="text-sm text-blue-800">
              {t('versionHint')}
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
                    alert(t('adjustDone'));
                    setShowAdjustDialog(false);
                    setRotation(0);
                    window.location.reload();
                  } else {
                    throw new Error(t('adjustFailed'));
                  }
                } catch (error: any) {
                  alert(error.message || t('adjustFailed'));
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
                  {t('processing')}
                </>
              ) : (
                t('confirmAdjust')
              )}
            </Button>
            <Button
              variant="outline"
              onClick={() => setShowAdjustDialog(false)}
              className="border-gray-200"
            >
              {t('cancelAdjust')}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
    </>
  );
}

export default CardDetailModal;
