'use client';

import { useState, useEffect } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { motion } from 'framer-motion';
import {
  Check, User, Heart, Globe, Ban, FileText, Lightbulb, ArrowRight, ArrowLeft, ChevronDown
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';

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
}

interface InspirationEntry {
  trigger: string;
  label: string;
  hint: string;
  content: string;
}

interface Step2CardProps {
  parsedData: AIParsedRecipient;
  onGenerate: () => void;
  onBack: () => void;
  isGenerating: boolean;
  hasMaterials: boolean | null;
  onGoToMaterials: () => void;
  inspirationNotes?: string;
  onSaveInspiration?: (notes: string) => Promise<void>;
}

export function Step2Card({
  parsedData,
  onGenerate,
  onBack,
  isGenerating,
  hasMaterials,
  onGoToMaterials,
  inspirationNotes,
  onSaveInspiration,
}: Step2CardProps) {
  const t = useTranslations('Step2Card');
  const locale = useLocale();
  const [showInspiration, setShowInspiration] = useState(false);
  const [inspirationEntries, setInspirationEntries] = useState<InspirationEntry[]>([]);
  const [isSavingInspiration, setIsSavingInspiration] = useState(false);
  const [inspirationSaved, setInspirationSaved] = useState(false);

  // 根据当前语言显示文本：英文界面只显英文，中文界面显示 "英文 | 中文" 双语格式
  const getDisplayText = (text: string): string => {
    if (!text) return '';
    const parts = text.split('|').map(p => p.trim());
    if (parts.length > 1) {
      return locale === 'en' ? parts[0] : text;
    }
    return text;
  };

  // Generate inspiration entries from parsedData
  useEffect(() => {
    const entries: InspirationEntry[] = [];

    if (parsedData.dislikes && parsedData.dislikes.length > 0) {
      const isZh = locale === 'zh';
      const dislikesText = parsedData.dislikes
        .map(d => {
          const parts = d.split('|').map(p => p.trim());
          return parts.length > 1 ? (isZh ? parts[1] : parts[0]) : d;
        })
        .join(isZh ? '、' : ', ');
      entries.push({
        trigger: 'dislikes',
        label: t('dislikesLabel', { text: dislikesText }),
        hint: t('dislikesHint'),
        content: '',
      });
    }

    if (parsedData.messageToSender) {
      const msg = getDisplayText(parsedData.messageToSender);
      const msgPreview = msg.length > 60 ? msg.slice(0, 60) + '...' : msg;
      entries.push({
        trigger: 'messageToSender',
        label: t('messageLabel', { text: msgPreview }),
        hint: t('messageHint'),
        content: '',
      });
    }

    if (parsedData.specialRequests && parsedData.specialRequests !== 'none') {
      const sr = getDisplayText(parsedData.specialRequests);
      const srPreview = sr.length > 60 ? sr.slice(0, 60) + '...' : sr;
      entries.push({
        trigger: 'specialRequests',
        label: t('specialLabel', { text: srPreview }),
        hint: t('specialHint'),
        content: '',
      });
    }

    // Pre-fill from saved inspirationNotes
    if (inspirationNotes) {
      try {
        const savedEntries = JSON.parse(inspirationNotes);
        if (Array.isArray(savedEntries)) {
          savedEntries.forEach((saved: { date?: string; content?: string }) => {
            if (saved.content) {
              // Match by order (entries are deterministic based on parsedData)
              const idx = savedEntries.indexOf(saved);
              if (idx < entries.length) {
                entries[idx].content = saved.content;
              }
            }
          });
        }
      } catch {
        // ignore invalid JSON
      }
    }

    setInspirationEntries(entries);
  }, [parsedData, inspirationNotes, t]);

  const handleInspirationChange = (index: number, value: string) => {
    setInspirationEntries(prev => {
      const next = [...prev];
      next[index] = { ...next[index], content: value };
      return next;
    });
    setInspirationSaved(false);
  };

  const handleSaveInspiration = async () => {
    if (!onSaveInspiration) return;
    setIsSavingInspiration(true);
    try {
      const today = new Date().toISOString().slice(0, 10);
      const payload = inspirationEntries
        .filter(e => e.content.trim())
        .map(e => ({ date: today, content: e.content.trim() }));
      await onSaveInspiration(JSON.stringify(payload));
      setInspirationSaved(true);
    } finally {
      setIsSavingInspiration(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <Card className="border-0 shadow-lg hover:shadow-xl transition-all duration-300">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-14 h-14 rounded-2xl bg-emerald-100 flex items-center justify-center">
              <Check className="h-6 w-6 text-emerald-600" />
            </div>
            <div>
              <CardTitle className="text-xl">{t('title')}</CardTitle>
              <CardDescription>{t('description')}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            <div className="flex items-center gap-2 text-emerald-600">
              <Check className="h-5 w-5" />
              <span className="font-medium">{t('parseSuccess')}</span>
            </div>

            <div className="space-y-5">
              {/* 基本信息 */}
              <div>
                <div className="flex items-center gap-2 mb-3 pb-2 border-b border-slate-200">
                  <User className="h-4 w-4 text-emerald-600" />
                  <span className="text-sm font-semibold text-emerald-600">{t('basicInfo')}</span>
                </div>
                
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label className="text-slate-500 text-xs">{t('recipient')}</Label>
                    <p className="font-medium text-slate-900">{parsedData.name}</p>
                  </div>
                  <div>
                    <Label className="text-slate-500 text-xs">{t('country')}</Label>
                    <p className="font-medium text-slate-900">{parsedData.country}</p>
                  </div>
                  <div>
                    <Label className="text-slate-500 text-xs">{t('city')}</Label>
                    <p className="font-medium text-slate-900">{parsedData.city || '-'}</p>
                  </div>
                </div>
              </div>

              {/* ID 和距离 */}
              <div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-slate-500 text-xs mb-1 block">{t('postcardId')}</Label>
                    <Badge variant="secondary" className="font-mono text-sm bg-slate-100">
                      {parsedData.postcardId}
                    </Badge>
                  </div>
                  {parsedData.distance && (
                    <div>
                      <Label className="text-slate-500 text-xs mb-1 block">{t('distance')}</Label>
                      <p className="text-sm text-slate-700">{parsedData.distance.toLocaleString()} km</p>
                    </div>
                  )}
                </div>
              </div>

              {/* 语言偏好 */}
              {parsedData.languagePreference && (
                <div>
                  <div className="flex items-center gap-2 mb-3 pb-2 border-b border-slate-200">
                    <Globe className="h-4 w-4 text-emerald-600" />
                    <span className="text-sm font-semibold text-emerald-600">{t('languagePreference')}</span>
                  </div>
                  <p className="text-sm text-slate-700">{parsedData.languagePreference}</p>
                </div>
              )}

              {/* 兴趣爱好 */}
              {parsedData.interests && parsedData.interests.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3 pb-2 border-b border-slate-200">
                    <Heart className="h-4 w-4 text-emerald-600" />
                    <span className="text-sm font-semibold text-emerald-600">{t('interests')}</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {parsedData.interests.map((interest, index) => (
                      <Badge
                        key={index}
                        className="bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border-emerald-200"
                      >
                        {getDisplayText(interest)}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* 收片厌恶 */}
              {parsedData.dislikes && parsedData.dislikes.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3 pb-2 border-b border-slate-200">
                    <Ban className="h-4 w-4 text-emerald-600" />
                    <span className="text-sm font-semibold text-emerald-600">{t('dislikes')}</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {parsedData.dislikes.map((dislike, index) => (
                      <Badge
                        key={index}
                        className="bg-red-50 text-red-700 line-through hover:bg-red-100 border-red-200"
                      >
                        {getDisplayText(dislike)}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* 内容喜好 */}
              {parsedData.contentPreference && (
                <div>
                  <div className="flex items-center gap-2 mb-3 pb-2 border-b border-slate-200">
                    <Heart className="h-4 w-4 text-emerald-600" />
                    <span className="text-sm font-semibold text-emerald-600">{t('contentPreference')}</span>
                  </div>
                  <p className="text-sm text-slate-700">{getDisplayText(parsedData.contentPreference)}</p>
                </div>
              )}

              {/* 特殊请求 */}
              {parsedData.specialRequests && parsedData.specialRequests !== 'none' && (
                <div>
                  <div className="flex items-center gap-2 mb-3 pb-2 border-b border-slate-200">
                    <FileText className="h-4 w-4 text-emerald-600" />
                    <span className="text-sm font-semibold text-emerald-600">{t('specialRequests')}</span>
                  </div>
                  <p className="text-sm font-medium text-slate-700 bg-emerald-50 p-3 rounded-lg">
                    {getDisplayText(parsedData.specialRequests)}
                  </p>
                </div>
              )}

              {/* 想你写的内容 */}
              {parsedData.messageToSender && (
                <div>
                  <div className="flex items-center gap-2 mb-3 pb-2 border-b border-slate-200">
                    <FileText className="h-4 w-4 text-emerald-600" />
                    <span className="text-sm font-semibold text-emerald-600">{t('messageToSender')}</span>
                  </div>
                  <p className="text-sm font-medium text-slate-700 bg-emerald-50 p-3 rounded-lg">
                    {getDisplayText(parsedData.messageToSender)}
                  </p>
                </div>
              )}
            </div>

            {/* 灵感速记 */}
            {inspirationEntries.length > 0 && (
              <div className="pt-4 border-t border-slate-200">
                <button
                  type="button"
                  className="flex items-center gap-2 w-full text-left group"
                  onClick={() => setShowInspiration(!showInspiration)}
                >
                  <Lightbulb className="h-4 w-4 text-amber-500" />
                  <span className="text-sm font-semibold text-amber-700">
                    {t('inspirationTitle')}
                  </span>
                  <ChevronDown
                    className={`h-4 w-4 text-amber-500 ml-auto transition-transform duration-200 ${
                      showInspiration ? 'rotate-180' : ''
                    }`}
                  />
                </button>

                {showInspiration && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2 }}
                    className="mt-3 space-y-3"
                  >
                    {inspirationEntries.map((entry, index) => (
                      <div
                        key={entry.trigger}
                        className="rounded-lg border border-amber-200 bg-amber-50/50 p-3"
                      >
                        <Label className="text-xs font-medium text-amber-800 mb-1.5 block">
                          {entry.label}
                        </Label>
                        <Textarea
                          value={entry.content}
                          onChange={e => handleInspirationChange(index, e.target.value)}
                          placeholder={entry.hint}
                          className="min-h-[60px] text-sm bg-white border-amber-200 focus-visible:ring-amber-400"
                          rows={2}
                        />
                      </div>
                    ))}

                    <div className="flex items-center gap-3">
                      <Button
                        onClick={handleSaveInspiration}
                        disabled={isSavingInspiration}
                        variant="outline"
                        className="h-9 border-amber-300 text-amber-700 hover:bg-amber-100"
                      >
                        {isSavingInspiration ? t('saving') : t('saveInspiration')}
                      </Button>
                      {inspirationSaved && (
                        <span className="text-xs text-emerald-600">
                          {t('inspirationSaved')}
                        </span>
                      )}
                    </div>
                  </motion.div>
                )}
              </div>
            )}

            {/* 素材检查提示 */}
            {hasMaterials === false ? (
              <div className="pt-4 border-t border-slate-200">
                <Card className="border-0 bg-gradient-to-r from-amber-50 to-orange-50 shadow-md">
                  <CardContent className="pt-6">
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center flex-shrink-0">
                        <Lightbulb className="h-6 w-6 text-white" />
                      </div>
                      <div className="flex-1">
                        <h4 className="font-semibold text-amber-800 mb-2">
                          {t('noMaterialsTitle')}
                        </h4>
                        <p className="text-sm text-amber-700 mb-3">
                          {t('noMaterialsDesc')}
                        </p>
                        <div className="flex gap-2">
                          <Button
                            onClick={onGoToMaterials}
                            className="flex-1 h-11 text-base bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white shadow-md"
                          >
                            {t('goToMaterials')}
                            <ArrowRight className="h-4 w-4 ml-2" />
                          </Button>
                        </div>
                        <p className="text-xs text-amber-600 mt-3">
                          {t('fillMaterialsHint')}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            ) : (
              /* 有素材时才显示生成按钮 */
              <div className="pt-4 border-t border-slate-200 space-y-3">
                <div className="flex gap-3">
                  <Button
                    onClick={onBack}
                    variant="outline"
                    className="flex-1 h-12 border-slate-200 hover:bg-slate-50"
                  >
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    {t('backToEdit')}
                  </Button>
                  <Button
                    onClick={onGenerate}
                    disabled={isGenerating}
                    className="flex-1 h-12 text-base bg-emerald-600 hover:bg-emerald-700 shadow-lg"
                  >
                    {isGenerating ? (
                      <>
                        <ArrowRight className="h-4 w-4 mr-2 animate-spin" />
                        {t('generating')}
                      </>
                    ) : (
                      <>
                        <ArrowRight className="h-4 w-4 mr-2" />
                        {t('generateContent')}
                        <ArrowRight className="h-4 w-4 ml-2" />
                      </>
                    )}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
