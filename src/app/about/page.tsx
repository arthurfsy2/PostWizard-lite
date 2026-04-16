'use client';

import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Heart, 
  Code, 
  Brain, 
  Server, 
  Sparkles, 
  Target, 
  Users,
  GraduationCap,
  Lightbulb,
  Rocket
} from 'lucide-react';
import { motion } from 'framer-motion';
import { Badge } from '@/components/ui/badge';

const techStack = [
  {
    category: 'AI',
    icon: Brain,
    color: 'from-purple-500 to-indigo-500',
    items: ['Google Gemini 3.1 Flash-Lite', '阿里云百炼（备用）'],
  },
  {
    category: '前端',
    icon: Code,
    color: 'from-blue-500 to-cyan-500',
    items: ['Next.js 15', 'React 19', 'TypeScript', 'Tailwind CSS', 'shadcn/ui'],
  },
  {
    category: '后端',
    icon: Server,
    color: 'from-emerald-500 to-teal-500',
    items: ['Node.js', 'Prisma ORM', 'PostgreSQL/SQLite'],
  },
  {
    category: '部署',
    icon: Rocket,
    color: 'from-orange-500 to-amber-500',
    items: ['Vercel', 'Serverless Functions'],
  },
];

const learnings = [
  {
    icon: Lightbulb,
    title: '产品从0到1',
    description: '从需求分析到上线运营，完整经历产品设计流程',
  },
  {
    icon: Brain,
    title: 'AI应用实践',
    description: '学习如何将AI能力集成到实际产品中',
  },
  {
    icon: Target,
    title: '合规意识',
    description: '理解ToS、隐私保护、数据安全的重要性',
  },
  {
    icon: Users,
    title: '用户价值',
    description: '找到真正的用户痛点，而非假设的需求',
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
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-orange-400 to-amber-500 mb-6 shadow-lg">
            <GraduationCap className="h-10 w-10 text-white" />
          </div>

          <Badge variant="secondary" className="mb-4 bg-orange-100 text-orange-700 hover:bg-orange-100">
            学习项目
          </Badge>

          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight mb-4">
            <span className="block text-slate-900">关于 PostWizard AI</span>
          </h1>

          <p className="text-lg text-slate-600 max-w-2xl mx-auto">
            这是一个AI产品经理的学习实践项目，旨在帮助非英语母语用户更好地进行国际明信片交换
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
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-orange-400 to-amber-500 flex items-center justify-center">
                  <Heart className="h-5 w-5 text-white" />
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
                      <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${tech.color} flex items-center justify-center mb-3`}>
                        <Icon className="h-5 w-5 text-white" />
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

        {/* 成本说明 */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.5 }}
          className="max-w-3xl mx-auto mb-16"
        >
          <Card className="border-emerald-200 bg-emerald-50/50">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center">
                  <Sparkles className="h-5 w-5 text-white" />
                </div>
                <CardTitle className="text-xl">成本与运营</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-slate-700 leading-relaxed">
                这是一个<strong>非盈利</strong>的学习项目。所有捐赠仅用于覆盖实际运营成本：
              </p>
              <ul className="space-y-2 text-slate-700">
                <li className="flex items-start gap-2">
                  <span className="text-emerald-500">•</span>
                  <span><strong>AI API调用：</strong>每次分析约¥0.005，使用Google Gemini 3.1 Flash-Lite模型</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-emerald-500">•</span>
                  <span><strong>服务器成本：</strong>Vercel托管费用，保证24/7稳定运行</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-emerald-500">•</span>
                  <span><strong>域名和其他：</strong>年度域名费用等基础开销</span>
                </li>
              </ul>
              <p className="text-slate-700 leading-relaxed">
                如果收到的捐赠超过实际成本，多余部分将用于升级服务、开发新功能或支持其他学习项目。
              </p>
            </CardContent>
          </Card>
        </motion.div>

        {/* 学习收获 */}
        <div className="max-w-5xl mx-auto mb-16">
          <h2 className="text-2xl font-bold text-center mb-8">学习收获</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {learnings.map((item, idx) => {
              const Icon = item.icon;
              return (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: 0.1 * idx }}
                >
                  <Card className="h-full border-slate-200/60 hover:shadow-lg transition-all duration-300">
                    <CardHeader>
                      <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center mb-3">
                        <Icon className="h-5 w-5 text-white" />
                      </div>
                      <CardTitle className="text-lg">{item.title}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-slate-600">{item.description}</p>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* 联系方式 */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.9 }}
          className="max-w-2xl mx-auto text-center"
        >
          <Card className="border-0 bg-gradient-to-br from-slate-50 to-slate-100">
            <CardContent className="py-8">
              <h3 className="text-xl font-bold text-slate-800 mb-4">
                想聊聊？
              </h3>
              <p className="text-slate-600 mb-4">
                如果你也对AI产品感兴趣，或有任何建议，欢迎联系我。
              </p>
              <a
                href="mailto:teams@postwizard.cn"
                className="inline-flex items-center gap-2 text-orange-600 hover:text-orange-700 font-medium"
              >
                teams@postwizard.cn
              </a>
            </CardContent>
          </Card>
        </motion.div>
      </main>

      <Footer />
    </div>
  );
}
