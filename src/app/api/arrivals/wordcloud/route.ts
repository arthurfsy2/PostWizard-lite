import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getLocalUserId } from '@/lib/local-user';
import { smartTokenize, countFrequency, sortByFrequency } from '@/lib/services/tokenizer';
import { getCachedWordCloud, cacheWordCloud, invalidateWordCloudCache } from '@/lib/services/cache';
import { dictionary } from '@/lib/services/self-learning-dictionary';
import { toTraditionalSync } from '@/lib/utils/traditionalChinese';

/**
 * GET /api/arrivals/wordcloud
 * 
 * 分析用户所有抵达回复（ArrivalReply）的内容，生成词云数据。
 * 
 * Query 参数：
 * - language: 'zh' | 'en' | 'all'（默认 'en'）
 *   - 'en': 显示英文原词
 *   - 'zh': 显示中文翻译（使用自学习词典）
 * - minCount: 最小出现次数（默认 2）
 * - force: 是否强制刷新（绕过缓存，1=true）
 * 
 * 数据源：
 * - ArrivalReply.message - 解析后的回复消息（纯净留言内容）
 * 
 * 前端使用 wordcloud2.js 渲染 Canvas 词云
 */
export async function GET(request: NextRequest) {
  try {
    // 1. 认证
    const userId = getLocalUserId();

    // 2. 解析参数
    const { searchParams } = new URL(request.url);
    const language = searchParams.get('language') || 'en';
    const minCount = parseInt(searchParams.get('minCount') || '2', 10);
    // 检测强制刷新
    const hasTimestamp = searchParams.has('t');
    const forceParam = searchParams.get('force') === '1';
    const isForceRefresh = hasTimestamp || forceParam;

    // 3. 尝试从缓存获取（非强制刷新模式）
    const cacheKey = `wordcloud:${userId}:${language}:${minCount}`;
    
    if (!isForceRefresh) {
      const cached = await getCachedWordCloud(cacheKey);
      if (cached) {
        console.log('📦 [缓存命中] 词云数据，Key:', cacheKey);
        return NextResponse.json(cached);
      }
    } else {
      console.log('🔄 [强制刷新] 清除用户词云缓存，UserId:', userId);
      await invalidateWordCloudCache(userId);
    }

    // 4. 从数据库获取抵达回复内容
    const replies = await prisma.arrivalReply.findMany({
      where: { userId },
      select: { 
        message: true,
      },
    });

    if (replies.length === 0) {
      return NextResponse.json({
        words: [],
        totalWords: 0,
        uniqueWords: 0,
        totalMessages: 0,
        language,
        message: 'No arrival replies found',
        generatedAt: new Date().toISOString(),
      });
    }

    // 5. 合并所有回复文本
    const allText = replies
      .map(r => r.message || '')
      .filter(text => text.trim())
      .join(' ');

    // 6. 智能分词
    const words = smartTokenize(allText, { includePhrases: true, minPhraseCount: 2 });
    const frequency = countFrequency(words);

    // 7. 转换为排序后的数组（最多150个词）
    let wordList = sortByFrequency(frequency, minCount).slice(0, 150);

    // 8. 中文模式翻译
    if (language === 'zh') {
      const translations = await dictionary.translateWords(
        wordList.map(w => w.text)
      );
      
      wordList = wordList.map(word => {
        const translatedText = translations.get(word.text) || word.text;
        const traditionalText = toTraditionalSync(translatedText);
        return {
          ...word,
          text: traditionalText,
        };
      });
    }

    // 9. 返回词云数据（前端 wordcloud2.js 渲染）
    const result = {
      words: wordList,
      totalWords: words.length,
      uniqueWords: wordList.length,
      totalMessages: replies.length,
      language,
      generatedAt: new Date().toISOString(),
    };
    
    // 10. 缓存结果
    await cacheWordCloud(cacheKey, result, 3600);

    return NextResponse.json(result);
  } catch (error) {
    console.error('WordCloud API error:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: (error as Error).message },
      { status: 500 }
    );
  }
}
