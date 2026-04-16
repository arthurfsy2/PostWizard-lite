'use client';

import { Upload, Sparkles, Edit } from 'lucide-react';
import { motion } from 'framer-motion';

interface UploadProgressIndicatorProps {
  currentStep: number;
  completedSteps: number[];
}

const steps = [
  {
    step: 1,
    title: '上传明信片照片',
    description: '选择要识别的明信片图片',
    icon: Upload,
    color: 'from-orange-500 to-amber-500',
    bgColor: 'bg-orange-500',
    activeColor: 'text-orange-600',
  },
  {
    step: 2,
    title: 'AI 智能评估',
    description: '智能分析明信片内容质量',
    icon: Sparkles,
    color: 'from-emerald-500 to-teal-500',
    bgColor: 'bg-emerald-500',
    activeColor: 'text-emerald-600',
  },
  {
    step: 3,
    title: '编辑并收藏',
    description: '完善信息保存到卡册',
    icon: Edit,
    color: 'from-purple-500 to-indigo-500',
    bgColor: 'bg-purple-500',
    activeColor: 'text-purple-600',
  },
];

export function UploadProgressIndicator({ currentStep, completedSteps }: UploadProgressIndicatorProps) {
  return (
    <div className="w-full mb-12">
      <div className="relative flex items-center justify-between max-w-3xl mx-auto">
        {/* 连接线 - 调整为适应 w-10 图标的位置 */}
        <div className="absolute top-5 left-0 right-0 h-0.5 bg-slate-200">
          <motion.div
            className="h-full bg-gradient-to-r from-orange-500 to-amber-500"
            initial={{ width: '0%' }}
            animate={{ width: `${((currentStep - 1) / 2) * 100}%` }}
            transition={{ duration: 0.5, ease: 'easeInOut' }}
          />
        </div>

        {/* 步骤节点 */}
        {steps.map((step, index) => {
          const Icon = step.icon;
          const isCompleted = completedSteps.includes(step.step);
          const isCurrent = currentStep === step.step;
          const isUpcoming = currentStep < step.step;

          return (
            <motion.div
              key={step.step}
              className="relative flex flex-col items-center gap-1"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1, duration: 0.4 }}
            >
              {/* 圆形图标 - 缩小为 w-10 h-10 */}
              <motion.div
                className={`
                  relative w-10 h-10 rounded-full flex items-center justify-center
                  border-4 transition-all duration-300
                  ${isCompleted ? 'border-emerald-500 ' + step.bgColor : ''}
                  ${isCurrent ? 'border-white ' + step.bgColor + ' shadow-lg scale-110' : ''}
                  ${isUpcoming ? 'border-slate-200 bg-slate-100' : ''}
                `}
                animate={isCurrent ? { scale: [1, 1.05, 1] } : {}}
                transition={{ duration: 0.3, repeat: isCurrent ? Infinity : 0, repeatDelay: 2 }}
              >
                {isCompleted ? (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', damping: 15 }}
                  >
                    <Icon className="w-5 h-5 text-white" />
                  </motion.div>
                ) : (
                  <Icon className={`w-5 h-5 ${isUpcoming ? 'text-slate-400' : 'text-white'}`} />
                )}
              </motion.div>

              {/* 文字说明 - 缩小字体 */}
              <div className="text-center">
                <div
                  className={`
                    text-xs font-semibold transition-colors duration-300
                    ${isCurrent ? step.activeColor : isCompleted ? 'text-emerald-600' : 'text-slate-400'}
                  `}
                >
                  {step.title}
                </div>
                <div className="text-[10px] text-slate-500 mt-0.5">{step.description}</div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
