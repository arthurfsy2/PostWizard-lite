'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Check, Copy, Download, FileDown, Plus, FileText, Sparkles } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface SentCardContent {
  id: string;
  contentEn: string;
  contentZh?: string;
  content?: string;
  contentBody?: string;
  tone?: string;
}

interface Step3CardProps {
  generatedContents?: SentCardContent[];  // 3 versions
  generatedContent?: SentCardContent;     // single version (backward compat)
  onCopy: (content: SentCardContent) => void;
  onExportMarkdown: (contentId: string) => void;
  onExportPdf: (contentId: string) => void;
  onBack: () => void;
  onCreateNew: () => void;
  onConfirm?: (content: SentCardContent) => void;
  copied: boolean;
}

const TAB_DEFS = [
  { tone: 'precise', label: '事实版', versionLabel: '版本 A', description: '保守、事实导向' },
  { tone: 'warm', label: '温情版', versionLabel: '版本 B', description: '温暖、走心' },
  { tone: 'cultural', label: '文化版', versionLabel: '版本 C', description: '文化交流视角' },
] as const;

export function Step3Card({
  generatedContents,
  generatedContent,
  onCopy,
  onExportMarkdown,
  onExportPdf,
  onBack,
  onCreateNew,
  onConfirm,
  copied,
}: Step3CardProps) {
  const [activeTab, setActiveTab] = useState(1); // default: warm/温情版
  const [confirmed, setConfirmed] = useState(false);

  // Determine if we're in multi-version mode
  const isMultiMode = !!(generatedContents && generatedContents.length > 0);

  // Resolve the active content
  const activeContent: SentCardContent | undefined = isMultiMode
    ? generatedContents!.find((c) => c.tone === TAB_DEFS[activeTab].tone)
      || generatedContents![activeTab]
      || generatedContents![0]
    : generatedContent!;

  const contentEn = activeContent?.contentEn || activeContent?.content || activeContent?.contentBody || '';
  const contentZh = activeContent?.contentZh || '';

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
              <div className="w-14 h-14 rounded-2xl bg-purple-100 flex items-center justify-center">
                <Check className="h-6 w-6 text-purple-600" />
              </div>
              <div>
                <CardTitle className="text-xl">
                  {isMultiMode ? 'Step 3 · 选择你喜欢的版本' : 'Step 3 · 生成完成'}
                </CardTitle>
                <CardDescription>
                  {isMultiMode
                    ? '为你生成了 3 个不同风格的版本，选择最喜欢的一个'
                    : '明信片内容已生成，可以复制或导出'}
                </CardDescription>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Tab 切换栏 — 仅多版本模式 */}
          {isMultiMode && (
            <div className="flex gap-2 mb-6">
              {TAB_DEFS.map((tab, idx) => (
                <button
                  key={tab.tone}
                  type="button"
                  onClick={() => { setActiveTab(idx); setConfirmed(false); }}
                  className={`
                    flex-1 px-4 py-2.5 rounded-full text-sm font-medium transition-all duration-200
                    ${activeTab === idx
                      ? 'bg-orange-500 text-white shadow-md'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}
                  `}
                >
                  <span className="mr-1.5">{tab.versionLabel}</span>
                  <span className={activeTab === idx ? 'text-orange-100' : 'text-slate-400'}>
                    {tab.label}
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* 成功提示 */}
          <div className="flex items-center gap-2 text-emerald-600 mb-6">
            <div className="w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center">
              <Check className="h-4 w-4" />
            </div>
            <span className="font-medium">生成成功</span>
            {isMultiMode && (
              <span className="text-sm text-slate-400 ml-2">
                {TAB_DEFS[activeTab].versionLabel} · {TAB_DEFS[activeTab].description}
              </span>
            )}
          </div>

          {/* 英文/中文内容 - 左右分栏 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            {/* 英文版 */}
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="bg-gradient-to-r from-blue-50 to-cyan-50 px-4 py-3 border-b border-slate-100 flex items-center gap-2">
                <span className="text-lg">{'\u{1F1EC}\u{1F1E7}'}</span>
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
                  <span className="text-lg">{'\u{1F1E8}\u{1F1F3}'}</span>
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
              onClick={() => activeContent && onCopy(activeContent)}
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
              onClick={() => activeContent && onExportMarkdown(activeContent.id)}
              variant="outline"
              className="flex-1 sm:flex-none border-slate-200 hover:bg-slate-50"
            >
              <FileDown className="h-4 w-4 mr-2" />
              导出 MD
            </Button>
            <Button
              onClick={() => activeContent && onExportPdf(activeContent.id)}
              variant="outline"
              className="flex-1 sm:flex-none border-slate-200 hover:bg-slate-50"
            >
              <Download className="h-4 w-4 mr-2" />
              导出 PDF
            </Button>
          </div>

          {/* 底部按钮 */}
          <div className="pt-4 border-t border-slate-200">
            <div className="flex gap-3">
              {isMultiMode && onConfirm && (
                confirmed ? (
                  <div className="flex-1 flex items-center justify-center gap-2 h-12 rounded-lg bg-emerald-50 text-emerald-700 font-medium border border-emerald-200">
                    <Check className="h-5 w-5" />
                    已确认
                  </div>
                ) : (
                  <Button
                    onClick={() => {
                      if (activeContent) {
                        onConfirm(activeContent);
                        setConfirmed(true);
                      }
                    }}
                    className="flex-1 h-12 bg-emerald-600 hover:bg-emerald-700 shadow-lg text-base"
                  >
                    <Sparkles className="h-4 w-4 mr-2" />
                    使用这个版本
                  </Button>
                )
              )}
              <Button
                onClick={onCreateNew}
                className="flex-1 h-12 bg-orange-500 hover:bg-orange-600 shadow-lg"
              >
                <Plus className="h-4 w-4 mr-2" />
                新建一张
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
