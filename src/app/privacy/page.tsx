'use client';

import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { Card, CardContent } from '@/components/ui/card';
import { Shield } from 'lucide-react';
import { motion } from 'framer-motion';

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-orange-50/30">
      <Header />

      <main className="container mx-auto px-4 py-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center mb-12"
        >
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-emerald-100 mb-6 shadow-lg">
            <Shield className="h-10 w-10 text-emerald-600" />
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight mb-4 text-slate-900">
            隐私政策
          </h1>
          <p className="text-sm text-slate-500">
            最后更新：2026年4月30日
          </p>
        </motion.div>

        <div className="max-w-2xl mx-auto space-y-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
          >
            <Card className="border-emerald-200 bg-emerald-50/50">
              <CardContent className="py-6">
                <p className="text-slate-700 leading-relaxed">
                  PostWizard Lite 是一个<strong>开源自部署</strong>的学习项目，由个人开发者维护。
                  项目本身不收集、不存储、不回传任何用户数据。
                  代码完全开源，可自行审查。
                </p>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.2 }}
          >
            <Card>
              <CardContent className="py-6 space-y-4 text-slate-700 leading-relaxed">
                <h2 className="text-lg font-semibold text-slate-900">数据存储</h2>
                <p>
                  所有数据（邮件内容、明信片图片、用户配置等）均存储在你自己部署的服务器上，
                  使用 SQLite 或 PostgreSQL 数据库，不经过 PostWizard 项目的任何服务器。
                </p>

                <h2 className="text-lg font-semibold text-slate-900">第三方数据传输</h2>
                <p>
                  唯一涉及的外部调用是你在设置页自行配置的 AI API（支持通义千问、Gemini、OpenAI 等）。
                  AI 调用仅传输必要的文本片段，用于生成回信内容或翻译，不会传输图片或其他无关数据。
                </p>

                <h2 className="text-lg font-semibold text-slate-900">敏感信息</h2>
                <p>
                  API Key 等敏感信息使用 AES-256-GCM 加密后存储在数据库中。
                  邮箱密码等凭据同样加密存储，不会以明文形式保存。
                </p>

                <h2 className="text-lg font-semibold text-slate-900">数据删除</h2>
                <p>
                  你可以在应用内删除单条记录，也可以直接操作数据库清除所有数据。
                  删除后不可恢复，请提前备份。
                </p>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.3 }}
            className="text-center pt-4"
          >
            <p className="text-sm text-slate-500">
              有疑问？欢迎到 <a href="https://github.com/arthurfsy2/PostWizard-lite/issues" target="_blank" rel="noopener noreferrer" className="text-emerald-600 hover:text-emerald-700">GitHub 提交 Issue</a>
            </p>
          </motion.div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
