'use client';

import { useState } from 'react';
import Image from 'next/image';
import { 
  Globe, 
  MapPin
} from 'lucide-react';

import { GachaCardFrame } from '@/components/gacha/GachaCardFrame';
import { Rarity } from '@/lib/constants/rarity';
import { getFlagEmoji } from '@/lib/flag-emoji';

interface ReceivedCard {
  id: string;
  postcardId?: string | null;
  senderUsername: string | null;
  senderCountry: string | null;
  senderCity: string | null;
  handwrittenText: string | null;
  translatedText: string | null;
  detectedLang: string | null;
  backImageUrl: string | null;
  processedImageUrl?: string | null;
  frontImageUrl: string | null;
  shareImageUrl: string | null;
  isPublic: boolean;
  receivedAt: string | null;
  createdAt: string;
  // 稀有度字段（来自抽卡系统）
  rarity?: Rarity;
  luckyLevel?: 'none' | 'lucky' | 'special' | 'superLucky' | null;
}

interface ReceivedCardItemProps {
  card: ReceivedCard;
  viewMode: 'grid' | 'list';
  onClick: () => void;
}

// 国家代码转国旗emoji（使用共享工具 getFlagEmoji）

// 语言代码转语言名称
function getLanguageName(langCode: string | null): string {
  if (!langCode) return '未知';
  
  const langNames: Record<string, string> = {
    'en': 'English',
    'ja': '日本語',
    'ko': '한국어',
    'de': 'Deutsch',
    'fr': 'Français',
    'es': 'Español',
    'it': 'Italiano',
    'pt': 'Português',
    'nl': 'Nederlands',
    'pl': 'Polski',
    'ru': 'Русский',
    'zh': '中文',
    'zh-Hans': '简体中文',
    'zh-Hant': '繁體中文',
    'cs': 'Čeština',
    'fi': 'Suomi',
    'sv': 'Svenska',
    'no': 'Norsk',
    'da': 'Dansk',
    'hu': 'Magyar',
    'el': 'Ελληνικά',
  };

  return langNames[langCode.toLowerCase()] || langCode;
}

export function ReceivedCardItem({ 
  card, 
  viewMode, 
  onClick
}: ReceivedCardItemProps) {
  const [imageError, setImageError] = useState(false);

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  // 优先使用处理后的图片，其次原图
  const displayImage = card.processedImageUrl || card.backImageUrl || card.frontImageUrl;

  if (viewMode === 'list') {
    // 列表视图
    return (
      <div 
        onClick={onClick}
        className="bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow cursor-pointer overflow-hidden flex"
      >
        {/* 图片预览 */}
        <div className="w-32 h-24 sm:w-40 sm:h-28 flex-shrink-0 relative bg-gray-100">
          {displayImage && !imageError ? (
            <img
              src={displayImage}
              alt="明信片"
              className="w-full h-full object-cover"
              onError={() => setImageError(true)}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-4xl">
              🏺️
            </div>
          )}
        </div>

        {/* 内容 */}
        <div className="flex-1 p-4 min-w-0">
          {/* 并排显示：明信片ID | 地区 | 发件人 */}
          <div className="flex items-center gap-2 text-sm mb-1 overflow-hidden">
            {/* Postcard ID */}
            {card.postcardId && (
              <span className="text-xs font-mono font-bold text-orange-600 bg-orange-50 px-1.5 py-0.5 rounded flex-shrink-0">
                {card.postcardId}
              </span>
            )}
            {card.postcardId && (card.senderCountry || card.senderUsername) && (
              <span className="text-gray-300">|</span>
            )}
            
            {/* 地区 */}
            {(card.senderCountry || card.senderCity) && (
              <span className="text-gray-500 truncate flex-shrink-0">
                {getFlagEmoji(card.senderCountry || '')} {[card.senderCity, card.senderCountry].filter(Boolean).join(', ')}
              </span>
            )}
            {(card.senderCountry || card.senderCity) && card.senderUsername && (
              <span className="text-gray-300">|</span>
            )}
            
            {/* 发件人 */}
            {card.senderUsername && (
              <span className="font-medium text-gray-900 truncate">
                {card.senderUsername}
              </span>
            )}
          </div>
          
          {/* 语言和日期 */}
          <div className="flex items-center justify-between mt-1">
            <div className="flex items-center gap-3 text-xs text-gray-500">
              {card.detectedLang && (
                <span>{getLanguageName(card.detectedLang)}</span>
              )}
            </div>
            
            <span className="text-xs text-gray-400">
              {formatDate(card.receivedAt || card.createdAt)}
            </span>
          </div>

          {/* 手写内容预览 */}
          {card.handwrittenText && (
            <p className="mt-2 text-sm text-gray-600 line-clamp-2">
              {card.handwrittenText}
            </p>
          )}
        </div>
      </div>
    );
  }

  // 网格视图 - 使用 GachaCardFrame 包裹
  return (
    <GachaCardFrame
      rarity={card.rarity || null}
      viewMode="grid"
    >
      <div onClick={onClick} className="cursor-pointer">
      {/* 图片区域 */}
      <div className="relative aspect-[4/3] bg-gray-100">
        {displayImage && !imageError ? (
          <img
            src={displayImage}
            alt="明信片"
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            onError={() => setImageError(true)}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-6xl">
            🏺️
          </div>
        )}

        {/* 国家标志 */}
        <div className="absolute top-3 left-3">
          <span className="text-2xl drop-shadow-lg">
            {getFlagEmoji(card.senderCountry || '')}
          </span>
        </div>

        {/* 语言标签 - 移到左下角避免和按钮重叠 */}
        {card.detectedLang && (
          <div className="absolute bottom-3 left-3">
            <span className="px-2 py-1 bg-black/60 text-white text-xs rounded-full">
              {getLanguageName(card.detectedLang)}
            </span>
          </div>
        )}
      </div>

      {/* 内容区域 */}
      <div className="p-4">
        {/* 并排显示：明信片ID | 地区 | 发件人 */}
        <div className="flex items-center gap-2 text-sm mb-2 overflow-hidden">
          {/* Postcard ID */}
          {card.postcardId && (
            <span className="text-xs font-mono font-bold text-orange-600 bg-orange-50 px-1.5 py-0.5 rounded flex-shrink-0">
              {card.postcardId}
            </span>
          )}
          {card.postcardId && (card.senderCountry || card.senderUsername) && (
            <span className="text-gray-300">|</span>
          )}
          
          {/* 地区 */}
          {(card.senderCountry || card.senderCity) && (
            <span className="text-gray-500 truncate flex-shrink-0">
              {getFlagEmoji(card.senderCountry || '')} {[card.senderCity, card.senderCountry].filter(Boolean).join(', ')}
            </span>
          )}
          {(card.senderCountry || card.senderCity) && card.senderUsername && (
            <span className="text-gray-300">|</span>
          )}
          
          {/* 发件人 */}
          {card.senderUsername && (
            <span className="font-medium text-gray-900 truncate">
              {card.senderUsername}
            </span>
          )}
        </div>

        {/* 日期 */}
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-400">
            {formatDate(card.receivedAt || card.createdAt)}
          </span>
        </div>

        {/* 手写内容预览 */}
        {card.handwrittenText && (
          <p className="text-sm text-gray-600 line-clamp-2 mt-2">
            {card.handwrittenText}
          </p>
        )}
      </div>
      </div>
    </GachaCardFrame>
  );
}

export default ReceivedCardItem;
