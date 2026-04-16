'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { toPng } from 'html-to-image';
import { Download, Copy, ArrowLeft, Sparkles, Image } from 'lucide-react';
// 安全的 HTML 净化函数（避免 isomorphic-dompurify 的 Node.js 兼容问题）
const sanitizeHtml = (html: string): string => {
  if (typeof window === 'undefined') {
    return html;
  }
  const div = document.createElement('div');
  div.textContent = html;
  return div.innerHTML;
};

export default function PreviewPage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const { token } = useAuth();
  const cardId = params.id as string;
  const templateIdParam = searchParams.get('templateId');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [cardData, setCardData] = useState<any>(null);
  const [template, setTemplate] = useState<any>(null);
  const [isPremium, setIsPremium] = useState(false);
  const previewRef = useRef<HTMLDivElement>(null);

  // 加载卡片和模板数据
  useEffect(() => {
    if (!token || !cardId) return;

    const loadData = async () => {
      setLoading(true);
      setError(null);
      try {
        // 获取卡片数据
        const cardRes = await fetch(`/api/received-cards/${cardId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!cardRes.ok) {
          throw new Error('获取卡片数据失败');
        }
        const card = await cardRes.json();
        setCardData(card);

        // 确定使用的模板ID：优先使用URL参数，否则使用数据库中的
        let targetTemplateId = templateIdParam;
        if (!targetTemplateId && card.templateId) {
          targetTemplateId = card.templateId;
        }
        
        if (!targetTemplateId) {
          // 没有模板，返回选择模板页面
          router.push(`/received/share?cardId=${cardId}`);
          return;
        }

        // 获取模板列表
        const templateRes = await fetch('/api/card-templates', {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (templateRes.ok) {
          const data = await templateRes.json();
          const tpl = data.data?.find((t: any) => t.id === targetTemplateId);
          if (tpl) {
            setTemplate(tpl);
            // 根据模板是否锁定判断用户是否为付费用户
            setIsPremium(!tpl.locked);
          } else {
            throw new Error('模板不存在或已下线');
          }
        } else {
          throw new Error('获取模板列表失败');
        }
      } catch (err: any) {
        // console.error('Failed to load data:', err);
        setError(err.message || '加载失败');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [cardId, templateIdParam, token, router]);

  // 下载分享图
  const handleDownload = async () => {
    if (!previewRef.current) return;

    setDownloading(true);
    try {
      const dataUrl = await toPng(previewRef.current, {
        width: 1080,
        height: 1080,
        pixelRatio: 2,
      });

      // 创建下载链接
      const link = document.createElement('a');
      link.download = `postcard-${cardData?.senderCountry || 'share'}-${new Date().toISOString().split('T')[0]}.png`;
      link.href = dataUrl;
      link.click();

      alert('图片已保存');
    } catch (error: any) {
      // console.error('Download failed:', error);
      alert('生成图片失败，请重试');
    } finally {
      setDownloading(false);
    }
  };

  // 复制小红书文案
  const handleCopyCaption = () => {
    const caption = `📬 收到一张来自 ${cardData?.senderCountry} 的明信片！
    
${cardData?.handwrittenText?.substring(0, 100) || ''}...

#Postcrossing #明信片 #收到的明信片 #手写信 #治愈系`;
    
    navigator.clipboard.writeText(caption);
    alert('文案已复制到剪贴板');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-orange-50/30 flex items-center justify-center relative overflow-hidden">
        {/* 装饰球 */}
        <div className="absolute top-20 left-20 w-64 h-64 bg-orange-200/40 rounded-full blur-3xl"></div>
        <div className="absolute bottom-20 right-20 w-48 h-48 bg-blue-200/30 rounded-full blur-3xl"></div>
        <div className="text-center relative z-10">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto mb-4"></div>
          <p className="text-gray-600">加载中...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-orange-50/30 flex items-center justify-center relative overflow-hidden">
        {/* 装饰球 */}
        <div className="absolute top-20 left-20 w-64 h-64 bg-orange-200/40 rounded-full blur-3xl"></div>
        <div className="absolute bottom-20 right-20 w-48 h-48 bg-blue-200/30 rounded-full blur-3xl"></div>
        <div className="text-center text-gray-600 relative z-10">
          <p className="text-red-600 mb-2">{error}</p>
          <button
            onClick={() => router.push('/received/history')}
            className="mt-4 px-4 py-2 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-xl hover:from-orange-600 hover:to-amber-600 transition-all"
          >
            返回我的收信
          </button>
        </div>
      </div>
    );
  }

  if (!cardData || !template) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-orange-50/30 flex items-center justify-center relative overflow-hidden">
        {/* 装饰球 */}
        <div className="absolute top-20 left-20 w-64 h-64 bg-orange-200/40 rounded-full blur-3xl"></div>
        <div className="absolute bottom-20 right-20 w-48 h-48 bg-blue-200/30 rounded-full blur-3xl"></div>
        <div className="text-center text-gray-600 relative z-10">
          <p>数据加载失败</p>
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
      {/* 装饰球 */}
      <div className="absolute top-20 left-20 w-64 h-64 bg-orange-200/40 rounded-full blur-3xl"></div>
      <div className="absolute bottom-20 right-20 w-48 h-48 bg-blue-200/30 rounded-full blur-3xl"></div>
      <div className="absolute top-1/3 left-1/4 w-40 h-40 bg-amber-100/50 rounded-full blur-2xl"></div>

      <div className="max-w-6xl mx-auto relative z-10">
        <div className="flex items-center justify-center mb-8 gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-orange-400 to-amber-500 flex items-center justify-center shadow-lg">
            <Sparkles className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900">
            分享图预览
          </h1>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* 预览区域 */}
          <div className="bg-white/80 backdrop-blur-sm border-0 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 p-6">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Image className="w-5 h-5 text-orange-500" />
              预览效果
            </h2>
            
            <div
              ref={previewRef}
              className="aspect-square w-full"
              style={{
                transformOrigin: 'top left',
              }}
            >
              {/* 模板渲染 */}
              <div
                className="w-full h-full relative"
                dangerouslySetInnerHTML={{
                  __html: sanitizeHtml(renderTemplate(template.htmlTemplate, cardData, !isPremium)),
                }}
                style={{
                  ...(template.cssStyle ? parseCSS(template.cssStyle) : {}),
                }}
              />
            </div>
          </div>

          {/* 操作区域 */}
          <div className="space-y-6">
            <div className="bg-white/80 backdrop-blur-sm border-0 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 p-6">
              <h2 className="text-lg font-semibold mb-4">🎯 操作</h2>
              
              <div className="space-y-4">
                <button
                  onClick={handleDownload}
                  disabled={downloading}
                  className="w-full px-6 py-4 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-xl font-medium hover:from-orange-600 hover:to-amber-600 disabled:opacity-50 transition-all flex items-center justify-center gap-2 shadow-lg hover:shadow-xl hover:-translate-y-0.5"
                >
                  {downloading ? (
                    <span className="flex items-center justify-center">
                      <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      生成中...
                    </span>
                  ) : (
                    <>
                      <Download className="w-5 h-5" />
                      下载高清图片
                    </>
                  )}
                </button>

                <button
                  onClick={handleCopyCaption}
                  className="w-full px-6 py-4 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-all flex items-center justify-center gap-2"
                >
                  <Copy className="w-5 h-5" />
                  复制小红书文案
                </button>

                <button
                  onClick={() => router.push('/received/history')}
                  className="w-full px-6 py-4 border border-gray-200 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-all flex items-center justify-center gap-2"
                >
                  <ArrowLeft className="w-5 h-5" />
                  返回我的收信
                </button>
              </div>
            </div>

            {/* 卡片信息 */}
            <div className="bg-white/80 backdrop-blur-sm border-0 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 p-6">
              <h2 className="text-lg font-semibold mb-4">📋 卡片信息</h2>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">寄件人</span>
                  <span className="font-medium">{cardData.senderUsername || '未知'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">来自</span>
                  <span className="font-medium">
                    {cardData.senderCity || ''} {cardData.senderCountry || ''}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">收到日期</span>
                  <span className="font-medium">
                    {cardData.receivedAt ? new Date(cardData.receivedAt).toLocaleDateString() : '未设置'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">模板</span>
                  <span className="font-medium">{template.name}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// 网站链接（用于引流）
const WEBSITE_URL = 'https://postcrossing-wizard.vercel.app';
const WEBSITE_NAME = 'Postcrossing Wizard';

// 简单的模板渲染函数（实际应该用 Handlebars/Nunjucks）
function renderTemplate(htmlTemplate: string, data: any, showWatermark: boolean = true) {
  let result = htmlTemplate
    .replace(/{{senderUsername}}/g, data.senderUsername || 'Unknown')
    .replace(/{{senderCountry}}/g, data.senderCountry || 'Unknown')
    .replace(/{{senderCity}}/g, data.senderCity || '')
    .replace(/{{handwrittenText}}/g, data.handwrittenText || '')
    .replace(/{{receivedDate}}/g, data.receivedAt ? new Date(data.receivedAt).toLocaleDateString() : '')
    .replace(/{{countryFlag}}/g, getCountryFlag(data.senderCountry));

  // 添加水印（免费用户）
  if (showWatermark) {
    const watermarkHTML = `
      <div style="position: absolute; bottom: 20px; left: 50%; transform: translateX(-50%); 
                  font-size: 14px; color: rgba(0,0,0,0.4); text-align: center;
                  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;">
        Created with ${WEBSITE_NAME} · ${WEBSITE_URL}
      </div>
    `;
    // 注入水印到模板容器
    result = result.replace('</body>', `${watermarkHTML}</body>`);
  }

  return result;
}

function getCountryFlag(countryCode?: string): string {
  if (!countryCode) return '🏳️';
  const codePoints = countryCode
    .toUpperCase()
    .split('')
    .map((char) => 127397 + char.charCodeAt(0));
  return String.fromCodePoint(...codePoints);
}

function parseCSS(cssString: string): React.CSSProperties {
  // 简化的 CSS 解析（实际应该用更完善的方案）
  const styles: React.CSSProperties = {};
  const lines = cssString.split('\n').filter(line => line.trim());
  
  // 提取根元素的样式
  const containerMatch = cssString.match(/\.card-container\s*\{([\s\S]*?)\}/);
  if (containerMatch) {
    const rules = containerMatch[1].split(';');
    rules.forEach(rule => {
      const [prop, value] = rule.split(':').map(s => s?.trim());
      if (prop && value) {
        const cssProp = prop.replace(/-([a-z])/g, (g) => g[1].toUpperCase()) as keyof React.CSSProperties;
        styles[cssProp] = value as any;
      }
    });
  }
  
  return styles;
}
