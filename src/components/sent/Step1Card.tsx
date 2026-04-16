'use client';

import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Mail, Sparkles, HelpCircle, Lightbulb, ArrowRight, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface Step1CardProps {
  emailContent: string;
  onEmailContentChange: (content: string) => void;
  onParse: () => void;
  isParsing: boolean;
  hasProfile: boolean | null;
  onGoToProfile: () => void;
}

function detectSensitiveHints(content: string) {
  const text = content.trim();
  if (!text) return [] as string[];

  const warnings: string[] = [];

  const rules = [
    {
      key: 'email',
      pattern: /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i,
      message: '检测到邮箱地址，系统解析时会自动忽略这类联系方式，建议尽量只保留与写作相关的信息。',
    },
    {
      key: 'url',
      pattern: /https?:\/\//i,
      message: '检测到链接，系统会自动弱化链接与页面信息，建议优先保留兴趣、语言、偏好等内容。',
    },
    {
      key: 'profile',
      pattern: /profile|postcrossing|username|user id/i,
      message: '检测到账号/Profile 相关信息，系统会尽量只提取写作所需摘要，不保留平台识别信息。',
    },
    {
      key: 'address',
      pattern: /(street|st\.|road|rd\.|avenue|ave\.|lane|ln\.|drive|dr\.|boulevard|blvd|building|room|apartment|apt\.?|floor|fl\.?|district|province|postal code|zip code|postcode|邮编|地址|街道|路|号|室|楼|区)/i,
      message: '检测到疑似地址信息，系统解析时会尽量忽略详细地址，仅提取国家、语言、兴趣和写作偏好。',
    },
  ];

  for (const rule of rules) {
    if (rule.pattern.test(text)) {
      warnings.push(rule.message);
    }
  }

  if (/\d{5,}/.test(text) && !warnings.includes('检测到疑似地址信息，系统解析时会尽量忽略详细地址，仅提取国家、语言、兴趣和写作偏好。')) {
    warnings.push('检测到连续数字；如果其中包含邮编、电话或门牌号，系统会在解析时尽量跳过这类敏感片段。');
  }

  return warnings;
}

