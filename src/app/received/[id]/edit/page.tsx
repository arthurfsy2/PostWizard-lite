'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { Crown, Edit3, RefreshCw } from 'lucide-react';

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
        router.push(`/received-cards/${cardId}/preview?templateId=${selectedTemplate}`);
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
            onClick={() => router.push('/received-cards')}
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
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-orange-100 flex items-center justify-center shadow-lg">
              <Edit3 className="w-7 h-7 text-orange-600" />
            </div>
            <h1 className="text-3xl font-bold text-gray-900">
              编辑识别结果
            </h1>
          </div>
          <button
            onClick={handleReOcr}
            disabled={reOcrLoading}
            className="px-4 py-2 bg-white text-orange-600 rounded-xl hover:bg-orange-50 disabled:opacity-50 flex items-center gap-2 shadow-md transition-all border border-slate-200"
          >
            {reOcrLoading ? (
              <>
                <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                识别中...
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4" />
                重新识别
              </>
            )}
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* 左侧：图片预览 */}
          <div className="bg-white border border-slate-200 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 p-6">
            <h2 className="text-lg font-semibold mb-4">📷 明信片背面</h2>
            {cardData.backImageUrl && (
              <img
                src={cardData.backImageUrl}
                alt="Back"
                className="w-full rounded-xl"
              />
            )}
          </div>

          {/* 中间：编辑表单 */}
          <div className="bg-white border border-slate-200 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 p-6">
            <h2 className="text-lg font-semibold mb-4">📝 识别内容</h2>

            <div className="space-y-4">
              {/* Postcard ID - 关键字段，高亮显示 */}
              <div className={`p-4 rounded-lg border-2 ${postcardIdConfirmed ? 'border-green-500 bg-green-50' : postcardIdUnclear ? 'border-orange-300 bg-orange-50' : 'border-blue-500 bg-blue-50'}`}>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-bold text-gray-800">
                    🆔 Postcard ID
                  </label>
                  {postcardIdConfirmed ? (
                    <span className="inline-flex items-center px-2 py-1 bg-green-500 text-white text-xs rounded-full">
                      ✓ 已确认
                    </span>
                  ) : postcardIdUnclear ? (
                    <span className="inline-flex items-center px-2 py-1 bg-orange-500 text-white text-xs rounded-full">
                      ⚠️ 待确认
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2 py-1 bg-blue-500 text-white text-xs rounded-full">
                      请确认
                    </span>
                  )}
                </div>
                
                {!postcardIdUnclear && !postcardIdConfirmed && (
                  <button
                    type="button"
                    onClick={() => setPostcardIdUnclear(true)}
                    className="text-xs text-gray-500 hover:text-orange-600 underline"
                  >
                    看不清？
                  </button>
                )}
                
                {postcardIdUnclear ? (
                  <div className="space-y-3">
                    <p className="text-sm text-orange-700">
                      明信片 ID 识别不清，请先去 Postcrossing 网站登记此明信片
                    </p>
                    <a
                      href="https://www.postcrossing.com/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center px-3 py-2 bg-orange-500 text-white text-sm rounded-lg hover:bg-orange-600 transition-colors"
                    >
                      🔗 前往 Postcrossing 登记
                      <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                    </a>
                    <p className="text-xs text-gray-500">
                      提示：在 Postcrossing 登记后，ID 会显示更清晰
                    </p>
                    <div>
                      <input
                        type="text"
                        value={formData.postcardId}
                        onChange={(e) => {
                          setFormData({ ...formData, postcardId: e.target.value });
                          setPostcardIdUnclear(false);
                        }}
                        className="w-full px-3 py-2 border border-orange-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                        placeholder="手动输入 Postcard ID（如 CN-1234567）"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <input
                      type="text"
                      value={formData.postcardId}
                      onChange={(e) => {
                        setFormData({ ...formData, postcardId: e.target.value });
                        setPostcardIdConfirmed(false);
                      }}
                      className="w-full px-3 py-2 border-2 border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-lg"
                      placeholder="如：CN-1234567"
                    />
                    <button
                      onClick={() => setPostcardIdConfirmed(true)}
                      disabled={!formData.postcardId || postcardIdConfirmed}
                      className={`w-full px-4 py-2 rounded-lg font-medium transition-colors ${
                        postcardIdConfirmed
                          ? 'bg-green-500 text-white cursor-default'
                          : 'bg-green-600 text-white hover:bg-green-700'
                      } disabled:opacity-50 disabled:cursor-not-allowed`}
                    >
                      {postcardIdConfirmed ? '✓ ID 已确认正确' : '确认 Postcard ID 正确'}
                    </button>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  寄件人用户名
                </label>
                <input
                  type="text"
                  value={formData.senderUsername}
                  onChange={(e) => setFormData({ ...formData, senderUsername: e.target.value })}
                  className="w-full px-3 py-2 border-0 bg-gray-50 rounded-lg focus:ring-2 focus:ring-orange-500"
                  placeholder="如：hanako2024"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    国家
                  </label>
                  <input
                    type="text"
                    value={formData.senderCountry}
                    onChange={(e) => setFormData({ ...formData, senderCountry: e.target.value })}
                    className="w-full px-3 py-2 border-0 bg-gray-50 rounded-lg focus:ring-2 focus:ring-orange-500"
                    placeholder="如：JP"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    城市
                  </label>
                  <input
                    type="text"
                    value={formData.senderCity}
                    onChange={(e) => setFormData({ ...formData, senderCity: e.target.value })}
                    className="w-full px-3 py-2 border-0 bg-gray-50 rounded-lg focus:ring-2 focus:ring-orange-500"
                    placeholder="如：Tokyo"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  手写内容
                </label>
                <textarea
                  value={formData.handwrittenText}
                  onChange={(e) => setFormData({ ...formData, handwrittenText: e.target.value })}
                  rows={8}
                  className="w-full px-3 py-2 border-0 bg-gray-50 rounded-lg focus:ring-2 focus:ring-orange-500"
                  placeholder="识别到的手写文字..."
                />
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex-1 px-4 py-2 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-xl hover:from-orange-600 hover:to-amber-600 disabled:opacity-50 transition-all shadow-lg"
                >
                  {saving ? '保存中...' : '保存修改'}
                </button>
                <button
                  onClick={() => router.push('/received-cards')}
                  className="px-4 py-2 border-0 bg-gray-100 rounded-xl hover:bg-gray-200 transition-all"
                >
                  取消
                </button>
              </div>
            </div>
          </div>

          {/* 右侧：翻译内容 */}
          <div className="bg-white border border-slate-200 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 p-6">
            <h2 className="text-lg font-semibold mb-4">🇨🇳 中文翻译</h2>
            <div className="space-y-4">
              <div className="bg-orange-50/80 rounded-xl p-4 min-h-[300px]">
                <pre className="whitespace-pre-wrap text-gray-800 text-base leading-relaxed">
                  {cardData.translatedText || '暂无翻译内容'}
                </pre>
              </div>
              <p className="text-xs text-gray-500">
                翻译仅供参考
              </p>
            </div>
          </div>
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
      </div>
    </div>
  );
}
