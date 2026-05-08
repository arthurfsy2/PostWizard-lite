'use client';

import { useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Heart,
  Code,
  Brain,
  Server,
  Globe,
  GraduationCap,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { Badge } from '@/components/ui/badge';

export default function AboutPage() {
  const t = useTranslations('About');

  const techStack = useMemo(() => [
    {
      category: t('techCategoryAi'),
      icon: Brain,
      iconColor: 'text-purple-600',
      bgColor: 'bg-purple-100',
      items: [t('techAiItem1'), t('techAiItem2')],
    },
    {
      category: t('techCategoryFrontend'),
      icon: Code,
      iconColor: 'text-blue-600',
      bgColor: 'bg-blue-100',
      items: [t('techFrontendItem1'), t('techFrontendItem2'), t('techFrontendItem3'), t('techFrontendItem4'), t('techFrontendItem5')],
    },
    {
      category: t('techCategoryBackend'),
      icon: Server,
      iconColor: 'text-emerald-600',
      bgColor: 'bg-emerald-100',
      items: [t('techBackendItem1'), t('techBackendItem2'), t('techBackendItem3')],
    },
    {
      category: t('techCategoryReceive'),
      icon: Globe,
      iconColor: 'text-orange-600',
      bgColor: 'bg-orange-100',
      items: [t('techReceiveItem1'), t('techReceiveItem2'), t('techReceiveItem3')],
    },
  ], [t]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-orange-50/30">
      <Header />

      <main className="container mx-auto px-4 py-10">
        {/* Hero Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center mb-12"
        >
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-orange-100 mb-6 shadow-lg">
            <GraduationCap className="h-10 w-10 text-orange-600" />
          </div>

          <Badge variant="secondary" className="mb-4 bg-orange-100 text-orange-700 hover:bg-orange-100">
            {t('badge')}
          </Badge>

          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight mb-4">
            <span className="block text-slate-900">{t('title')}</span>
          </h1>

          <p className="text-lg text-slate-600 max-w-2xl mx-auto">
            {t('subtitle')}
          </p>
        </motion.div>

        {/* 项目初衷 */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="max-w-3xl mx-auto mb-16"
        >
          <Card className="border-orange-200 bg-orange-50/50">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-orange-100 flex items-center justify-center">
                  <Heart className="h-5 w-5 text-orange-600" />
                </div>
                <CardTitle className="text-xl">{t('motivationTitle')}</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-slate-700 leading-relaxed">
                {t('motivationContent1')}
              </p>
              <p className="text-slate-700 leading-relaxed">
                {t('motivationContent2')}
              </p>
            </CardContent>
          </Card>
        </motion.div>

        {/* 技术栈 */}
        <div className="max-w-5xl mx-auto mb-16">
          <h2 className="text-2xl font-bold text-center mb-8">{t('techStack')}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {techStack.map((tech, idx) => {
              const Icon = tech.icon;
              return (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: 0.1 * idx }}
                >
                  <Card className="h-full border-slate-200/60 hover:shadow-lg transition-all duration-300">
                    <CardHeader>
                      <div className={`w-10 h-10 rounded-lg ${tech.bgColor} flex items-center justify-center mb-3`}>
                        <Icon className={`h-5 w-5 ${tech.iconColor}`} />
                      </div>
                      <CardTitle className="text-lg">{tech.category}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ul className="space-y-1">
                        {tech.items.map((item, i) => (
                          <li key={i} className="text-sm text-slate-600">
                            {item}
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* 开源说明 */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.5 }}
          className="max-w-3xl mx-auto mb-16"
        >
          <Card className="border-emerald-200 bg-emerald-50/50">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center">
                  <Globe className="h-5 w-5 text-emerald-600" />
                </div>
                <CardTitle className="text-xl">{t('ossTitle')}</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-slate-700 leading-relaxed">
                {t.rich('ossDesc', { strong: (chunks) => <strong>{chunks}</strong> })}
              </p>
              <ul className="space-y-2 text-slate-700">
                <li className="flex items-start gap-2">
                  <span className="text-emerald-500">•</span>
                  <span>{t.rich('ossItem1', { strong: (chunks) => <strong>{chunks}</strong> })}</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-emerald-500">•</span>
                  <span>{t.rich('ossItem2', { strong: (chunks) => <strong>{chunks}</strong> })}</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-emerald-500">•</span>
                  <span>{t.rich('ossItem3', { strong: (chunks) => <strong>{chunks}</strong> })}</span>
                </li>
              </ul>
            </CardContent>
          </Card>
        </motion.div>

        {/* 联系方式 */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.9 }}
          className="max-w-2xl mx-auto text-center"
        >
          <Card className="border border-slate-200 bg-slate-50">
            <CardContent className="py-8">
              <h3 className="text-xl font-bold text-slate-800 mb-4">
                {t('contactTitle')}
              </h3>
              <p className="text-slate-600 mb-4">
                {t('contactDesc')}
              </p>
              <a
                href="https://github.com/arthurfsy2/PostWizard-lite/issues"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-orange-600 hover:text-orange-700 font-medium"
              >
                {t('githubIssues')}
              </a>
            </CardContent>
          </Card>
        </motion.div>
      </main>

      <Footer />
    </div>
  );
}
