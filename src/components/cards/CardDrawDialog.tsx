'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Sparkles, Star, Heart, BookOpen, Share2, ChevronLeft, ChevronRight } from 'lucide-react';
// 安全的 HTML 净化函数（避免 isomorphic-dompurify 的 Node.js 兼容问题）
const sanitizeHtml = (html: string): string => {
  if (typeof window === 'undefined') {
    // 服务端：简单转义
    return html
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;');
  }
  // 客户端：使用 DOM API 净化
  const div = document.createElement('div');
  div.textContent = html;
  return div.innerHTML;
};

interface CardDrawDialogProps {
  open: boolean;
  onClose: () => void;
  cardData: CardData;
}

export interface CardData {
  id: string;
  imageUrl: string;
  userImageUrl?: string;
  title: string;
  description: string;
  rarity: 'SSR' | 'SR' | 'R' | 'N';
  luckyLevel?: 'none' | 'lucky' | 'special' | 'superLucky';
  luckyBonus?: number;
  translatedText?: string;
  postcardId?: string;
  senderUsername?: string;
  senderCountry?: string;
  senderCity?: string;
  aiEvaluation: {
    summary: string;
    dimensions: {
      label: string;
      score: number;
      icon?: string;
    }[];
    reasons: string[];
    overallScore: number;
  };
}

const Particle: React.FC<{ delay?: number; duration?: number }> = ({ delay = 0, duration = 3 }) => {
  const colors = ['#fbbf24', '#f59e0b', '#f97316', '#ffffff'];
  const randomColor = colors[Math.floor(Math.random() * colors.length)];
  const randomLeft = Math.random() * 100;
  const randomTop = Math.random() * 100;
  return (
    <div
      className="absolute w-2 h-2 rounded-full"
      style={{
        left: `${randomLeft}%`,
        top: `${randomTop}%`,
        background: randomColor,
        animation: `float ${duration}s ease-in-out infinite`,
        animationDelay: `${delay}s`,
      }}
    />
  );
};

const StarParticle: React.FC<{ delay?: number }> = ({ delay = 0 }) => {
  const randomLeft = Math.random() * 100;
  const randomTop = Math.random() * 100;
  const randomOpacity = Math.random() * 0.5 + 0.3;
  return (
    <div
      className="absolute w-1 h-1 bg-white rounded-full"
      style={{
        left: `${randomLeft}%`,
        top: `${randomTop}%`,
        opacity: randomOpacity,
        animation: 'starTwinkle 1.5s ease-in-out infinite',
        animationDelay: `${delay}s`,
      }}
    />
  );
};

const RarityBadge: React.FC<{ rarity: string }> = ({ rarity }) => {
  const getRarityStyle = () => {
    switch (rarity) {
      case 'SSR':
        return 'bg-gradient-to-br from-amber-400 to-orange-500 shadow-[0_4px_15px_rgba(245,158,11,0.4)]';
      case 'SR':
        return 'bg-gradient-to-br from-purple-400 to-pink-500 shadow-[0_4px_15px_rgba(168,85,247,0.4)]';
      case 'R':
        return 'bg-gradient-to-br from-blue-400 to-cyan-500 shadow-[0_4px_15px_rgba(59,130,246,0.4)]';
      case 'N':
        return 'bg-gradient-to-br from-gray-400 to-gray-500 shadow-[0_4px_15px_rgba(107,114,128,0.4)]';
      default:
        return 'bg-gradient-to-br from-amber-400 to-orange-500';
    }
  };
  return (
    <span className={`inline-block px-4 py-2 rounded-full text-sm font-bold text-white uppercase ${getRarityStyle()}`}>
      {rarity}
    </span>
  );
};

