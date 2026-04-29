'use client';

import * as React from 'react';
import { useState, useEffect, useCallback } from 'react';
import { 
  Save, 
  Loader2, 
  ChevronDown, 
  Trophy, 
  Sprout,
  Tag,
  Globe,
  Check
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { 
  useProfile, 
  useTranslateProfile, 
  useSaveProfile 
} from '@/hooks/useProfile';
import type { 
  UserType, 
  ProfileData, 
  TemplateHint
} from '@/types/profile';
import { NEWBIE_TEMPLATES, containsChinese } from '@/types/profile';
import { motion, AnimatePresence } from 'framer-motion';

// 动画配置
const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5, ease: [0.25, 0.1, 0.25, 1] }
};

const staggerContainer = {
  animate: {
    transition: {
      staggerChildren: 0.1
    }
  }
};

export function ProfileEditor() {
  // 状态管理
  const [userType, setUserType] = useState<UserType>('expert');
  const [aboutMe, setAboutMe] = useState('');
  const [aboutMeEn, setAboutMeEn] = useState('');
  const [casualNotes, setCasualNotes] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [showTranslate, setShowTranslate] = useState(false);
  const [showTranslationResult, setShowTranslationResult] = useState(false);
  const [isTemplateExpanded, setIsTemplateExpanded] = useState(false);
  const [showTags, setShowTags] = useState(false);

  // API Hooks
  const { data: profileData, isLoading: isLoadingProfile, refetch } = useProfile();
  const translateMutation = useTranslateProfile();
  const saveMutation = useSaveProfile();

  // 防抖标志：防止连续快速点击
  const [canSave, setCanSave] = useState(true);

  // 初始化数据
  useEffect(() => {
    if (profileData) {
      setUserType(profileData.userType || 'expert');
      setAboutMe(profileData.aboutMe || '');
      setAboutMeEn(profileData.aboutMeEn || '');
      setCasualNotes(profileData.casualNotes || '');
      setTags(profileData.tags || []);
      if (profileData.aboutMeEn) {
        setShowTranslationResult(true);
      }
      if (profileData.tags && profileData.tags.length > 0) {
        setShowTags(true);
      }
    }
  }, [profileData]);

  // 检测语言并显示翻译按钮 - 仅新手模式显示
  useEffect(() => {
    // 老手模式直接隐藏翻译按钮（老手直接写英文）
    if (userType === 'expert') {
      setShowTranslate(false);
      return;
    }
    
    const hasChinese = containsChinese(aboutMe);
    setShowTranslate(hasChinese && aboutMe.trim().length > 0);
    if (!hasChinese || aboutMe.trim().length === 0) {
      setShowTranslationResult(false);
    }
  }, [aboutMe, userType]);

  // 切换用户类型
  const handleUserTypeChange = useCallback((type: UserType) => {
    setUserType(type);
    // 隐藏翻译相关 UI（内容保留，用户可以切换回查看）
    setShowTranslationResult(false);
    setShowTranslate(false);
  }, []);

  // 翻译功能 - 翻译个人简介
  const handleTranslate = useCallback(async () => {
    if (!aboutMe.trim()) {
      alert('请先填写个人简介');
      return;
    }
    
    try {
      // 传入 aboutMe 和 casualNotes 让 AI 翻译 aboutMe 并提取标签
      const result = await translateMutation.mutateAsync({ 
        aboutMe, 
        casualNotes 
      });
      setAboutMeEn(result.translation);
      setTags(result.tags);
      setShowTranslationResult(true);
      setShowTags(true);
    } catch (error) {
      console.error('翻译失败:', error);
      alert('翻译失败，请稍后重试');
    }
  }, [aboutMe, casualNotes, translateMutation]);

  // 保存功能 - 带防抖
  const handleSave = useCallback(async () => {
    if (!aboutMe.trim()) {
      alert('请填写个人简介');
      return;
    }

    // 防抖检查：如果正在保存或防抖冷却中，阻止重复提交
    if (saveMutation.isPending || !canSave) {
      console.log('[ProfileEditor] 正在保存中，忽略重复点击');
      return;
    }

    // 设置防抖冷却期（3秒）
    setCanSave(false);

    try {
      const result = await saveMutation.mutateAsync({
        aboutMe,
        aboutMeEn,
        casualNotes,
        tags,
      });

      // 保存成功后立即更新本地状态
      if (result) {
        setTags(result.tags);
        if (result.aboutMeEn) {
          setAboutMeEn(result.aboutMeEn);
        }
        setShowTags(true);
      }

      // 不调用 invalidateQueries，直接静默更新，避免额外的 GET 请求
      // queryClient.setQueryData 已经在 useSaveProfile 中处理

      alert('✅ 保存成功！AI已生成个性化标签');
    } catch (error) {
      console.error('保存失败:', error);
      alert('保存失败，请稍后重试');
    } finally {
      // 3秒后恢复可保存状态
      setTimeout(() => {
        setCanSave(true);
      }, 3000);
    }
  }, [aboutMe, aboutMeEn, casualNotes, tags, saveMutation, canSave]);

  // 使用模板提示
  const handleUseTemplate = useCallback((hint: string) => {
    setAboutMe(prev => {
      const newValue = prev ? `${prev}\n${hint}` : hint;
      return newValue;
    });
  }, []);

  // 加载中状态
  if (isLoadingProfile) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center space-y-4">
          <Loader2 className="w-10 h-10 animate-spin text-orange-500 mx-auto" />
          <p className="text-stone-500">加载中...</p>
        </div>
      </div>
    );
  }

  return (
    <motion.div 
      className="space-y-6"
      variants={staggerContainer}
      initial="initial"
      animate="animate"
    >
      {/* 用户类型切换 */}
      <motion.div 
        className="flex gap-2 justify-center"
        variants={fadeInUp}
      >
        <button
          onClick={() => handleUserTypeChange('expert')}
          className={cn(
            "flex items-center gap-2 px-5 py-2.5 rounded-full border transition-all duration-200",
            userType === 'expert'
              ? "bg-gradient-to-r from-orange-500 to-amber-500 text-white border-transparent shadow-lg shadow-orange-500/20"
              : "bg-white text-stone-600 border-stone-200 hover:border-orange-300 hover:bg-orange-50/50"
          )}
        >
          <Trophy className="w-4 h-4" />
          <span className="font-medium">我是老手</span>
        </button>
        <button
          onClick={() => handleUserTypeChange('newbie')}
          className={cn(
            "flex items-center gap-2 px-5 py-2.5 rounded-full border transition-all duration-200",
            userType === 'newbie'
              ? "bg-gradient-to-r from-orange-500 to-amber-500 text-white border-transparent shadow-lg shadow-orange-500/20"
              : "bg-white text-stone-600 border-stone-200 hover:border-orange-300 hover:bg-orange-50/50"
          )}
        >
          <Sprout className="w-4 h-4" />
          <span className="font-medium">我是新手</span>
        </button>
      </motion.div>

      {/* ① 个人简介卡片 */}
      <motion.div 
        className="bg-white rounded-2xl p-6 md:p-8 shadow-sm border border-stone-100"
        variants={fadeInUp}
      >
        {/* 标签栏 */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center justify-center w-7 h-7 bg-gradient-to-br from-orange-500 to-amber-500 text-white rounded-full text-sm font-semibold">
              ①
            </span>
            <span className="font-semibold text-stone-800">个人简介</span>
          </div>
          <span className="text-xs font-medium px-2.5 py-1 bg-red-50 text-red-600 rounded-full">
            必填
          </span>
        </div>

        {/* 老手提示 */}
        <AnimatePresence mode="wait">
          {userType === 'expert' && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-lg"
            >
              <p className="text-sm text-emerald-700 flex items-center gap-2">
                <Tag className="w-4 h-4" />
                直接粘贴你在 Postcrossing 的英文简介即可，系统会分析内容生成标签
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* 新手引导 */}
        <AnimatePresence mode="wait">
          {userType === 'newbie' && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-lg"
            >
              <div className="flex items-center gap-2 text-amber-700 font-medium mb-2">
                <Globe className="w-4 h-4" />
                不知道如何写英文简介？
              </div>
              <ol className="text-sm text-stone-600 space-y-1 list-decimal list-inside">
                <li>先用中文写下你的兴趣爱好</li>
                <li>系统会帮你翻译成地道的英文</li>
                <li>你可以粘贴到 Postcrossing 使用</li>
              </ol>
            </motion.div>
          )}
        </AnimatePresence>

        {/* 输入框 */}
        <textarea
          value={aboutMe}
          onChange={(e) => setAboutMe(e.target.value)}
          placeholder={
            userType === 'expert'
              ? '直接粘贴你的英文简介...'
              : '先用中文写下你的兴趣爱好，比如：我喜欢骑行，目标是完成100次百公里骑行...'
          }
          className={cn(
            "w-full min-h-[160px] p-4 rounded-xl border-2 font-sans text-[15px] leading-relaxed",
            "bg-yellow-50/50 border-stone-200 resize-y transition-all duration-300",
            "focus:outline-none focus:border-orange-400 focus:bg-white focus:shadow-[0_0_0_4px_rgba(249,115,22,0.1)]",
            "placeholder:text-stone-400"
          )}
        />

        {/* 翻译按钮 */}
        <AnimatePresence>
          {showTranslate && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-3"
            >
              <button
                onClick={handleTranslate}
                disabled={translateMutation.isPending}
                className={cn(
                  "inline-flex items-center gap-2 px-5 py-2.5 rounded-lg font-medium",
                  "bg-gradient-to-r from-orange-500 to-amber-500 text-white",
                  "transition-all duration-300 hover:shadow-lg hover:shadow-orange-500/30 hover:-translate-y-0.5",
                  "disabled:opacity-70 disabled:cursor-not-allowed disabled:hover:translate-y-0"
                )}
              >
                {translateMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    翻译中...
                  </>
                ) : (
                  <>
                    <Globe className="w-4 h-4" />
                    翻译为英文
                  </>
                )}
              </button>

              {/* 翻译结果 */}
              <AnimatePresence>
                {showTranslationResult && aboutMeEn && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="mt-3 p-4 bg-emerald-50 border border-emerald-200 rounded-lg"
                  >
                    <div className="flex items-center gap-2 text-emerald-600 font-semibold text-xs uppercase tracking-wide mb-2">
                      <Check className="w-4 h-4" />
                      翻译结果
                    </div>
                    <p className="text-stone-700 text-sm leading-relaxed">
                      {aboutMeEn}
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>

        {/* 折叠面板 - 仅新手显示 */}
        <AnimatePresence>
          {userType === 'newbie' && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-4 border border-stone-200 rounded-xl overflow-hidden bg-white"
            >
              <button
                onClick={() => setIsTemplateExpanded(!isTemplateExpanded)}
                className={cn(
                  "w-full flex items-center justify-between px-4 py-3.5 text-left",
                  "bg-yellow-50/50 text-stone-600 hover:bg-amber-50 hover:text-orange-600",
                  "transition-colors duration-200"
                )}
              >
                <span className="flex items-center gap-2 text-sm font-medium">
                  <Tag className="w-4 h-4" />
                  不知道如何写？参考这些提示
                </span>
                <ChevronDown 
                  className={cn(
                    "w-4 h-4 transition-transform duration-300",
                    isTemplateExpanded && "rotate-180"
                  )} 
                />
              </button>
              
              <motion.div
                initial={false}
                animate={{ 
                  height: isTemplateExpanded ? 'auto' : 0,
                  opacity: isTemplateExpanded ? 1 : 0
                }}
                transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
                className="overflow-hidden"
              >
                <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {NEWBIE_TEMPLATES.map((template, index) => (
                    <motion.button
                      key={template.type}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ 
                        opacity: isTemplateExpanded ? 1 : 0, 
                        y: isTemplateExpanded ? 0 : 10 
                      }}
                      transition={{ delay: index * 0.05 }}
                      onClick={() => handleUseTemplate(template.hint)}
                      className={cn(
                        "p-3.5 rounded-lg border text-left transition-all duration-200",
                        "bg-yellow-50/50 border-stone-200 hover:border-orange-300 hover:bg-amber-50",
                        "hover:translate-x-1"
                      )}
                    >
                      <div className="flex items-center gap-2 text-orange-600 font-semibold text-sm mb-1">
                        <span>{template.icon}</span>
                        <span>{template.type}</span>
                      </div>
                      <p className="text-stone-500 text-sm italic">
                        {template.hint}
                      </p>
                    </motion.button>
                  ))}
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* ② 随心记卡片 */}
      <motion.div 
        className="bg-white rounded-2xl p-6 md:p-8 shadow-sm border border-stone-100"
        variants={fadeInUp}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center justify-center w-7 h-7 bg-gradient-to-br from-orange-500 to-amber-500 text-white rounded-full text-sm font-semibold">
              ②
            </span>
            <span className="font-semibold text-stone-800">随心记</span>
          </div>
          <span className="text-xs font-medium px-2.5 py-1 bg-indigo-50 text-indigo-600 rounded-full">
            选填
          </span>
        </div>
        
        <p className="text-sm text-stone-500 mb-4">
          补充一些最近发生的事情，帮助生成更贴心的内容
        </p>
        
        <textarea
          value={casualNotes}
          onChange={(e) => setCasualNotes(e.target.value)}
          placeholder="我最近..."
          className={cn(
            "w-full min-h-[120px] p-4 rounded-xl border-2 font-sans text-[15px] leading-relaxed",
            "bg-yellow-50/50 border-stone-200 resize-y transition-all duration-300",
            "focus:outline-none focus:border-orange-400 focus:bg-white focus:shadow-[0_0_0_4px_rgba(249,115,22,0.1)]",
            "placeholder:text-stone-400"
          )}
        />
      </motion.div>

      {/* 标签预览 - 与留言精选风格一致 */}
      <motion.div 
        className="bg-white rounded-2xl p-6 md:p-8 shadow-sm border border-stone-100"
        variants={fadeInUp}
      >
        <div className="flex items-center gap-3 mb-5">
          <span className="text-lg">🏷️</span>
          <span className="font-semibold text-stone-800">识别标签</span>
          <span className="text-sm text-stone-400">
            （保存后基于个人简介+随心记生成）
          </span>
        </div>
        
        <div className="flex flex-wrap gap-2 min-h-[40px]">
          <AnimatePresence mode="wait">
            {showTags && tags.length > 0 ? (
              tags.map((tag, index) => (
                <motion.span
                  key={tag}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  transition={{ delay: index * 0.05 }}
                  className={cn(
                    "inline-flex items-center px-2.5 py-1 rounded-full",
                    "text-xs font-medium transition-all duration-200",
                    // 与留言精选 HighlightsCard 风格一致
                    "bg-gray-100 text-gray-600",
                    "hover:bg-orange-50 hover:text-orange-600"
                  )}
                >
                  #{tag}
                </motion.span>
              ))
            ) : (
              <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="text-stone-400 text-sm italic"
              >
                保存后将自动分析生成标签...
              </motion.span>
            )}
          </AnimatePresence>
        </div>
      </motion.div>

      {/* 保存按钮 */}
      <motion.div 
        className="text-center pt-4"
        variants={fadeInUp}
      >
        <button
          onClick={handleSave}
          disabled={saveMutation.isPending || !aboutMe.trim() || !canSave}
          className={cn(
            "inline-flex items-center gap-2.5 px-12 py-4 rounded-xl font-semibold text-lg",
            "bg-gradient-to-r from-orange-500 to-amber-500 text-white",
            "shadow-lg shadow-orange-500/25 transition-all duration-300",
            "hover:shadow-xl hover:shadow-orange-500/30 hover:-translate-y-1",
            "disabled:opacity-70 disabled:cursor-not-allowed disabled:hover:translate-y-0"
          )}
        >
          {saveMutation.isPending ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              AI分析中...
            </>
          ) : !canSave ? (
            <>
              <Check className="w-5 h-5" />
              已保存
            </>
          ) : (
            <>
              <Save className="w-5 h-5" />
              保存个人要素
            </>
          )}
        </button>
        <p className="mt-3 text-sm text-stone-400">
          系统将综合分析你的个人简介和随心记，生成个性化标签
        </p>
      </motion.div>
    </motion.div>
  );
}
