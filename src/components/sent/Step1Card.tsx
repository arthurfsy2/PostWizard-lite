'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import { Mail, Send, HelpCircle, Lightbulb, ArrowRight, AlertTriangle } from 'lucide-react';
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

function detectSensitiveHints(content: string, t: (key: string) => string) {
  const text = content.trim();
  if (!text) return [] as string[];

  const warnings: string[] = [];

  const rules = [
    {
      key: 'email',
      pattern: /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i,
      messageKey: 'warningEmail',
    },
    {
      key: 'url',
      pattern: /https?:\/\//i,
      messageKey: 'warningUrl',
    },
    {
      key: 'profile',
      pattern: /profile|postcrossing|username|user id/i,
      messageKey: 'warningProfile',
    },
    {
      key: 'address',
      pattern: /(street|st\.|road|rd\.|avenue|ave\.|lane|ln\.|drive|dr\.|boulevard|blvd|building|room|apartment|apt\.?|floor|fl\.?|district|province|postal code|zip code|postcode|邮编|地址|街道|路|号|室|楼|区)/i,
      messageKey: 'warningAddress',
    },
  ];

  for (const rule of rules) {
    if (rule.pattern.test(text)) {
      warnings.push(t(rule.messageKey));
    }
  }

  const hasAddrWarning = rules.some(r => r.key === 'address' && r.pattern.test(text));
  if (/\d{5,}/.test(text) && !hasAddrWarning) {
    warnings.push(t('warningNumber'));
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
  const t = useTranslations('Step1Card');
  const [helpDialogOpen, setHelpDialogOpen] = useState(false);

  const sensitiveWarnings = useMemo(() => detectSensitiveHints(emailContent, t), [emailContent, t]);
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
                    <h4 className="font-semibold text-amber-900">{t('noProfileTitle')}</h4>
                    <p className="text-sm text-amber-800 mt-1 leading-relaxed">
                      {t('noProfileDesc1')}
                      {t('noProfileDesc2')}
                    </p>
                  </div>
                </div>
              </div>
            )}
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-3">
                <div className="w-14 h-14 rounded-2xl bg-blue-100 flex items-center justify-center">
                  <Mail className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <CardTitle className="text-xl">{t('title')}</CardTitle>
                  <CardDescription>{t('description')}</CardDescription>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setHelpDialogOpen(true)}
                className="p-2 rounded-lg hover:bg-slate-100 transition-colors group"
                title={t('helpTitle')}
              >
                <HelpCircle className="w-5 h-5 text-orange-500 group-hover:scale-110 transition-transform" />
              </button>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={(e) => { e.preventDefault(); onParse(); }} className="space-y-4">
              <div className="rounded-2xl border border-blue-200 bg-blue-50/80 p-4 text-sm text-slate-700">
                <p className="font-semibold text-slate-900">{t('infoBoxTitle')}</p>
                <p className="mt-2 leading-6">{t('infoBoxDesc')}</p>
              </div>

              <div>
                <Textarea
                  id="email-content"
                  value={emailContent}
                  onChange={(e) => onEmailContentChange(e.target.value)}
                  placeholder={t('placeholder')}
                  rows={12}
                  className="font-mono text-sm h-72 resize-none overflow-y-auto border-slate-200 focus:border-blue-500 focus:ring-blue-500"
                />
                <p className="text-sm text-slate-500 mt-2">
                  {t('hint')}
                </p>
              </div>

              {hasSensitiveWarnings && (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                    <div>
                      <p className="font-semibold">{t('sensitiveTitle')}</p>
                      <ul className="mt-2 list-disc space-y-1 pl-5 text-amber-800">
                        {sensitiveWarnings.map((warning) => (
                          <li key={warning}>{warning}</li>
                        ))}
                      </ul>
                      <p className="mt-2 text-xs text-amber-700">
                        {t('sensitiveHint')}
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
                  {t('goToProfile')}
                </Button>
              ) : (
                <Button
                  type="submit"
                  disabled={isParsing || !emailContent.trim()}
                  className="w-full h-12 text-base bg-orange-500 hover:bg-orange-600 shadow-lg"
                >
                  {isParsing ? (
                    <>
                      <Send className="h-4 w-4 mr-2 animate-spin" />
                      {t('parsing')}
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4 mr-2" />
                      {t('parse')}
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
              <span className="text-lg font-semibold text-slate-800">{t('helpDialogTitle')}</span>
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-3">
              {[
                { num: 1, text: t('helpItem1') },
                { num: 2, text: t('helpItem2') },
                { num: 3, text: t('helpItem3') },
                { num: 4, text: t('helpItem4') },
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
                <span className="font-semibold">{t('helpTipPrefix')}</span>
                {t('helpTip')}
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              onClick={() => setHelpDialogOpen(false)}
              className="bg-gradient-to-r from-orange-500 to-amber-500 hover:from-amber-600 hover:to-orange-600"
            >
              {t('helpGotIt')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}