// Lucky Badge 组件（三级体系）
const LuckyBadge: React.FC<{ level?: 'none' | 'lucky' | 'special' | 'superLucky'; bonus?: number }> = ({ 
  level = 'none', bonus = 0 
}) => {
  if (level === 'none') return null;
  
  const config = {
    lucky: {
      emoji: '🍀',
      label: 'Lucky',
      style: 'bg-gradient-to-br from-emerald-400 to-green-500 shadow-[0_4px_15px_rgba(16,185,129,0.4)]',
    },
    special: {
      emoji: '💎',
      label: 'Special',
      style: 'bg-gradient-to-br from-cyan-400 to-blue-500 shadow-[0_4px_15px_rgba(6,182,212,0.4)]',
    },
    superLucky: {
      emoji: '🌟',
      label: 'Super Lucky!',
      style: 'bg-gradient-to-br from-amber-300 via-yellow-400 to-amber-500 shadow-[0_4px_20px_rgba(251,191,36,0.6)] animate-pulse',
    },
  };
  
  const { emoji, label, style } = config[level];
  
  return (
    <motion.span 
      initial={{ scale: 0, rotate: -180 }}
      animate={{ scale: 1, rotate: 0 }}
      transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.3 }}
      className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold text-white ${style}`}
    >
      <span>{emoji}</span>
      <span>{label}</span>
      <span className="ml-1 text-[10px] opacity-90">+{bonus}分</span>
    </motion.span>
  );
};

const CircularScore: React.FC<{ score: number }> = ({ score }) => {
  const circumference = 2 * Math.PI * 36;
  const strokeDashoffset = circumference - (score / 10) * circumference;
  return (
    <div className="relative w-20 h-20">
      <svg className="w-full h-full transform -rotate-90">
        <circle cx="40" cy="40" r="36" fill="none" stroke="#E2E8F0" strokeWidth="6" />
        <circle
          cx="40"
          cy="40"
          r="36"
          fill="none"
          stroke="url(#gradient)"
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          className="transition-all duration-1000 ease-out"
        />
        <defs>
          <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#F97316" />
            <stop offset="100%" stopColor="#F59E0B" />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-xl font-bold text-slate-900">{score.toFixed(1)}</span>
        <span className="text-[10px] text-slate-500">综合</span>
      </div>
    </div>
  );
};

const DimensionItem: React.FC<{ label: string; score: number; icon?: string; index: number }> = ({
  label, score, icon, index
}) => (
  <motion.div
    initial={{ opacity: 0, x: 20 }}
    animate={{ opacity: 1, x: 0 }}
    transition={{ delay: 0.1 * index, duration: 0.3 }}
    className="flex items-center gap-2"
  >
    <span className="text-base">{icon}</span>
    <div className="flex-1">
      <div className="flex justify-between items-center mb-0.5">
        <span className="text-xs font-medium text-slate-700">{label}</span>
        <span className="text-xs font-bold text-orange-500">{score}</span>
      </div>
      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${(score / 10) * 100}%` }}
          transition={{ delay: 0.2 + 0.1 * index, duration: 0.5, ease: 'easeOut' }}
          className="h-full bg-gradient-to-r from-orange-500 to-amber-500 rounded-full"
        />
      </div>
    </div>
  </motion.div>
);