export function Step1Card({
  emailContent,
  onEmailContentChange,
  onParse,
  isParsing,
  hasProfile,
  onGoToProfile,
}: Step1CardProps) {
  const [helpDialogOpen, setHelpDialogOpen] = useState(false);

  const sensitiveWarnings = useMemo(() => detectSensitiveHints(emailContent), [emailContent]);
  const hasSensitiveWarnings = sensitiveWarnings.length > 0;

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <Card className="border-0 shadow-lg hover:shadow-xl transition-all duration-300">
          <CardHeader className="pb-4">
            {hasProfile === false && (
              <div className="bg-gradient-to-r from-amber-50 to-orange-50 border-b border-amber-200 p-4 -mx-6 -mt-6 mb-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center flex-shrink-0">
                    <AlertTriangle className="h-5 w-5 text-white" />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-semibold text-amber-900">检测到您尚未填写个人要素</h4>
                    <p className="text-sm text-amber-800 mt-1 leading-relaxed">
                      为了让 AI 生成更有温度、更个性化的内容，建议先填写一些个人简介、随心记或兴趣标签。
                      这样生成的明信片内容会更自然，避免空洞的套话。
                    </p>
                  </div>
                </div>
              </div>
            )}
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-3">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
                  <Mail className="h-6 w-6 text-white" />
                </div>
                <div>
                  <CardTitle className="text-xl">Step 1 · 选择收件人</CardTitle>
                  <CardDescription>粘贴一段收件人资料或通知内容，AI 会自动提炼写作重点</CardDescription>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setHelpDialogOpen(true)}
                className="p-2 rounded-lg hover:bg-slate-100 transition-colors group"
                title="查看帮助"
              >
                <HelpCircle className="w-5 h-5 text-orange-500 group-hover:scale-110 transition-transform" />
              </button>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={(e) => { e.preventDefault(); onParse(); }} className="space-y-4">
              <div className="rounded-2xl border border-blue-200 bg-blue-50/80 p-4 text-sm text-slate-700">
                <p className="font-semibold text-slate-900">尽量少操作，剩下的交给系统</p>
                <p className="mt-2 leading-6">
                  你可以直接粘贴一段收件人资料、通知内容或自己整理的摘要。系统会优先提取兴趣、语言、国家、偏好和写作主题，
                  并自动弱化详细地址、联系方式、账号/Profile 等非必要信息。
                </p>
              </div>

              <div>
                <Textarea
                  id="email-content"
                  value={emailContent}
                  onChange={(e) => onEmailContentChange(e.target.value)}
                  placeholder={`直接粘贴一段资料即可，例如：
Austria
Languages: German, English, Finnish (learning)
Likes: ice hockey, animals, retro movies, travel cards
Wants: warm, personal, culture-related postcard content`}
                  rows={12}
                  className="font-mono text-sm h-72 resize-none overflow-y-auto border-slate-200 focus:border-blue-500 focus:ring-blue-500"
                />
                <p className="text-sm text-slate-500 mt-2">
                  AI 会自动提炼可用于写作的重点，并尽量忽略地址、联系方式和平台识别信息
                </p>
              </div>

              {hasSensitiveWarnings && (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                    <div>
                      <p className="font-semibold">已检测到可自动弱化处理的信息</p>
                      <ul className="mt-2 list-disc space-y-1 pl-5 text-amber-800">
                        {sensitiveWarnings.map((warning) => (
                          <li key={warning}>{warning}</li>
                        ))}
                      </ul>
                      <p className="mt-2 text-xs text-amber-700">
                        不需要你手动整理得很细，系统会优先保留写作有用的信息，再继续生成建议。
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {hasProfile === false ? (
                <Button
                  type="button"
                  onClick={onGoToProfile}
                  className="w-full h-12 text-base bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 shadow-lg"
                >
                  <ArrowRight className="h-4 w-4 mr-2" />
                  前往填写个人要素
                </Button>
              ) : (
                <Button
                  type="submit"
                  disabled={isParsing || !emailContent.trim()}
                  className="w-full h-12 text-base bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 shadow-lg"
                >
                  {isParsing ? (
                    <>
                      <Sparkles className="h-4 w-4 mr-2 animate-spin" />
                      AI 解析中...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4 mr-2" />
                      下一步：AI 智能解析
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </>
                  )}
                </Button>
              )}
            </form>
          </CardContent>
        </Card>
      </motion.div>

      <Dialog open={helpDialogOpen} onOpenChange={setHelpDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3 pb-3 border-b border-orange-100">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center flex-shrink-0">
                <HelpCircle className="w-6 h-6 text-white" />
              </div>
              <span className="text-lg font-semibold text-slate-800">如何快速整理写作信息？</span>
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-3">
              {[
                { num: 1, text: '直接复制一段收件人资料、通知内容，或你自己顺手整理的摘要' },
                { num: 2, text: '不需要专门重写成固定模板，系统会自动提取兴趣、语言、国家和写作偏好' },
                { num: 3, text: '如果内容里混有地址、邮箱、链接或账号信息，系统会尽量自动弱化和忽略' },
                { num: 4, text: '点击“AI 智能解析”，继续生成更适合这位收件人的写作建议' },
              ].map((item) => (
                <div key={item.num} className="flex gap-3">
                  <div className="w-7 h-7 rounded-full bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                    {item.num}
                  </div>
                  <div className="flex-1">
                    <p className="text-slate-600 leading-relaxed">{item.text}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-200 rounded-xl p-4 flex gap-3">
              <Lightbulb className="w-5 h-5 text-orange-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-orange-800 leading-relaxed">
                <span className="font-semibold">提示：</span>
                这个步骤的重点是快。你只需要提供大致内容，系统会优先整理成适合写作辅助的摘要，而不是要求你手动做完整脱敏。
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              onClick={() => setHelpDialogOpen(false)}
              className="bg-gradient-to-r from-orange-500 to-amber-500 hover:from-amber-600 hover:to-orange-600"
            >
              知道了
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}


