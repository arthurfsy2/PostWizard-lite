'use client';

import { useAuthStore } from '@/lib/stores/auth-store';
import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ArrowLeft, AlertCircle } from 'lucide-react';
import { ProgressIndicator } from '@/components/sent/ProgressIndicator';
import { Step2Card } from '@/components/sent/Step2Card';
import { Step3Card } from '@/components/sent/Step3Card';
interface ParsedData {
  id?: string;
  name: string;
  country: string;
  city: string;
  address: string;
  postcardId: string;
  distance: number;
  interests: string[];
  dislikes: string[];
  messageToSender: string;
  cardPreference: string;
  contentPreference: string;
  languagePreference: string;
  specialRequests: string;
  source: string;
  // 素材检查
  hasMaterials?: boolean;
  filledMaterialsCategories?: string[];
}

export default function EmailDetailPage() {
  const router = useRouter();
  const params = useParams();
  const postcardId = params.id as string; // 使用 postcardId 作为参数
  
  // 支持从 URL 参数中读取唯一的 parseKey（处理重复 postcardId）
  const searchParams = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
  const parseKey = searchParams.get('parseKey');
  
  const { token, user, isLoading: authLoading, fetchUser } = useAuthStore();
  
  const [parsedData, setParsedData] = useState<ParsedData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Step 状态
  const [currentStep, setCurrentStep] = useState(2); // 从 Step 2 开始
  const [completedSteps, setCompletedSteps] = useState<number[]>([1, 2]);
  
  // Step 2 状态
  const [tone, setTone] = useState('friendly');
  const [isGenerating, setIsGenerating] = useState(false);
  
  // Step 3 状态
  const [generatedContent, setGeneratedContent] = useState<any>(null);
  const [copied, setCopied] = useState(false);
  
  // 素材状态
  const [hasMaterials, setHasMaterials] = useState<boolean | null>(null);

  // 判断是否已登录
  const isAuthenticated = !!token && !!user;

  // 获取用户信息
  useEffect(() => {
    if (token && !user && !authLoading) {
      fetchUser();
    }
  }, [token, user, authLoading, fetchUser]);

  // 获取素材状态（统一逻辑）- 只执行一次，避免循环依赖
  useEffect(() => {
    if (!token || !isAuthenticated || hasMaterials !== null) return;
    
    const fetchMaterialsStatus = async () => {
      try {
        const response = await fetch('/api/content/materials', {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });
        
        if (response.ok) {
          const result = await response.json();
          const materials = result.materials || {};
          
          // 统一判断逻辑：是否有任何一个分类填写了内容
          const hasAnyMaterial = Object.values(materials).some(
            (content: any) => content && content.toString().trim().length > 0
          );
          
          setHasMaterials(hasAnyMaterial);
        }
      } catch (error) {
        console.error('[EmailDetail] 获取素材状态失败:', error);
      }
    };
    
    fetchMaterialsStatus();
  }, [token, isAuthenticated, hasMaterials]);

  // 从 sessionStorage 获取解析数据
  useEffect(() => {
    // 优先使用 parseKey（处理重复 postcardId 的情况）
    const storageKey = parseKey || `email_parse_data_${postcardId}`;
    const stored = sessionStorage.getItem(storageKey);
    
    if (stored) {
      try {
        const data = JSON.parse(stored) as ParsedData;
        setParsedData(data);
        setCurrentStep(2);
        setCompletedSteps([1, 2]);
        
        // 从 parsedData 中获取 hasMaterials（如果 API 已返回）
        if (data.hasMaterials !== undefined) {
          setHasMaterials(data.hasMaterials);
        }
      } catch (e) {
        setError('解析数据错误，请重新解析邮件');
      }
    } else {
      setError('未找到解析数据，请先解析邮件');
    }
    setIsLoading(false);
  }, [postcardId, parseKey]);

  // 处理生成内容
  const handleGenerate = async () => {
    if (!parsedData) return;
    
    // 如果没有 id，需要先创建 Postcard 记录
    if (!parsedData.id) {
      try {
        const response = await fetch('/api/content/paste', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({ 
            content: parsedData.messageToSender,
            isFromEmail: true,
            emailId: null, // 不再需要 emailId
            postcardId: parsedData.postcardId,
          }),
        });
        
        const result = await response.json();
        if (result.success && result.data) {
          setParsedData({ ...parsedData, id: result.data.id });
          
          // 处理重复检测
          if (result.isDuplicate) {
            const confirmOverwrite = window.confirm(
              `这张明信片（${parsedData.postcardId}）之前已经创建过了（${result.duplicateInfo?.formattedTime}）。\n\n` +
              `是否要覆盖原有内容？\n\n` +
              `点击"确定"覆盖，点击"取消"使用原有记录。`
            );
            
            if (!confirmOverwrite) {
              // 使用原有记录，继续生成
              setParsedData({ ...parsedData, id: result.data.id });
            }
          }
        }
      } catch (err) {
        alert('创建明信片记录失败，请重试');
        return;
      }
    }

    setIsGenerating(true);
    try {
      const response = await fetch('/api/content/generate', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          recipientId: parsedData.id,
          tone,
        }),
      });

      const result = await response.json();

      if (result.success && result.data) {
        setGeneratedContent(result.data);
        setCompletedSteps([...completedSteps, 3]);
        setCurrentStep(3);
      } else {
        alert(result.error || '生成失败，请重试');
      }
    } catch (err) {
      alert('生成失败，请重试');
    } finally {
      setIsGenerating(false);
    }
  };

  // 处理导出 Markdown
  const handleExportMarkdown = async () => {
    if (!generatedContent?.id) return;
    try {
      const response = await fetch(`/api/content/${generatedContent.id}/export/markdown`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      const result = await response.json();
      if (result.success && result.data?.markdown) {
        const blob = new Blob([result.data.markdown], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = result.data.filename || `postcard-${generatedContent.id}.md`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (err) {
      alert('导出失败，请重试');
    }
  };

  // 处理导出 PDF
  const handleExportPdf = async () => {
    if (!generatedContent?.id) return;
    try {
      const response = await fetch(`/api/content/${generatedContent.id}/export/pdf`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `postcard-${parsedData?.postcardId || generatedContent.id}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert('导出失败，请重试');
    }
  };

  // 返回列表
  const handleBackToEmails = () => {
    router.push('/emails');
  };

  // 新建一张
  const handleCreateNew = () => {
    router.push('/emails');
  };

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-orange-50/30 flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 border-4 border-orange-200 border-t-orange-500 rounded-full animate-spin mx-auto" />
          <p className="text-slate-600">加载中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-orange-50/30">
      <Header />
      
      <main className="container mx-auto px-4 py-12">
        {/* 返回按钮 */}
        <Button
          variant="ghost"
          className="mb-4 -ml-4 text-slate-600"
          onClick={handleBackToEmails}
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          返回邮箱列表
        </Button>

        {/* 进度指示器 */}
        <ProgressIndicator currentStep={currentStep} completedSteps={completedSteps} />

        {/* 错误状态 */}
        {error && (
          <div className="max-w-3xl mx-auto mt-8">
            <Alert variant="destructive" className="bg-red-50 border-red-200">
              <AlertCircle className="h-4 w-4 text-red-500" />
              <AlertDescription className="text-red-700">{error}</AlertDescription>
            </Alert>
            <div className="mt-6 text-center">
              <Button
                onClick={handleBackToEmails}
                className="bg-gradient-to-r from-orange-500 to-amber-500"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                返回邮箱列表
              </Button>
            </div>
          </div>
        )}

        {/* Step 2: AI 解析结果 */}
        {currentStep === 2 && parsedData && (
          <div className="mt-8">
            <Step2Card
              parsedData={parsedData}
              tone={tone}
              onToneChange={setTone}
              onGenerate={handleGenerate}
              onBack={handleBackToEmails}
              isGenerating={isGenerating}
              hasMaterials={hasMaterials}
              onGoToMaterials={() => router.push('/materials')}
            />
          </div>
        )}

        {/* Step 3: 生成完成 */}
        {currentStep === 3 && generatedContent && (
          <div className="mt-8">
            <Step3Card
              generatedContent={generatedContent}
              onCopy={() => {
                navigator.clipboard.writeText(generatedContent.markdown);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              }}
              onExportMarkdown={handleExportMarkdown}
              onExportPdf={handleExportPdf}
              onBack={() => setCurrentStep(2)}
              onCreateNew={handleCreateNew}
              copied={copied}
            />
          </div>
        )}
      </main>
      
      <Footer />
    </div>
  );
}