const ReasonsPanel: React.FC<{ reasons: string[]; rarity: string }> = ({ reasons, rarity }) => {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="border-t border-slate-100 pt-2">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 text-xs text-slate-500 hover:text-orange-500 transition-colors w-full"
      >
        <Sparkles className="w-3 h-3" />
        <span>为什么是{rarity}？</span>
        <motion.span
          animate={{ rotate: expanded ? 180 : 0 }}
          transition={{ duration: 0.2 }}
          className="ml-auto"
        >
          <ChevronRight className="w-3 h-3 rotate-90" />
        </motion.span>
      </button>
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden"
          >
            <div className="pt-2 space-y-1.5">
              {reasons.map((reason, idx) => (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.05 * idx }}
                  className="flex items-start gap-1.5 text-[10px] text-slate-600"
                >
                  <span className="text-emerald-500 font-bold mt-0.5">✓</span>
                  <span dangerouslySetInnerHTML={{ __html: sanitizeHtml(reason) }} />
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default function CardDrawDialog({ open, onClose, cardData }: CardDrawDialogProps) {
  const [particles, setParticles] = useState<{ id: number; delay: number; duration: number }[]>([]);
  const [stars, setStars] = useState<{ id: number; delay: number }[]>([]);
  const [showCard, setShowCard] = useState(false);
  const [currentPage, setCurrentPage] = useState(0);
  const [direction, setDirection] = useState(0);

  useEffect(() => {
    if (open) {
      setParticles(Array.from({ length: 30 }, (_, i) => ({
        id: i,
        delay: Math.random() * 2,
        duration: Math.random() * 2 + 2,
      })));
      setStars(Array.from({ length: 15 }, (_, i) => ({
        id: i,
        delay: Math.random() * 1.5,
      })));
      const timer = setTimeout(() => setShowCard(true), 200);
      return () => clearTimeout(timer);
    } else {
      setShowCard(false);
      setCurrentPage(0);
    }
  }, [open]);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (open) {
      window.addEventListener('keydown', handleEsc);
      return () => window.removeEventListener('keydown', handleEsc);
    }
  }, [open, onClose]);

  const handleOverlayClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onClose();
  }, [onClose]);

  const goToPage = useCallback((page: number) => {
    setDirection(page > currentPage ? 1 : -1);
    setCurrentPage(page);
  }, [currentPage]);

  const nextPage = useCallback(() => {
    if (currentPage < 1) {
      setDirection(1);
      setCurrentPage(1);
    }
  }, [currentPage]);

  const prevPage = useCallback(() => {
    if (currentPage > 0) {
      setDirection(-1);
      setCurrentPage(0);
    }
  }, [currentPage]);

  const handleShare = useCallback(() => {
    if (navigator.share) {
      navigator.share({
        title: `我在 Postcrossing Wizard 抽到了${cardData.rarity}卡片！`,
        text: `我抽到了【${cardData.title}】${cardData.rarity}稀有度明信片卡！`,
        url: window.location.href,
      });
    } else {
      navigator.clipboard.writeText(`我抽到了【${cardData.title}】${cardData.rarity}稀有度明信片卡！`);
      alert('已复制到剪贴板');
    }
  }, [cardData]);

  const handleAddToAlbum = useCallback(() => {
    onClose();
  }, [onClose]);

  const slideVariants = {
    enter: (direction: number) => ({ x: direction > 0 ? 300 : -300, opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (direction: number) => ({ x: direction < 0 ? 300 : -300, opacity: 0 }),
  };

  const CardPage = () => (
    <div className="flex flex-col h-full">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="text-center mb-2"
      >
        <h2 className="text-xl font-bold text-gray-900 mb-0.5">🎉 恭喜获得！</h2>
        <p className="text-xs text-gray-500">超稀有的明信片卡</p>
      </motion.div>

      <div className="flex-1 min-h-0 flex items-center justify-center mb-2">
        <motion.div
          className="relative w-full max-w-[200px]"
          initial={{ opacity: 0, scale: 0.5, rotate: -10 }}
          animate={showCard ? { opacity: 1, scale: 1, rotate: 0, transition: { duration: 0.8, ease: [0.34, 1.56, 0.64, 1] } } : {}}
          style={{ animation: showCard ? 'breathe 3s ease-in-out 1s infinite' : undefined }}
        >
          <div className="rounded-2xl overflow-hidden shadow-[0_15px_50px_rgba(0,0,0,0.3)] relative">
            <img src={cardData.userImageUrl || cardData.imageUrl} alt={cardData.title} className="w-full aspect-[3/4] object-cover" />
            <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/80 to-transparent text-white text-left">
              <div className="flex flex-wrap items-center gap-2">
                <RarityBadge rarity={cardData.rarity} />
                <LuckyBadge level={cardData.luckyLevel} bonus={cardData.luckyBonus} />
              </div>
              <h3 className="text-base font-bold mt-1">{cardData.title}</h3>
            </div>
          </div>
        </motion.div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="flex items-center justify-center gap-3 mb-2"
      >
        <CircularScore score={cardData.aiEvaluation.overallScore} />
        <div className="text-left">
          <p className="text-xs text-slate-500">综合评分</p>
          <p className="text-base font-bold text-slate-900">{cardData.aiEvaluation.overallScore.toFixed(1)}/10</p>
          <p className="text-[10px] text-slate-400">滑动查看详情 →</p>
        </div>
      </motion.div>
    </div>
  );

  const EvaluationPage = () => (
    <div className="flex flex-col h-full">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-2">
        <div className="flex items-center justify-center gap-2 mb-0.5">
          <Sparkles className="w-4 h-4 text-orange-500" />
          <h2 className="text-lg font-bold text-slate-900">AI 智能评价</h2>
        </div>
        <p className="text-[10px] text-slate-500">基于内容的多维度分析</p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-gradient-to-br from-orange-50 to-amber-50 rounded-xl p-2.5 mb-2 border border-orange-100"
      >
        <p className="text-xs text-slate-700 leading-relaxed">{cardData.aiEvaluation.summary}</p>
      </motion.div>

      <div className="flex-1 overflow-y-auto">
        <h3 className="text-xs font-semibold text-slate-900 mb-2">维度评分</h3>
        <div className="space-y-2">
          {cardData.aiEvaluation.dimensions.map((dim, idx) => (
            <DimensionItem key={idx} label={dim.label} score={dim.score} icon={dim.icon} index={idx} />
          ))}
        </div>
        <div className="mt-4">
          <ReasonsPanel reasons={cardData.aiEvaluation.reasons} rarity={cardData.rarity} />
        </div>
      </div>

      <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }} className="text-center text-xs text-slate-400 mt-3">
        ← 滑动返回卡片
      </motion.p>
    </div>
  );

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4"
          onClick={handleOverlayClick}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            className="bg-white rounded-[24px] w-full max-w-[380px] h-[500px] max-h-[85vh] relative overflow-hidden flex flex-col"
            initial={{ opacity: 0, scale: 0.7, y: 50 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: 'spring', damping: 20, stiffness: 300, duration: 0.5 }}
          >
            <button
              onClick={onClose}
              className="absolute top-3 right-3 w-8 h-8 bg-black/10 hover:bg-black/20 rounded-full flex items-center justify-center text-gray-800 transition-all hover:rotate-90 z-20"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="absolute inset-0 pointer-events-none">
              <div
                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] rounded-full"
                style={{
                  background: 'radial-gradient(circle, rgba(251,191,36,0.4) 0%, rgba(245,158,11,0.2) 40%, transparent 70%)',
                  animation: 'glowRotate 8s linear infinite, pulse 2s ease-in-out infinite',
                }}
              />
              <div className="absolute inset-0">
                {stars.map((star) => <StarParticle key={star.id} delay={star.delay} />)}
              </div>
              <div className="absolute inset-0 overflow-hidden">
                {particles.map((particle) => <Particle key={particle.id} delay={particle.delay} duration={particle.duration} />)}
              </div>
            </div>

            <button
              onClick={prevPage}
              className={`absolute left-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/90 hover:bg-white shadow-lg flex items-center justify-center text-slate-600 hover:text-orange-500 transition-all z-20 hidden md:flex ${currentPage === 0 ? 'opacity-30 cursor-not-allowed' : ''}`}
              disabled={currentPage === 0}
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
            <button
              onClick={nextPage}
              className={`absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/90 hover:bg-white shadow-lg flex items-center justify-center text-slate-600 hover:text-orange-500 transition-all z-20 hidden md:flex ${currentPage === 1 ? 'opacity-30 cursor-not-allowed' : ''}`}
              disabled={currentPage === 1}
            >
              <ChevronRight className="w-6 h-6" />
            </button>

            <div className="relative flex-1 overflow-hidden p-6">
              <AnimatePresence initial={false} custom={direction} mode="wait">
                <motion.div
                  key={currentPage}
                  custom={direction}
                  variants={slideVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{ x: { type: 'spring', stiffness: 300, damping: 30 }, opacity: { duration: 0.2 } }}
                  className="h-full"
                  drag="x"
                  dragConstraints={{ left: 0, right: 0 }}
                  dragElastic={0.2}
                  onDragEnd={(e, { offset, velocity }) => {
                    const swipe = offset.x + velocity.x * 0.2;
                    if (swipe < -50 && currentPage < 1) nextPage();
                    else if (swipe > 50 && currentPage > 0) prevPage();
                  }}
                >
                  {currentPage === 0 ? <CardPage /> : <EvaluationPage />}
                </motion.div>
              </AnimatePresence>
            </div>

            <div className="relative z-10 px-6 pb-4">
              <div className="flex items-center justify-center gap-2 mb-3">
                {[0, 1].map((page) => (
                  <button
                    key={page}
                    onClick={() => goToPage(page)}
                    className={`transition-all duration-300 ${currentPage === page ? 'w-6 h-2 bg-gradient-to-r from-orange-500 to-amber-500 rounded-full' : 'w-2 h-2 bg-slate-300 rounded-full hover:bg-slate-400'}`}
                  />
                ))}
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handleAddToAlbum}
                  className="flex-1 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl font-medium transition-all hover:-translate-y-0.5 flex items-center justify-center gap-2 text-sm"
                >
                  <BookOpen className="w-4 h-4" />
                  放入卡册
                </button>
                <button
                  onClick={handleShare}
                  className="flex-1 px-4 py-2.5 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white rounded-xl font-bold transition-all hover:-translate-y-0.5 flex items-center justify-center gap-2 text-sm shadow-lg shadow-orange-500/25"
                >
                  <Share2 className="w-4 h-4" />
                  炫耀分享
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
