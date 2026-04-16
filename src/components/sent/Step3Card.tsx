'use client';

import { motion } from 'framer-motion';
import { Check, Copy, Download, FileDown, Sparkles, FileText } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface GeneratedContent {
  id: string;
  contentEn: string;
  contentZh?: string;
  content?: string;
  contentBody?: string;
}

interface Step3CardProps {
  generatedContent: GeneratedContent;
  onCopy: () => void;
  onExportMarkdown: () => void;
  onExportPdf: () => void;
  onBack: () => void;
  onCreateNew: () => void;
  copied: boolean;
}

export function Step3Card({
  generatedContent,
  onCopy,
  onExportMarkdown,
  onExportPdf,
  onBack,
  onCreateNew,
  copied,
}: Step3CardProps) {
  const contentEn = generatedContent?.contentEn || generatedContent?.content || generatedContent?.contentBody || '';
  const contentZh = generatedContent?.contentZh || '';

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <Card className="border-0 shadow-lg hover:shadow-xl transition-all duration-300">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-500 flex items-center justify-center">
                <Check className="h-6 w-6 text-white" />
              </div>
              <div>
                <CardTitle className="text-xl">Step 3 · 生成完成</CardTitle>
                <CardDescription>明信片内容已生成，可以复制或导出</CardDescription>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* 成功提示 */}
          <div className="flex items-center gap-2 text-emerald-600 mb-6">
            <div className="w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center">
              <Check className="h-4 w-4" />
            </div>
            <span className="font-medium">生成成功</span>
          </div>

          {/* 英文/中文内容 - 左右分栏 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            {/* 英文版 */}
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="bg-gradient-to-r from-blue-50 to-cyan-50 px-4 py-3 border-b border-slate-100 flex items-center gap-2">
                <span className="text-lg">🇬🇧</span>
                <span className="font-medium text-slate-700">英文原文</span>
              </div>
              <div className="p-4 max-h-[300px] overflow-y-auto">
                <pre className="text-sm whitespace-pre-wrap font-sans text-slate-700 leading-relaxed">
                  {contentEn}
                </pre>
              </div>
            </div>

            {/* 中文版 */}
            {contentZh ? (
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <div className="bg-gradient-to-r from-orange-50 to-amber-50 px-4 py-3 border-b border-slate-100 flex items-center gap-2">
                  <span className="text-lg">🇨🇳</span>
                  <span className="font-medium text-slate-700">中文参考</span>
                </div>
                <div className="p-4 max-h-[300px] overflow-y-auto">
                  <pre className="text-sm whitespace-pre-wrap font-sans text-slate-600 leading-relaxed">
                    {contentZh}
                  </pre>
                </div>
              </div>
            ) : (
              <div className="bg-slate-50 rounded-xl border border-dashed border-slate-200 flex items-center justify-center p-8">
                <div className="text-center text-slate-400">
                  <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">暂无中文翻译</p>
                </div>
              </div>
            )}
          </div>

          {/* 操作按钮组 */}
          <div className="flex flex-wrap gap-2 mb-6">
            <Button
              onClick={onCopy}
              variant="outline"
              className="flex-1 sm:flex-none border-slate-200 hover:bg-slate-50"
            >
              {copied ? (
                <>
                  <Check className="h-4 w-4 mr-2 text-emerald-500" />
                  已复制
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4 mr-2" />
                  复制内容
                </>
              )}
            </Button>
            <Button
              onClick={onExportMarkdown}
              variant="outline"
              className="flex-1 sm:flex-none border-slate-200 hover:bg-slate-50"
            >
              <FileDown className="h-4 w-4 mr-2" />
              导出 MD
            </Button>
            <Button
              onClick={onExportPdf}
              variant="outline"
              className="flex-1 sm:flex-none border-slate-200 hover:bg-slate-50"
            >
              <Download className="h-4 w-4 mr-2" />
              导出 PDF
            </Button>
          </div>

          {/* 底部按钮 */}
          <div className="pt-4 border-t border-slate-200">
            <Button
              onClick={onCreateNew}
              className="h-12 w-full bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 shadow-lg"
            >
              <Sparkles className="h-4 w-4 mr-2" />
              新建一张
            </Button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}