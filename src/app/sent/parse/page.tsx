'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { useExportMarkdown, useExportPdf } from '@/hooks/useApi';
import { ProgressIndicator } from '@/components/sent/ProgressIndicator';
import { Step1Card } from '@/components/sent/Step1Card';
import { Step2Card } from '@/components/sent/Step2Card';
import { Step3Card } from '@/components/sent/Step3Card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { AlertTriangle, Loader2 } from 'lucide-react';

interface AIParsedRecipient {
  id?: string;
  name: string;
  country: string;
  city: string;
  address: string;
  postcardId: string;
  distance?: number;
  interests: string[];
  dislikes?: string[];
  messageToSender?: string;
  cardPreference?: string;
  contentPreference?: string;
  languagePreference?: string;
  specialRequests?: string;
  source?: string;
  profileRaw?: string;
}

function PastePageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // 编辑模式状态
  const editId = searchParams.get('editId');
  const [isEditLoading, setIsEditLoading] = useState(false);
  const [editError, setEditError] = useState('');

  // 3 步流程状态
  const [currentStep, setCurrentStep] = useState(1);
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);

  // Step 1 状态
  const [emailContent, setEmailContent] = useState('');
  const [isParsing, setIsParsing] = useState(false);
  const [error, setError] = useState('');

  // Step 2 状态
  const [parsedData, setParsedData] = useState<AIParsedRecipient | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [hasMaterials, setHasMaterials] = useState<boolean | null>(null);

  // Step 3 状态
  const [generatedContents, setGeneratedContents] = useState<any[]>([]);
  const [generatedContent, setGeneratedContent] = useState<any>(null);
  const [copied, setCopied] = useState(false);

  // 重复记录确认对话框状态
  const [duplicateDialogOpen, setDuplicateDialogOpen] = useState(false);
  const [duplicateInfo, setDuplicateInfo] = useState<{
    postcardId: string;
    formattedTime: string;
    pendingData: any;
  } | null>(null);

  const exportMarkdownMutation = useExportMarkdown();
  const exportPdfMutation = useExportPdf();

  useEffect(() => {
    const checkProfile = async () => {
      try {
        const response = await fetch('/api/profile');
        if (response.ok) {
          const data = await response.json();
          const profile = data.profile || {};
          // 检查是否有个人简介
          const hasAboutMe = profile.aboutMe && profile.aboutMe.trim().length > 0;
          setHasMaterials(hasAboutMe);
        } else {
          setHasMaterials(false);
        }
      } catch (error) {
        // console.error('检查个人要素失败:', error);
        setHasMaterials(false);
      }
    };

    checkProfile();
  }, []);

  // 编辑模式：加载历史记录数据
  useEffect(() => {
    if (!editId) return;

    const loadHistoryContent = async () => {
      setIsEditLoading(true);
      setEditError('');

      try {
        const response = await fetch(`/api/content/${editId}`);

        if (!response.ok) {
          throw new Error('加载历史记录失败');
        }

        const result = await response.json();

          if (result.success && result.data) {
          const content = result.data;

          // 预填充 Step 2 状态（解析数据）
          if (content.postcard) {
            setParsedData({
              id: content.postcard.id || '',
              name: content.postcard.recipientName || '',
              country: content.postcard.recipientCountry || '',
              city: content.postcard.recipientCity || '',
              address: content.postcard.recipientAddress || '',
              postcardId: content.postcard.postcardId || '',
              interests: content.postcard.recipientInterests
                ? content.postcard.recipientInterests.split(',').map((i: string) => i.trim())
                : [],
            });
          }

          // 预填充 Step 3 状态（生成内容）
          setGeneratedContent({
            id: content.id,
            title: content.contentTitle,
            content: content.contentBody,
            contentEn: content.contentEn,
            contentZh: content.contentZh,
            tone: content.tone,
            language: content.language,
            weather: content.weather,
            localNews: content.localNews,
            personalStory: content.personalStory,
            matchedMaterials: content.matchedMaterials,
            usedTokens: content.usedTokens,
            createdAt: content.createdAt,
          });

          // 设置步骤状态为全部完成，直接显示 Step 3
          setCompletedSteps([1, 2]);
          setCurrentStep(3);
        } else {
          throw new Error(result.error || '加载历史记录失败');
        }
      } catch (err: any) {
        // console.error('加载历史记录失败:', err);
        setEditError(err.message || '加载历史记录失败，请重试');
      } finally {
        setIsEditLoading(false);
      }
    };

    loadHistoryContent();
  }, [editId]);

  const handleAIParse = async () => {
    if (!emailContent.trim()) {
      setError('请粘贴邮件内容');
      return;
    }

    setIsParsing(true);
    setError('');

    try {
      const response = await fetch('/api/content/paste', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ content: emailContent }),
      });

      const result = await response.json();

      if (result.success && result.data) {
        // 检查是否是重复记录
        if (result.isDuplicate && result.duplicateInfo) {
          setDuplicateInfo({
            postcardId: result.duplicateInfo.postcardId,
            formattedTime: result.duplicateInfo.formattedTime,
            pendingData: result.data,
          });
          setDuplicateDialogOpen(true);
        } else {
          setParsedData(result.data);
          // 完成 Step 1，进入 Step 2
          setCompletedSteps([...completedSteps, 1]);
          setCurrentStep(2);
        }
      } else {
        setError(result.error || '解析失败，请检查邮件格式');
      }
    } catch (err) {
      setError('网络错误，请稍后重试');
    } finally {
      setIsParsing(false);
    }
  };

  const handleConfirmDuplicate = () => {
    if (duplicateInfo?.pendingData) {
      setParsedData(duplicateInfo.pendingData);
      setCompletedSteps([...completedSteps, 1]);
      setCurrentStep(2);
    }
    setDuplicateDialogOpen(false);
    setDuplicateInfo(null);
  };

  const handleCancelDuplicate = () => {
    setDuplicateDialogOpen(false);
    setDuplicateInfo(null);
    setEmailContent('');
  };

  const handleGenerate = async () => {
    if (!parsedData?.id) return;

    setIsGenerating(true);
    try {
      const tones = ['precise', 'warm', 'cultural'];
      const results = await Promise.all(
        tones.map(t =>
          fetch('/api/content/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ recipientId: parsedData.id, tone: t }),
          }).then(r => r.json())
        )
      );
      const contents = results.filter(r => r.success && r.data).map(r => r.data);

      if (contents.length > 0) {
        setGeneratedContents(contents);
        setGeneratedContent(contents[0]);
        // 完成 Step 2，进入 Step 3
        setCompletedSteps([...completedSteps, 2]);
        setCurrentStep(3);
      } else {
        alert('生成失败，请重试');
      }
    } catch (err) {
      // console.error('生成失败:', err);
      alert('生成失败，请重试');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopy = async (content?: any) => {
    const target = content || generatedContent;
    const contentEn = target?.contentEn || target?.content || target?.contentBody || '';
    const contentZh = target?.contentZh || '';

    let textToCopy = contentEn;
    if (contentZh) {
      textToCopy = `【英文版】\n${contentEn}\n\n【中文版】\n${contentZh}`;
    }

    if (textToCopy) {
      await navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleExportMarkdown = async (contentId?: string) => {
    const id = contentId || generatedContent?.id;
    if (!id) return;
    try {
      const result = await exportMarkdownMutation.mutateAsync(id);
      if (result.success && result.markdown) {
        const blob = new Blob([result.markdown], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = result.filename || `postcard-${id}.md`;
        a.click();
        URL.revokeObjectURL(url);
      } else {
        alert(result.error || '导出失败，请重试');
      }
    } catch (err) {
      // console.error('导出失败:', err);
      alert('导出失败，请重试');
    }
  };


  const handleExportPdf = async (contentId?: string) => {
    const id = contentId || generatedContent?.id;
    if (!id) return;
    try {
      const result = await exportPdfMutation.mutateAsync({
        contentIds: [id],
        format: 'a4',
      });

      if (result.success && result.pdf) {
        const link = document.createElement('a');
        link.href = result.pdf;
        link.download = `postcard-${parsedData?.postcardId || id}.pdf`;
        link.click();
      } else {
        alert(result.error || '导出失败，请重试');
      }
    } catch (err) {
      alert('导出失败，请重试');
    }
  };


  const handleGoToProfile = () => {
    router.push('/profile');
  };

  // 新建一张明信片 - 清空所有状态回到 Step 1
  const handleCreateNew = () => {
    setCurrentStep(1);
    setCompletedSteps([]);
    setEmailContent('');
    setParsedData(null);
    setGeneratedContent(null);
    setGeneratedContents([]);
    setError('');
  };

  // 返回上一步
  const handleBackToStep1 = () => {
    setCurrentStep(1);
    setCompletedSteps(completedSteps.filter(s => s < 1));
  };

  const handleBackToStep2 = () => {
    setCurrentStep(2);
    setCompletedSteps(completedSteps.filter(s => s < 2));
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-orange-50/30">
      <Header />

      <main className="container mx-auto px-4 py-12">
        {/* Hero Section */}
        <section className="relative mb-8 overflow-hidden">
          <div className="relative">
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-center">
              <span className="text-slate-900">明信片写作</span>
              <span className="mx-2 text-slate-300">|</span>
              <span className="bg-gradient-to-r from-orange-500 via-amber-500 to-orange-500 bg-clip-text text-transparent">
                3 步轻松完成
              </span>
            </h1>
          </div>
        </section>

        {/* 进度指示器 */}
        <ProgressIndicator currentStep={currentStep} completedSteps={completedSteps} />

        {/* 编辑模式加载状态 */}
        {isEditLoading && (
          <div className="max-w-3xl mx-auto mt-8">
            <div className="bg-white rounded-2xl border border-slate-200 p-12 shadow-lg">
              <div className="flex flex-col items-center gap-4">
                <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
                <p className="text-slate-600">正在加载历史记录...</p>
              </div>
            </div>
          </div>
        )}

        {/* 编辑模式错误提示 */}
        {editError && (
          <div className="max-w-3xl mx-auto mt-8">
            <Alert variant="destructive" className="bg-red-50 border-red-200">
              <AlertDescription className="text-red-700">{editError}</AlertDescription>
            </Alert>
          </div>
        )}

        {/* 分步内容 - 只显示当前步骤 */}
        <div className="max-w-3xl mx-auto">
          {/* Step 1: 粘贴邮件内容 */}
          {currentStep === 1 && !isEditLoading && (
            <Step1Card
              emailContent={emailContent}
              onEmailContentChange={setEmailContent}
              onParse={handleAIParse}
              isParsing={isParsing}
              hasProfile={hasMaterials}
              onGoToProfile={handleGoToProfile}
              isPaidUser={true}
            />
          )}

          {/* Step 2: 解析结果 */}
          {currentStep === 2 && parsedData && !isEditLoading && (
            <div className="mt-8">
              <Step2Card
                parsedData={parsedData}
                onGenerate={handleGenerate}
                onBack={handleBackToStep1}
                isGenerating={isGenerating}
                hasMaterials={hasMaterials}
                onGoToMaterials={handleGoToProfile}
              />
            </div>
          )}

          {/* Step 3: 生成完成 */}
          {currentStep === 3 && generatedContent && !isEditLoading && (
            <div className="mt-8">
              <Step3Card
                generatedContents={generatedContents}
                generatedContent={generatedContent}
                onCopy={handleCopy}
                onExportMarkdown={handleExportMarkdown}
                onExportPdf={handleExportPdf}
                onBack={handleBackToStep2}
                onCreateNew={handleCreateNew}
                onConfirm={async (content) => {
                  setGeneratedContent(content);
                  if (content?.postcardId) {
                    await fetch('/api/content/confirm-selection', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ contentId: content.id, postcardId: content.postcardId }),
                    });
                  }
                }}
                copied={copied}
              />
            </div>
          )}

          {/* 错误提示 */}
          {error && currentStep === 1 && (
            <div className="mt-8 max-w-3xl mx-auto">
              <Alert variant="destructive" className="bg-red-50 border-red-200">
                <AlertDescription className="text-red-700">{error}</AlertDescription>
              </Alert>
            </div>
          )}
        </div>
      </main>

      <Footer />

      {/* 重复记录确认对话框 */}
      <Dialog open={duplicateDialogOpen} onOpenChange={setDuplicateDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-600">
              <AlertTriangle className="h-5 w-5" />
              检测到重复记录
            </DialogTitle>
            <DialogDescription className="pt-4 text-slate-700">
              <span className="block mb-4">
                检测到明信片 ID <span className="font-mono font-bold text-amber-600">{duplicateInfo?.postcardId}</span> 已经在
              </span>
              <span className="block bg-slate-50 p-3 rounded-lg text-center font-medium text-slate-800 mb-4">
                {duplicateInfo?.formattedTime}
              </span>
              <span className="block mb-4">读取过了，请问要再次识别吗？</span>
              <span className="block text-sm text-slate-500">
                选择"覆盖"将更新该明信片的解析结果。
              </span>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={handleCancelDuplicate}
              className="sm:w-full"
            >
              取消
            </Button>
            <Button
              onClick={handleConfirmDuplicate}
              className="sm:w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600"
            >
              覆盖记录
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// 主页面组件，包裹在 Suspense 中
export default function PastePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
          <p className="text-slate-600">加载中...</p>
        </div>
      </div>
    }>
      <PastePageContent />
    </Suspense>
  );
}
