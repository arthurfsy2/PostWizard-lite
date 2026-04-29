'use client';

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

const techStack = [
  {
    category: 'AI',
    icon: Brain,
    iconColor: 'text-purple-600',
    bgColor: 'bg-purple-100',
    items: ['通义千问、Gemini、OpenAI 等', '支持自定义 OpenAI 兼容接口'],
  },
  {
    category: '前端',
    icon: Code,
    iconColor: 'text-blue-600',
    bgColor: 'bg-blue-100',
    items: ['Next.js 15', 'React 19', 'TypeScript', 'Tailwind CSS', 'shadcn/ui'],
  },
  {
    category: '后端',
    icon: Server,
    iconColor: 'text-emerald-600',
    bgColor: 'bg-emerald-100',
    items: ['Node.js', 'Prisma ORM', 'SQLite / PostgreSQL'],
  },
  {
    category: '收信识别',
    icon: Globe,
    iconColor: 'text-orange-600',
    bgColor: 'bg-orange-100',
    items: ['OCR 手写识别', '多语言翻译', '明信片图集管理'],
  },
];

export default function AboutPage() {
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
            学习项目
          </Badge>

          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight mb-4">
            <span className="block text-slate-900">关于 PostWizard</span>
          </h1>

          <p className="text-lg text-slate-600 max-w-2xl mx-auto">
            这是一个希望转型为AI产品经理的个人学习实践项目，旨在帮助非英语母语用户更好地进行国际明信片交换
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
                <CardTitle className="text-xl">项目初衷</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-slate-700 leading-relaxed">
                作为一个正在转型AI产品经理的开发者，我想通过一个真实项目来学习AI产品开发的全流程。
                选择明信片写作这个场景，是因为它能结合AI文本生成和实际的社交场景。
              </p>
              <p className="text-slate-700 leading-relaxed">
                项目目标是帮助非英语母语的用户，在面对来自世界各地的明信片收件人时，
                能够更轻松地写出个性化、得体的回信。AI不是替代人，而是帮助人更好地表达自己。
              </p>
            </CardContent>
          </Card>
        </motion.div>

        {/* 技术栈 */}
        <div className="max-w-5xl mx-auto mb-16">
          <h2 className="text-2xl font-bold text-center mb-8">技术栈</h2>
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
                <CardTitle className="text-xl">开源与部署</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-slate-700 leading-relaxed">
                PostWizard Lite 是一个<strong>开源</strong>的学习项目，你可以自由部署到自己的服务器上。
              </p>
              <ul className="space-y-2 text-slate-700">
                <li className="flex items-start gap-2">
                  <span className="text-emerald-500">•</span>
                  <span><strong>自部署：</strong>基于 Next.js，支持任意 Node.js 环境部署</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-emerald-500">•</span>
                  <span><strong>AI 模型：</strong>支持通义千问、Gemini、OpenAI 等多种服务，需自行配置 API Key</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-emerald-500">•</span>
                  <span><strong>数据自主：</strong>所有数据存储在本地数据库（SQLite / PostgreSQL），不经过任何第三方</span>
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
                想聊聊？
              </h3>
              <p className="text-slate-600 mb-4">
                如果你也对 AI 产品感兴趣，或有任何建议，欢迎到 GitHub 提 Issue。
              </p>
              <a
                href="https://github.com/arthurfsy2/PostWizard-lite/issues"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-orange-600 hover:text-orange-700 font-medium"
              >
                GitHub Issues
              </a>
            </CardContent>
          </Card>
        </motion.div>
      </main>

      <Footer />
    </div>
  );
}
