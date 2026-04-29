'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { Crop, RotateCw, Edit3, RefreshCw, Crown, AlertCircle, Check, ImageIcon } from 'lucide-react';

interface CardData {
  id: string;
  postcardId?: string;           // 明信片 ID
  postcardIdConfirmed?: boolean; // ID 是否已确认
  senderUsername?: string;
  senderCountry?: string;
  senderCity?: string;
  handwrittenText?: string;
  translatedText?: string;       // 中文翻译
  detectedLang?: string;
  ocrConfidence?: number;
  backImageUrl?: string;
  originalImageUrl?: string;
  processedImageUrl?: string;
  imageProcessingStatus?: string;
  frontImageUrl?: string;
  isOcrManualEdit: boolean;
}

interface Template {
  id: string;
  name: string;
  nameEn?: string;
  thumbnail: string;
  isPremium: boolean;
  locked?: boolean;
}

export default function EditCardPage() {
  const router = useRouter();
  const params = useParams();
  const { token, user } = useAuth();
  const cardId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [cardData, setCardData] = useState<CardData | null>(null);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  
  // 检查是否有锁定的付费模板
  const hasLockedTemplates = templates.some(t => t.locked);

  // 编辑表单
  const [formData, setFormData] = useState({
    postcardId: '',
    senderUsername: '',
    senderCountry: '',
    senderCity: '',
    handwrittenText: '',
  });
  
  // Postcard ID 确认状态
  const [postcardIdConfirmed, setPostcardIdConfirmed] = useState(false);
  const [postcardIdUnclear, setPostcardIdUnclear] = useState(false);
  const [reOcrLoading, setReOcrLoading] = useState(false);
  
  // 图片调整相关状态
  const [showAdjustDialog, setShowAdjustDialog] = useState(false);
  const [adjusting, setAdjusting] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [cropRect, setCropRect] = useState<{ x: number; y: number; width: number; height: number } | null>(null);

  // 加载卡片详情
  useEffect(() => {
    if (!token) return;

    const loadCard = async () => {
      try {
        const response = await fetch(`/api/received-cards/${cardId}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (response.ok) {
          const data = await response.json();
          setCardData(data);
          setFormData({
            postcardId: data.postcardId || '',
            senderUsername: data.senderUsername || '',
            senderCountry: data.senderCountry || '',
            senderCity: data.senderCity || '',
            handwrittenText: data.handwrittenText || '',
          });
          // 设置确认状态
          setPostcardIdConfirmed(data.postcardIdConfirmed || false);
          // 如果没有识别到 postcardId，标记为看不清
          setPostcardIdUnclear(!data.postcardId);
        }
      } catch (error) {
        // console.error('Failed to load card:', error);
      } finally {
        setLoading(false);
      }
    };

    loadCard();
  }, [cardId, token]);

  // 加载模板列表
  useEffect(() => {
    const loadTemplates = async () => {
      try {
        const response = await fetch('/api/card-templates');
        if (response.ok) {
          const data = await response.json();
          setTemplates(data.data || []);
          // 默认选择第一个非付费模板
          const freeTemplate = data.data.find((t: Template) => !t.isPremium);
          if (freeTemplate) {
            setSelectedTemplate(freeTemplate.id);
          }
        }
      } catch (error) {
        // console.error('Failed to load templates:', error);
      }
    };

    loadTemplates();
  }, []);

  // 保存编辑
  const handleSave = async () => {
    if (!token) return;

    setSaving(true);
    try {
      const response = await fetch(`/api/received-cards/${cardId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          ...formData,
          postcardIdConfirmed,
          isOcrManualEdit: true,
        }),
      });

      if (response.ok) {
        router.push('/received/history');
      } else {
        throw new Error('保存失败');
      }
    } catch (error: any) {
      alert(error.message || '保存失败');
    } finally {
      setSaving(false);
    }
  };

  // 重新 OCR 识别
  const handleReOcr = async () => {
    if (!token) return;
    if (!confirm('确定要重新识别吗？这将消耗一次 OCR 额度。')) return;

    setReOcrLoading(true);
    try {
      const response = await fetch(`/api/received-cards/${cardId}/rerun-ocr`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        // 更新表单数据
        setFormData({
          postcardId: data.postcardId || '',
          senderUsername: data.senderUsername || '',
          senderCountry: data.senderCountry || '',
          senderCity: data.senderCity || '',
          handwrittenText: data.handwrittenText || '',
        });
        // 重置确认状态
        setPostcardIdConfirmed(false);
        setPostcardIdUnclear(!data.postcardId);
        
        alert(`重新识别成功！剩余 OCR 额度：${data.ocrQuotaRemaining}`);
        // 刷新页面数据
        window.location.reload();
      } else {
        // 先检查响应类型，避免 HTML 错误页面导致 JSON 解析失败
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          const data = await response.json();
          if (data.error === 'OCR_QUOTA_EXCEEDED') {
            if (confirm('OCR 额度已用完，是否前往升级？')) {
              router.push('/donate');
            }
          } else if (data.error === 'OCR_FREQUENCY_LIMITED') {
            alert(`操作过于频繁，请在 1 小时后再试`);
          } else {
            throw new Error(data.message || data.error || '重新识别失败');
          }
        } else {
          // HTML 错误页面，显示友好提示
          throw new Error(`重新识别失败：HTTP ${response.status}，请稍后重试`);
        }
      }
    } catch (error: any) {
      alert(error.message || '重新识别失败');
    } finally {
      setReOcrLoading(false);
    }
  };

  // 生成分享图
  const handleGenerate = async () => {
    if (!token) return;
    if (!selectedTemplate) {
      alert('请先选择一个模板再生成分享图');
      return;
    }

    setGenerating(true);
    try {
      const response = await fetch(`/api/received-cards/${cardId}/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          templateId: selectedTemplate,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        // 跳转到预览页面
        router.push(`/received/history/${cardId}/preview?templateId=${selectedTemplate}`);
      } else {
        const data = await response.json();
        if (data.error === 'PREMIUM_TEMPLATE_REQUIRED') {
          if (confirm('该模板需要付费会员，是否前往升级？')) {
            router.push('/donate');
          }
        } else {
          throw new Error(data.error || '生成失败');
        }
      }
    } catch (error: any) {
      alert(error.message || '生成失败');
    } finally {
      setGenerating(false);
    }
  };

  // 调整图片
  const handleAdjustImage = async () => {
    if (!token) return;

    setAdjusting(true);
    try {
      const response = await fetch(`/api/received-cards/${cardId}/adjust-image`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          rotation,
          cropRect,
          enhance: true,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        alert('图片调整完成！');
        setShowAdjustDialog(false);
        
        // 重新加载卡片数据，避免浏览器缓存
        const refreshResponse = await fetch(`/api/received-cards/${cardId}`, {
          headers: {
            Authorization: `Bearer ${token}`,
            'Cache-Control': 'no-cache',
          },
        });
        
        if (refreshResponse.ok) {
          const refreshedData = await refreshResponse.json();
          setCardData(refreshedData);
          // 更新表单中的图片 URL
          if (refreshedData.backImageUrl || refreshedData.processedImageUrl) {
            // 强制刷新图片，添加时间戳避免缓存
            const imgElement = document.querySelector('img[src*="backImage"]') as HTMLImageElement;
            if (imgElement) {
              imgElement.src = refreshedData.backImageUrl || refreshedData.processedImageUrl || '';
            }
          }
        }
        
        setRotation(0); // 重置旋转角度
      } else {
        throw new Error('调整失败');
      }
    } catch (error: any) {
      alert(error.message || '调整失败，请重试');
    } finally {
      setAdjusting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-orange-50/30 flex items-center justify-center relative overflow-hidden">
        <div className="text-center relative z-10">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto mb-4"></div>
          <p className="text-gray-600">加载中...</p>
        </div>
      </div>
    );
  }

  if (!cardData) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-orange-50/30 flex items-center justify-center relative overflow-hidden">
        <div className="text-center text-gray-600 relative z-10">
          <p>卡片不存在</p>
          <button
            onClick={() => router.push('/received/history')}
            className="mt-4 px-4 py-2 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-xl hover:from-orange-600 hover:to-amber-600 transition-all"
          >
            返回
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-orange-50/30 py-12 px-4 relative overflow-hidden">
      <div className="max-w-4xl mx-auto relative z-10">
        {/* Header - 与 Step3 一致 */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-lg p-8 mb-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                <Edit3 className="w-6 h-6" />
                编辑明信片信息
              </h2>
              {/* Postcard ID 显示区域 */}
              {cardData?.postcardId && (
                <div className="flex items-center gap-4 px-5 py-3 bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-lg min-w-[280px]">
                  <div className="flex-1">
                    <div className="text-xs font-medium text-emerald-700">
                      Postcard ID
                    </div>
                    {postcardIdUnclear ? (
                      <input
                        type="text"
                        value={formData.postcardId}
                        onChange={(e) => setFormData({ ...formData, postcardId: e.target.value })}
                        className="text-xl font-bold text-emerald-700 font-mono bg-white border border-emerald-300 rounded px-2 py-1 w-full focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                        placeholder="请输入正确的 ID"
                      />
                    ) : (
                      <div className="text-xl font-bold text-emerald-700 font-mono">
                        {cardData.postcardId}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2">
                    {postcardIdUnclear ? (
                      <button
                        onClick={() => setPostcardIdUnclear(false)}
                        className="px-4 py-2 text-sm rounded-lg transition-all bg-emerald-500 text-white hover:bg-emerald-600"
                        title="保存"
                      >
                        保存
                      </button>
                    ) : (
                      <>
                        <button
                          onClick={() => setPostcardIdConfirmed(true)}
                          className={`px-4 py-2 text-sm rounded-lg transition-all ${
                            postcardIdConfirmed
                              ? "bg-emerald-500 text-white"
                              : "bg-white text-emerald-700 hover:bg-emerald-50 border border-emerald-200"
                          }`}
                          title="确认"
                        >
                          ✓ 确认
                        </button>
                        <button
                          onClick={() => setPostcardIdUnclear(true)}
                          className={`px-3 py-2 text-sm rounded-lg transition-all ${
                            postcardIdUnclear
                              ? "bg-amber-500 text-white"
                              : "bg-white text-amber-700 hover:bg-amber-50 border border-amber-200"
                          }`}
                          title="看不清"
                        >
                          看不清
                        </button>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleReOcr}
                disabled={reOcrLoading}
                className="text-sm px-3 py-1.5 bg-amber-50 text-amber-700 rounded-lg hover:bg-amber-100 transition-all flex items-center gap-1 disabled:opacity-50"
              >
                <RefreshCw className={`w-3 h-3 ${reOcrLoading ? 'animate-spin' : ''}`} />
                重新识别
              </button>
              <button
                onClick={() => setShowAdjustDialog(true)}
                disabled={adjusting}
                className="text-sm px-3 py-1.5 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-lg hover:from-orange-600 hover:to-amber-600 transition-all flex items-center gap-1 disabled:opacity-50"
              >
                <Crop className="w-3 h-3" />
                调整图片
              </button>
              <button
                onClick={() => router.push('/received/history')}
                className="text-gray-500 hover:text-gray-700 transition-colors px-4 py-2 rounded-lg hover:bg-gray-100"
              >
                × 关闭
              </button>
            </div>
          </div>
        </div>

        {/* 三栏布局：图片 + 英文原文 + 中文翻译 */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* 左栏：图片展示（固定高度，sticky） */}
          <div className="lg:sticky lg:top-6 lg:h-[600px] overflow-y-auto bg-white border border-slate-200 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 p-6">
            <h2 className="text-lg font-semibold mb-4">📷 明信片背面</h2>
            <div className="relative h-full bg-gray-50 rounded-xl overflow-hidden border-2 border-gray-200">
              {(cardData.processedImageUrl || cardData.backImageUrl) ? (
                <img
                  src={cardData.processedImageUrl || cardData.backImageUrl || cardData.originalImageUrl}
                  alt="Back"
                  className="w-full h-full object-contain"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-400">
                  <ImageIcon className="w-12 h-12" />
                </div>
              )}
            </div>
            <div className="flex gap-2 mt-4">
              <button
                onClick={() => setShowAdjustDialog(true)}
                className="flex-1 px-4 py-2 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-lg hover:from-orange-600 hover:to-amber-600 transition-all text-sm font-medium flex items-center justify-center gap-1"
              >
                <Crop className="w-4 h-4" />
                调整图片
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              点击图片可放大查看细节
            </p>
          </div>

          {/* 中间：英文原文 */}
          <div className="bg-white border border-slate-200 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <span className="text-xl">🇬</span>
                英文原文
              </h2>
              <button
                onClick={handleReOcr}
                disabled={reOcrLoading}
                className="text-sm px-3 py-1.5 bg-amber-50 text-amber-700 rounded-lg hover:bg-amber-100 transition-all flex items-center gap-1 disabled:opacity-50"
              >
                <RefreshCw className={`w-3 h-3 ${reOcrLoading ? 'animate-spin' : ''}`} />
                重新识别
              </button>
            </div>

            <div className="space-y-4">
              <div className="bg-amber-50/80 rounded-xl p-4 min-h-[400px]">
                <textarea
                  value={formData.handwrittenText}
                  onChange={(e) => setFormData({ ...formData, handwrittenText: e.target.value })}
                  className="w-full h-full bg-transparent border-0 resize-none focus:ring-0 text-gray-800 font-serif text-base leading-relaxed"
                  placeholder="识别到的手写文字..."
                  rows={20}
                />
              </div>
              
              <div className="flex items-center gap-2 text-amber-600 text-sm">
                <AlertCircle className="w-4 h-4" />
                <span>请仔细核对原文内容</span>
              </div>

              {cardData?.detectedLang && (
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <span>检测语言：</span>
                  <span className="px-2 py-1 bg-gray-100 rounded">{cardData.detectedLang}</span>
                </div>
              )}
            </div>
          </div>

          {/* 右侧：中文翻译 */}
          <div className="bg-white border border-slate-200 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <span className="text-xl">🇨🇳</span>
                中文翻译
              </h2>
              <span className="text-xs px-2 py-1 bg-emerald-100 text-emerald-700 rounded-full">
                仅供参考
              </span>
            </div>

            <div className="space-y-4">
              <div className="bg-emerald-50/80 rounded-xl p-4 min-h-[400px]">
                <pre className="whitespace-pre-wrap text-gray-800 text-base leading-relaxed font-sans">
                  {cardData.translatedText || '暂无翻译内容'}
                </pre>
              </div>
              
              <div className="flex items-center gap-2 text-emerald-600 text-sm">
                <AlertCircle className="w-4 h-4" />
                <span>翻译仅供参考</span>
              </div>
            </div>
          </div>
        </div>

        {/* 底部操作按钮 */}
        <div className="flex items-center justify-end gap-3 pt-6 border-t">
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-3 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-xl font-medium hover:from-orange-600 hover:to-amber-600 disabled:opacity-50 transition-all shadow-lg shadow-orange-500/25 hover:shadow-xl"
          >
            {saving ? '保存中...' : '保存修改'}
          </button>
          <button
            onClick={() => router.push('/received/history')}
            className="px-6 py-3 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-all"
          >
            取消
          </button>
        </div>

        {/* 模板选择 */}
        <div className="mt-8 bg-white border border-slate-200 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">🎨 选择模板</h2>
            {hasLockedTemplates && !user?.isPaidUser && (
              <button
                onClick={() => router.push('/donate')}
                className="text-sm px-3 py-1.5 bg-gradient-to-r from-amber-400 to-orange-500 text-white rounded-full font-medium hover:from-amber-500 hover:to-orange-600 transition-all flex items-center gap-1"
              >
                <span>👑</span>
                <span>升级解锁更多模板</span>
              </button>
            )}
          </div>
          
          {/* 升级提示 */}
          {hasLockedTemplates && !user?.isPaidUser && (
            <div className="mb-4 p-3 bg-amber-50/80 border border-amber-200/50 rounded-xl">
              <p className="text-sm text-amber-800">
                💡 升级付费会员可解锁 <strong>{templates.filter(t => t.isPremium).length}</strong> 款专属模板，生成更精美的分享图！
              </p>
            </div>
          )}
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {templates.map((template) => (
              <div
                key={template.id}
                onClick={() => !template.locked && setSelectedTemplate(template.id)}
                className={`relative border-0 rounded-xl p-4 cursor-pointer transition-all duration-300 ${
                  selectedTemplate === template.id
                    ? 'bg-orange-50 shadow-lg ring-2 ring-orange-500'
                    : 'bg-gray-50 hover:bg-gray-100 hover:shadow-md'
                } ${template.locked ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {template.locked && (
                  <div className="absolute inset-0 flex items-center justify-center bg-white/50 rounded-xl">
                    <span className="text-2xl">🔒</span>
                  </div>
                )}
                <div className="aspect-square bg-white rounded-lg mb-2 overflow-hidden flex items-center justify-center shadow-sm">
                  {template.thumbnail ? (
                    <img
                      src={template.thumbnail}
                      alt={template.name}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZTVlN2ViIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJzYW5zLXNlcmlmIiBmb250LXNpemU9IjE0IiBmaWxsPSIjOWE5ZWE0IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkeT0iLjNlbSI+1LbQsdGBPC90ZXh0Pjwvc3ZnPg==';
                      }}
                    />
                  ) : (
                    <div className="text-center text-gray-400">
                      <div className="text-4xl mb-2">🎨</div>
                      <div className="text-xs">暂无预览</div>
                    </div>
                  )}
                </div>
                <h3 className="font-medium text-sm text-gray-800">{template.name}</h3>
                {template.isPremium && (
                  <span className="text-xs text-yellow-600">👑 付费</span>
                )}
              </div>
            ))}
          </div>

          <button
            onClick={handleGenerate}
            disabled={generating || !selectedTemplate}
            className="w-full mt-6 px-6 py-4 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-xl font-medium hover:from-orange-600 hover:to-amber-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg"
          >
            {generating ? (
              <span className="flex items-center justify-center">
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                生成中...
              </span>
            ) : (
              '生成分享图'
            )}
          </button>
        </div>

        {/* 调整图片对话框 */}
        {showAdjustDialog && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-400 to-amber-500 flex items-center justify-center">
                      <Crop className="w-5 h-5 text-white" />
                    </div>
                    <h3 className="text-xl font-bold text-gray-900">调整图片</h3>
                  </div>
                  <button
                    onClick={() => setShowAdjustDialog(false)}
                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                <div className="space-y-6">
                  {/* 图片预览 */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-3">
                      当前图片
                    </label>
                    <div className="relative aspect-[4/3] bg-gray-100 rounded-xl overflow-hidden border-2 border-gray-200">
                      {(cardData?.processedImageUrl || cardData?.backImageUrl) ? (
                        <img
                          src={cardData.processedImageUrl || cardData.backImageUrl || cardData.originalImageUrl || undefined}
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
                    <button
                      onClick={handleAdjustImage}
                      disabled={adjusting}
                      className="flex-1 px-4 py-3 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-xl font-medium hover:from-orange-600 hover:to-amber-600 disabled:opacity-50 transition-all shadow-lg"
                    >
                      {adjusting ? (
                        <>
                          <svg className="animate-spin h-4 w-4 inline mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          处理中...
                        </>
                      ) : (
                        '确认调整'
                      )}
                    </button>
                    <button
                      onClick={() => setShowAdjustDialog(false)}
                      className="px-4 py-3 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-colors"
                    >
                      取消
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
