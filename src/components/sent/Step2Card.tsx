'use client';

import { motion } from 'framer-motion';
import { 
  Check, User, Heart, Globe, Ban, Sparkles, Lightbulb, ArrowRight, ArrowLeft 
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';

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

interface Step2CardProps {
  parsedData: AIParsedRecipient;
  tone: string;
  onToneChange: (tone: string) => void;
  onGenerate: () => void;
  onBack: () => void;
  isGenerating: boolean;
  hasMaterials: boolean | null;
  onGoToMaterials: () => void;
}

export function Step2Card({
  parsedData,
  tone,
  onToneChange,
  onGenerate,
  onBack,
  isGenerating,
  hasMaterials,
  onGoToMaterials,
}: Step2CardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <Card className="border-0 shadow-lg hover:shadow-xl transition-all duration-300">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center">
              <Sparkles className="h-6 w-6 text-white" />
            </div>
            <div>
              <CardTitle className="text-xl">Step 2 · AI 解析结果</CardTitle>
              <CardDescription>AI 已成功识别收件人详细信息</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            <div className="flex items-center gap-2 text-emerald-600">
              <Check className="h-5 w-5" />
              <span className="font-medium">解析成功</span>
            </div>

            <div className="space-y-5">
              {/* 基本信息 */}
              <div>
                <div className="flex items-center gap-2 mb-3 pb-2 border-b border-slate-200">
                  <User className="h-4 w-4 text-emerald-600" />
                  <span className="text-sm font-semibold text-emerald-600">基本信息</span>
                </div>
                
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label className="text-slate-500 text-xs">收件人</Label>
                    <p className="font-medium text-slate-900">{parsedData.name}</p>
                  </div>
                  <div>
                    <Label className="text-slate-500 text-xs">国家/地区</Label>
                    <p className="font-medium text-slate-900">{parsedData.country}</p>
                  </div>
                  <div>
                    <Label className="text-slate-500 text-xs">城市</Label>
                    <p className="font-medium text-slate-900">{parsedData.city || '-'}</p>
                  </div>
                </div>
              </div>

              {/* ID 和距离 */}
              <div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-slate-500 text-xs mb-1 block">明信片 ID</Label>
                    <Badge variant="secondary" className="font-mono text-sm bg-slate-100">
                      {parsedData.postcardId}
                    </Badge>
                  </div>
                  {parsedData.distance && (
                    <div>
                      <Label className="text-slate-500 text-xs mb-1 block">距离</Label>
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
                    <span className="text-sm font-semibold text-emerald-600">语言偏好</span>
                  </div>
                  <p className="text-sm text-slate-700">{parsedData.languagePreference}</p>
                </div>
              )}

              {/* 兴趣爱好 */}
              {parsedData.interests && parsedData.interests.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3 pb-2 border-b border-slate-200">
                    <Heart className="h-4 w-4 text-emerald-600" />
                    <span className="text-sm font-semibold text-emerald-600">收片偏好</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {parsedData.interests.map((interest, index) => (
                      <Badge
                        key={index}
                        className="bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border-emerald-200"
                      >
                        {interest}
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
                    <span className="text-sm font-semibold text-emerald-600">收片厌恶</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {parsedData.dislikes.map((dislike, index) => (
                      <Badge
                        key={index}
                        className="bg-red-50 text-red-700 line-through hover:bg-red-100 border-red-200"
                      >
                        {dislike}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* 内容喜好 */}
              {parsedData.contentPreference && (
                <div>
                  <div className="flex items-center gap-2 mb-3 pb-2 border-b border-slate-200">
                    <Sparkles className="h-4 w-4 text-emerald-600" />
                    <span className="text-sm font-semibold text-emerald-600">内容喜好</span>
                  </div>
                  <p className="text-sm text-slate-700">{parsedData.contentPreference}</p>
                </div>
              )}

              {/* 想你写的内容 */}
              {parsedData.messageToSender && (
                <div>
                  <div className="flex items-center gap-2 mb-3 pb-2 border-b border-slate-200">
                    <Sparkles className="h-4 w-4 text-emerald-600" />
                    <span className="text-sm font-semibold text-emerald-600">想你写的内容</span>
                  </div>
                  <p className="text-sm font-medium text-slate-700 bg-emerald-50 p-3 rounded-lg">
                    {parsedData.messageToSender}
                  </p>
                </div>
              )}
            </div>

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
                          需要先填写个人要素
                        </h4>
                        <p className="text-sm text-amber-700 mb-3">
                          填写个人简介后，AI 会基于您的真实经历和喜好生成更个性化、更有温度的明信片内容。
                        </p>
                        <div className="flex gap-2">
                          <Button
                            onClick={onGoToMaterials}
                            className="flex-1 h-11 text-base bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white shadow-md"
                          >
                            立即填写个人要素
                            <ArrowRight className="h-4 w-4 ml-2" />
                          </Button>
                        </div>
                        <p className="text-xs text-amber-600 mt-3">
                          💡 填写个人要素后返回此页面，即可一键生成个性化明信片内容
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            ) : (
              /* 有素材时才显示生成按钮 */
              <div className="pt-4 border-t border-slate-200 space-y-3">
                <div>
                  <Label htmlFor="tone" className="text-sm font-medium text-slate-700 mb-2 block">
                    你希望生成什么风格的内容？
                  </Label>
                  <select
                    id="tone"
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm focus:border-emerald-500 focus:ring-emerald-500"
                    value={tone}
                    onChange={(e) => onToneChange(e.target.value)}
                  >
                    <option value="friendly">友好热情</option>
                    <option value="casual">轻松随意</option>
                    <option value="formal">正式礼貌</option>
                    <option value="humorous">幽默风趣</option>
                    <option value="poetic">文艺诗意</option>
                  </select>
                </div>

                <div className="flex gap-3">
                  <Button
                    onClick={onBack}
                    variant="outline"
                    className="flex-1 h-12 border-slate-200 hover:bg-slate-50"
                  >
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    返回修改
                  </Button>
                  <Button
                    onClick={onGenerate}
                    disabled={isGenerating}
                    className="flex-1 h-12 text-base bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 shadow-lg"
                  >
                    {isGenerating ? (
                      <>
                        <Sparkles className="h-4 w-4 mr-2 animate-spin" />
                        生成中...
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4 mr-2" />
                        下一步：生成明信片内容
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
