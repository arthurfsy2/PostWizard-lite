"use client";

import { useEffect, useState, Suspense } from "react";
import Link from "next/link";
import {
  Mail,
  FileText,
  Zap,
  Copy,
  ClipboardPaste,
  Scan,
  ArrowRight,
  Pencil,
  Camera,
  Inbox,
  Send,
  Download,
} from "lucide-react";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";

import {useTranslations} from 'next-intl';

export default function HomePage() {
  const t = useTranslations('Index');

  const features = [
    { title: t('features.pasteEmail'), description: t('features.pasteEmailDesc'), icon: Mail, color: "text-blue-600", bg: "bg-blue-100", category: t('features.categorySending') },
    { title: t('features.writingAssistant'), description: t('features.writingAssistantDesc'), icon: FileText, color: "text-orange-600", bg: "bg-orange-100", category: t('features.categorySending') },
    { title: t('features.emailDirect'), description: t('features.emailDirectDesc'), icon: Zap, color: "text-emerald-600", bg: "bg-emerald-100", category: t('features.categorySending') },
    { title: t('features.receiveRecognition'), description: t('features.receiveRecognitionDesc'), icon: Scan, color: "text-pink-600", bg: "bg-pink-100", category: t('features.categoryReceiving') },
    { title: t('features.shareImage'), description: t('features.shareImageDesc'), icon: Camera, color: "text-violet-600", bg: "bg-violet-100", category: t('features.categoryReceiving') },
    { title: t('features.receiveHistory'), description: t('features.receiveHistoryDesc'), icon: Inbox, color: "text-rose-600", bg: "bg-rose-100", category: t('features.categoryReceiving') },
  ];

  // 记录访问日志 - 使用防抖避免重复记录
  useEffect(() => {
    const hasLogged = sessionStorage.getItem("visited_home");
    if (hasLogged) return;

    const logVisit = async () => {
      try {
        await fetch("/api/visit-log", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            path: window.location.pathname,
          }),
        });
        sessionStorage.setItem("visited_home", "true");
      } catch (error) {
        // console.error('记录访问日志失败:', error);
      }
    };

    // 延迟500ms发送，避免React严格模式的双重调用
    const timer = setTimeout(logVisit, 500);
    return () => clearTimeout(timer);
  }, []);
  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-b from-slate-50 via-white to-orange-50/30">
      <Header />

      <main className="flex-1">
        {/* Hero Section - 现代简约风格 */}
        <section className="relative pt-20 pb-32 overflow-hidden">
          <div className="container mx-auto px-4 relative">
            <div className="mx-auto max-w-[65rem] text-center space-y-8">
              {/* 主标题 - 双功能平衡 */}
              <div className="space-y-4 animate-in fade-in slide-in-from-bottom-8 duration-700">
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-orange-100 text-orange-700 text-sm font-medium">
                  <Mail className="w-4 h-4" />
                  <span>{t('title')}</span>
                </div>

                <h1 className="text-5xl sm:text-6xl md:text-7xl font-bold tracking-tight">
                  <span className="block text-slate-900">{t('subTitle1')}</span>
                  <span className="block text-3xl sm:text-4xl md:text-5xl mt-3 text-slate-400">
                    {t('subTitle2')}
                  </span>
                </h1>

                <p className="mx-auto max-w-[45rem] text-lg sm:text-xl text-slate-600 leading-relaxed">
                  {t('heroDesc')}
                </p>
              </div>

              {/* 双 CTA 按钮 - 寄信/收信双功能 */}
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4 animate-in fade-in slide-in-from-bottom-12 duration-700 delay-150">
                <Link href="/sent/parse">
                  <Button
                    size="lg"
                    className="bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white shadow-lg shadow-orange-500/25 h-14 px-8 text-base rounded-xl group"
                  >
                    <Pencil className="mr-2 h-5 w-5 group-hover:rotate-12 transition-transform" />
                    {t('startSending')}
                    <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
                  </Button>
                </Link>
                <Link href="/received/upload">
                  <Button
                    size="lg"
                    className="bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 text-white shadow-lg shadow-pink-500/25 h-14 px-8 text-base rounded-xl group"
                  >
                    <Camera className="mr-2 h-5 w-5 group-hover:scale-110 transition-transform" />
                    {t('recordReceiving')}
                    <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
                  </Button>
                </Link>
              </div>

              {/* 学习项目说明 */}
              <div className="pt-6 animate-in fade-in duration-1000 delay-300">
                <p className="text-sm text-slate-500">
                  {t('learningProject')}
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Features Section - 渐变卡片风格 */}
        <section className="py-20 bg-white">
          <div className="container mx-auto px-4">
            <div className="text-center mb-12 space-y-3">
              <h2 className="text-3xl sm:text-4xl font-bold text-slate-900">
                {t('coreFeatures')}
              </h2>
              <p className="text-lg text-slate-600 max-w-2xl mx-auto">
                {t('coreDesc')}
              </p>
            </div>

            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
              {features.map((feature, index) => {
                const Icon = feature.icon;
                return (
                  <Card
                    key={feature.title}
                    className="group border border-orange-100/60 bg-white hover:bg-white/90 hover:border-orange-200/70 transition-all duration-300 hover:-translate-y-1 overflow-hidden card-elevated"
                  >
                    <CardHeader className="space-y-4 pb-6">
                      <div
                        className={`w-14 h-14 rounded-xl ${feature.bg} flex items-center justify-center`}
                      >
                        <Icon className={`h-6 w-6 ${feature.color}`} />
                      </div>
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-lg font-semibold text-slate-900">
                          {feature.title}
                        </CardTitle>
                        <span
                          className={`text-xs px-2 py-1 rounded-md ${
                            feature.category === t('features.categorySending')
                              ? "bg-orange-50 text-orange-700 border border-orange-100"
                              : "bg-pink-50 text-pink-700 border border-pink-100"
                          }`}
                        >
                          {feature.category}
                        </span>
                      </div>
                      <CardDescription className="text-slate-600 leading-relaxed text-sm">
                        {feature.description}
                      </CardDescription>
                    </CardHeader>
                  </Card>
                );
              })}
            </div>
          </div>
        </section>

        {/* 使用流程 */}
        <section className="py-20 bg-gradient-to-b from-white to-slate-50">
          <div className="container mx-auto px-4">
            <div className="text-center mb-12 space-y-3">
              <h2 className="text-3xl sm:text-4xl font-bold text-slate-900">
                {t('howToUse')}
              </h2>
              <p className="text-lg text-slate-600">{t('howToUseDesc')}</p>
            </div>

            {/* 寄信流程 */}
            <div className="mx-auto max-w-4xl mb-16">
              <div className="flex items-center gap-2 mb-8">
                <div className="w-8 h-8 rounded-lg bg-orange-100 flex items-center justify-center">
                  <Send className="h-4 w-4 text-orange-600" />
                </div>
                <h3 className="text-xl font-bold text-slate-900">{t('sendingProcess')}</h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {[
                  {
                    step: 1,
                    title: t('step1Title'),
                    desc: t('step1Desc'),
                    icon: Copy,
                  },
                  {
                    step: 2,
                    title: t('step2Title'),
                    desc: t('step2Desc'),
                    icon: ClipboardPaste,
                  },
                  {
                    step: 3,
                    title: t('step3Title'),
                    desc: t('step3Desc'),
                    icon: Mail,
                  },
                ].map((item, index) => {
                  const Icon = item.icon;
                  return (
                    <div
                      key={item.step}
                      className="relative flex flex-col items-center text-center group"
                    >
                      <div className="relative mb-4">
                        <div className="w-16 h-16 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center border border-orange-200 group-hover:scale-105 transition-all duration-300">
                          <Icon className="h-6 w-6" />
                        </div>
                        <div className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-white border border-orange-200 text-orange-600 font-bold text-xs flex items-center justify-center">
                          {item.step}
                        </div>
                      </div>

                      <h3 className="text-base font-semibold text-slate-900 mb-1">
                        {item.title}
                      </h3>
                      <p className="text-sm text-slate-500 leading-relaxed max-w-[220px]">
                        {item.desc}
                      </p>

                      {index < 2 && (
                        <div className="hidden md:block absolute top-8 left-1/2 w-full h-px bg-gradient-to-r from-orange-200 via-amber-200 to-orange-200 -z-10" />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 收信流程 */}
            <div className="mx-auto max-w-4xl">
              <div className="flex items-center gap-2 mb-8">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center">
                  <Download className="h-4 w-4 text-emerald-600" />
                </div>
                <h3 className="text-xl font-bold text-slate-900">{t('receivingProcess')}</h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-xl mx-auto">
                {[
                  {
                    step: 1,
                    title: t('recStep1Title'),
                    desc: t('recStep1Desc'),
                    icon: Camera,
                  },
                  {
                    step: 2,
                    title: t('recStep2Title'),
                    desc: t('recStep2Desc'),
                    icon: Inbox,
                  },
                ].map((item, index) => {
                  const Icon = item.icon;
                  return (
                    <div
                      key={item.step}
                      className="relative flex flex-col items-center text-center group"
                    >
                      <div className="relative mb-4">
                        <div className="w-16 h-16 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center border border-emerald-200 group-hover:scale-105 transition-all duration-300">
                          <Icon className="h-6 w-6" />
                        </div>
                        <div className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-white border border-emerald-200 text-emerald-600 font-bold text-xs flex items-center justify-center">
                          {item.step}
                        </div>
                      </div>

                      <h3 className="text-base font-semibold text-slate-900 mb-1">
                        {item.title}
                      </h3>
                      <p className="text-sm text-slate-500 leading-relaxed max-w-[220px]">
                        {item.desc}
                      </p>

                      {index < 1 && (
                        <div className="hidden md:block absolute top-8 left-1/2 w-full h-px bg-gradient-to-r from-emerald-200 via-teal-200 to-emerald-200 -z-10" />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        {/* CTA Section */}
      </main>

      <Footer />
    </div>
  );
}
