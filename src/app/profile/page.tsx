'use client';

import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { ProfileEditor } from '@/components/profile/ProfileEditor';
import { motion } from 'framer-motion';

export default function ProfilePage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-orange-50/30 relative">
      {/* 页面背景装饰 */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        {/* 渐变光晕 */}
        <div
          className="absolute -top-40 -right-40 w-[500px] h-[500px] rounded-full opacity-60"
          style={{
            background: 'radial-gradient(ellipse at center, rgba(249, 115, 22, 0.08) 0%, transparent 60%)'
          }}
        />
        <div
          className="absolute top-1/3 -left-40 w-[400px] h-[400px] rounded-full opacity-40"
          style={{
            background: 'radial-gradient(ellipse at center, rgba(245, 158, 11, 0.06) 0%, transparent 60%)'
          }}
        />
        {/* 底纹 */}
        <div
          className="absolute inset-0 opacity-[0.015]"
          style={{
            backgroundImage: `repeating-linear-gradient(
              45deg,
              transparent,
              transparent 40px,
              rgba(249, 115, 22, 0.3) 40px,
              rgba(249, 115, 22, 0.3) 80px
            )`
          }}
        />
      </div>

      <Header />

      <main className="relative z-10">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 md:py-12">
          {/* 页面标题 */}
          <motion.div
            className="text-center mb-8 md:mb-10"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.25, 0.1, 0.25, 1] }}
          >
            <h1 className="text-2xl md:text-3xl font-bold text-stone-800 flex items-center justify-center gap-3 mb-2">
              <span className="text-3xl">📋</span>
              <span>个人要素</span>
            </h1>
            <p className="text-stone-500 text-sm md:text-base">
              填写你的个人简介和随心记，让 AI 更好地为你生成明信片内容
            </p>
          </motion.div>

          {/* 个人资料编辑器 */}
          <ProfileEditor />
        </div>
      </main>

      <Footer />
    </div>
  );
}
