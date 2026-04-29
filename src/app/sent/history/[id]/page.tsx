'use client';

import { useState, useEffect, Suspense } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/hooks/useAuth';
import { Loader2, ArrowLeft, Copy, Check, FileDown, Printer, Mail, MapPin, Globe, Heart, Ban, Search, Calendar, User, Lightbulb, Target } from 'lucide-react';

  interface HistoryDetail {
  id: string;
  contentTitle: string;
  contentBody: string;
  contentEn?: string;
  contentZh?: string;
  tone?: string;
  language: string;
  weather?: string;
  localNews?: string;
  personalStory?: string;
  matchedMaterials?: any[];
  isFavorite: boolean;
  isHandwritten: boolean;
  wordCount?: number;
  usedTokens?: number;
  createdAt: string;
  updatedAt?: string;
  postcard: {
    id: string;
    recipientName: string;
    recipientCountry: string;
    recipientCity: string;
    recipientAddress?: string;
    postcardId: string;
    distance?: number;
    recipientInterests?: string;
    recipientDislikes?: string;
    contentPreference?: string;
    cardPreference?: string;
    languagePreference?: string;
    specialRequests?: string;
    messageToSender?: string;
  } | null;
}

function HistoryDetailPage() {
  const router = useRouter();
  const params = useParams();
  const { isLoading, isAuthenticated, token, user } = useAuth();
  const contentId = params.id as string;

  const [data, setData] = useState<HistoryDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // 加载历史记录详情
  useEffect(() => {
    if (!contentId || !token) return;

    const loadHistoryDetail = async () => {
      try {
        const response = await fetch(`/api/content/${contentId}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });
        if (!response.ok) {
          if (response.status === 401) {
            throw new Error('请先登录');
          }
          throw new Error('加载失败');
        }
        const result = await response.json();
        
        // 调试日志：打印 API 返回的完整数据
        // console.log('=== API 返回数据 ===');
        // console.log('success:', result.success);
        // console.log('data keys:', Object.keys(result.data || {}));
        // console.log('contentZh:', result.data?.contentZh ? '✅ 有值' : '❌ 无值');
        
        if (result.success && result.data) {
          setData(result.data);
        } else {
          throw new Error(result.error || '数据格式错误');
        }
      } catch (err: any) {
        setError(err.message || '加载历史记录失败');
      } finally {
        setLoading(false);
      }
    };

    loadHistoryDetail();
  }, [contentId, token]);

  const handleCopy = async () => {
    if (!data) return;
    const contentEn = data.contentEn || data.contentBody || '';
    const contentZh = data.contentZh || '';

    let textToCopy = contentEn;
    if (contentZh) {
      textToCopy = `【英文版】\n${contentEn}\n\n【中文版】\n${contentZh}`;
    }

    await navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleExportMarkdown = () => {
    if (!data) return;
    const contentEn = data.contentEn || data.contentBody || '';
    const contentZh = data.contentZh || '';
    const postcardId = data.postcard?.postcardId || data.id;
    
    // 标题使用明信片 ID
    let markdown = `# ${postcardId}`;
    
    // 英文内容
    markdown += `\n\n## 建议内容（英文）\n\n${contentEn}`;
    
    // 中文内容（如有）
    if (contentZh) {
      markdown += `\n\n## 建议内容（中文参考）\n\n${contentZh}`;
    }
    
    const blob = new Blob([markdown], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `postcard-${postcardId}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // 计算字数
  const getWordCount = (content?: string): number => {
    if (!content) return 0;
    // 英文按空格分词，中文按字符计数
    const enWords = content.match(/\b[a-zA-Z]+\b/g)?.length || 0;
    const zhChars = content.replace(/[a-zA-Z\s]/g, '').length;
    return enWords + zhChars;
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getToneLabel = (tone?: string) => {
    const toneMap: Record<string, string> = {
      friendly: '友好热情',
      casual: '轻松随意',
      formal: '正式礼貌',
      humorous: '幽默风趣',
      poetic: '文艺诗意',
    };
    return toneMap[tone || ''] || tone || '友好热情';
  };

  // 解析兴趣标签
  const parseInterests = (interests?: string): string[] => {
    if (!interests) return [];
    return interests.split(/[,，]/).map(i => i.trim()).filter(Boolean);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-orange-50/30">
        <Header />
        <main className="flex-1 container py-12 flex justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
        </main>
        <Footer />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-orange-50/30">
        <Header />
        <div className="fixed inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -right-40 w-96 h-96 bg-orange-200/40 rounded-full blur-3xl" />
          <div className="absolute top-1/3 -left-40 w-80 h-80 bg-blue-200/30 rounded-full blur-3xl" />
        </div>
        <main className="flex-1 container py-12">
          <div className="max-w-2xl mx-auto text-center">
            <p className="text-red-500">{error || '数据加载失败'}</p>
            <Button
              onClick={() => router.push('/sent/history')}
              className="mt-4"
              variant="outline"
            >
              返回历史记录
            </Button>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  const postcard = data.postcard;
  const interests = parseInterests(postcard?.recipientInterests);
  const dislikes = parseInterests(postcard?.recipientDislikes);
  const wordCount = getWordCount(data.contentEn || data.contentBody);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-orange-50/30">
      <Header />
      
      <main className="flex-1 container py-12 relative">
        {/* 返回按钮 */}
        <div className="mb-6">
          <Button
            variant="ghost"
            onClick={() => router.push('/sent/history')}
            className="text-slate-600 hover:text-slate-900"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            返回历史记录
          </Button>
        </div>

        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
            <Badge variant="secondary" className="font-mono text-sm bg-slate-100">
              {postcard?.postcardId || '明信片详情'}
            </Badge>
            <span className="text-sm font-normal text-slate-500">
              {data.updatedAt && data.updatedAt !== data.createdAt 
                ? `更新于 ${formatDate(data.updatedAt)}` 
                : `创建于 ${formatDate(data.createdAt)}`}
            </span>
          </h1>
          {/* 操作按钮组 */}
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={handleCopy}
            >
              {copied ? (
                <>
                  <Check className="h-4 w-4 mr-1" />
                  已复制
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4 mr-1" />
                  复制
                </>
              )}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => window.open(`/print/${data.id}`, '_blank')}
            >
              <Printer className="h-4 w-4 mr-1" />
              打印
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handleExportMarkdown}
            >
              <FileDown className="h-4 w-4 mr-1" />
              Markdown
            </Button>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* 第1列: AI 解析结果 */}
          <Card className="border-0 shadow-xl shadow-slate-200/50">
            <CardHeader className="pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
                  <Search className="h-5 w-5 text-emerald-600" />
                </div>
                <div>
                  <CardTitle className="text-lg">解析结果</CardTitle>
                  <CardDescription className="text-xs">收件人详细信息</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {/* 基本信息 */}
                <div>
                  <div className="flex items-center gap-2 mb-3 pb-2 border-b border-slate-200">
                    <User className="h-4 w-4 text-emerald-600" />
                    <span className="text-sm font-semibold text-emerald-600">基本信息</span>
                  </div>
                  
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <Label className="text-slate-500 text-xs">收件人</Label>
                      <p className="font-medium text-slate-900">{postcard?.recipientName || '-'}</p>
                    </div>
                    <div>
                      <Label className="text-slate-500 text-xs">国家/地区</Label>
                      <p className="font-medium text-slate-900">{postcard?.recipientCountry || '-'}</p>
                    </div>
                    <div>
                      <Label className="text-slate-500 text-xs">城市</Label>
                      <p className="font-medium text-slate-900">{postcard?.recipientCity || '-'}</p>
                    </div>
                  </div>
                </div>

                {/* ID 和距离 */}
                {(postcard?.postcardId || postcard?.distance) && (
                  <div>
                    <div className="grid grid-cols-2 gap-4">
                      {postcard?.postcardId && (
                        <div>
                          <Label className="text-slate-500 text-xs mb-1 block">明信片 ID</Label>
                          <Badge variant="secondary" className="font-mono text-sm bg-slate-100">
                            {postcard.postcardId}
                          </Badge>
                        </div>
                      )}
                      {postcard?.distance && (
                        <div>
                          <Label className="text-slate-500 text-xs mb-1 block">距离</Label>
                          <p className="text-sm text-slate-700">{postcard.distance.toLocaleString()} km</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* 语言偏好 */}
                {postcard?.languagePreference && (
                  <div>
                    <div className="flex items-center gap-2 mb-3 pb-2 border-b border-slate-200">
                      <Globe className="h-4 w-4 text-emerald-600" />
                      <span className="text-sm font-semibold text-emerald-600">语言偏好</span>
                    </div>
                    <p className="text-sm text-slate-700">{postcard.languagePreference}</p>
                  </div>
                )}

                {/* 兴趣爱好 */}
                {interests.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-3 pb-2 border-b border-slate-200">
                      <Heart className="h-4 w-4 text-emerald-600" />
                      <span className="text-sm font-semibold text-emerald-600">收片偏好</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {interests.map((interest, index) => (
                        <Badge
                          key={index}
                          className="bg-emerald-50 text-emerald-700 border-emerald-200"
                        >
                          {interest}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* 收片厌恶 */}
                {dislikes.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-3 pb-2 border-b border-slate-200">
                      <Ban className="h-4 w-4 text-emerald-600" />
                      <span className="text-sm font-semibold text-emerald-600">收片厌恶</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {dislikes.map((dislike, index) => (
                        <Badge
                          key={index}
                          className="bg-red-50 text-red-700 line-through border-red-200"
                        >
                          {dislike}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* 内容喜好 */}
                {postcard?.contentPreference && (
                  <div>
                    <div className="flex items-center gap-2 mb-3 pb-2 border-b border-slate-200">
                      <Lightbulb className="h-4 w-4 text-emerald-600" />
                      <span className="text-sm font-semibold text-emerald-600">内容喜好</span>
                    </div>
                    <p className="text-sm text-slate-700">{postcard.contentPreference}</p>
                  </div>
                )}

                {/* 想你写的内容 */}
                {postcard?.messageToSender && (
                  <div>
                    <div className="flex items-center gap-2 mb-3 pb-2 border-b border-slate-200">
                      <Mail className="h-4 w-4 text-emerald-600" />
                      <span className="text-sm font-semibold text-emerald-600">想收到的内容</span>
                    </div>
                    <p className="text-sm font-medium text-slate-700 bg-emerald-50 p-3 rounded-lg">
                      {postcard.messageToSender}
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* 第2列: 建议内容（英文） */}
          <Card className="border-0 shadow-xl shadow-slate-200/50">
            <CardHeader className="pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center">
                  <Check className="h-5 w-5 text-white" />
                </div>
                <div>
                  <CardTitle className="text-lg">建议内容（英文）</CardTitle>
                  <CardDescription className="text-xs">
                    {getToneLabel(data.tone)} · {wordCount} 字
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* 英文内容 */}
                <div className="border-0 rounded-xl p-4 bg-gradient-to-br from-slate-50 to-slate-100">
                  <pre className="whitespace-pre-wrap text-sm font-sans text-slate-700 leading-relaxed">
                    {data.contentEn || data.contentBody || ''}
                  </pre>
                </div>

                {/* 元数据 - 消耗 tokens */}
                <div className="text-xs text-slate-400 pt-2 border-t border-slate-100 flex justify-between">
                  <span>消耗: {data.usedTokens || 0} tokens</span>
                  <span>{wordCount} 字</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 第3列: 建议内容（中文参考） */}
          <Card className="border-0 shadow-xl shadow-slate-200/50">
            <CardHeader className="pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center">
                  <span className="text-white text-sm font-bold">中</span>
                </div>
                <div>
                  <CardTitle className="text-lg">建议内容（中文参考）</CardTitle>
                  <CardDescription className="text-xs">中文翻译参考</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* 中文内容 */}
                {data.contentZh ? (
                  <div className="border-0 rounded-xl p-4 bg-gradient-to-br from-slate-50 to-slate-100">
                    <pre className="whitespace-pre-wrap text-sm font-sans text-slate-700 leading-relaxed">
                      {data.contentZh}
                    </pre>
                  </div>
                ) : (
                  <div className="text-sm text-slate-400 text-center py-8">
                    暂无中文翻译
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
      <Footer />
    </div>
  );
}

export default function HistoryDetailPageWithSuspense() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-orange-50/30">
        <Header />
        <main className="flex-1 container py-12 flex justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
        </main>
        <Footer />
      </div>
    }>
      <HistoryDetailPage />
    </Suspense>
  );
}
