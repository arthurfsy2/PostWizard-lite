import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getLocalUserId } from '@/lib/local-user';
import { smartTokenize, countFrequency, sortByFrequency } from '@/lib/services/tokenizer';
import { getCachedWordCloud, cacheWordCloud, invalidateWordCloudCache } from '@/lib/services/cache';
import { dictionary } from '@/lib/services/self-learning-dictionary';
import { toTraditionalSync } from '@/lib/utils/traditionalChinese';

/**
 * GET /api/received-cards/wordcloud
 *
 * 分析所有收信 OCR 文本，生成词云数据。
 * 数据源：ReceivedCard.ocrText
 */
export async function GET(request: NextRequest) {
  try {
    const userId = getLocalUserId();
    const { searchParams } = new URL(request.url);
    const language = searchParams.get('language') || 'en';
    const minCount = parseInt(searchParams.get('minCount') || '2', 10);
    const hasTimestamp = searchParams.has('t');
    const forceParam = searchParams.get('force') === '1';
    const isForceRefresh = hasTimestamp || forceParam;

    const cacheKey = `received-wordcloud:${userId}:${language}:${minCount}`;

    if (!isForceRefresh) {
      const cached = await getCachedWordCloud(cacheKey);
      if (cached) {
        return NextResponse.json(cached);
      }
    } else {
      await invalidateWordCloudCache(userId);
    }

    const cards = await prisma.receivedCard.findMany({
      where: { userId },
      select: { ocrText: true },
    });

    if (cards.length === 0) {
      return NextResponse.json({
        words: [],
        totalWords: 0,
        uniqueWords: 0,
        totalMessages: 0,
        language,
        message: 'No received cards found',
        generatedAt: new Date().toISOString(),
      });
    }

    const allText = cards
      .map(c => c.ocrText || '')
      .filter(text => text.trim())
      .join(' ');

    const words = smartTokenize(allText, { includePhrases: true, minPhraseCount: 2 });
    const frequency = countFrequency(words);
    let wordList = sortByFrequency(frequency, minCount).slice(0, 150);

    if (language === 'zh') {
      const translations = await dictionary.translateWords(wordList.map(w => w.text));
      wordList = wordList.map(word => ({
        ...word,
        text: toTraditionalSync(translations.get(word.text) || word.text),
      }));
    }

    const result = {
      words: wordList,
      totalWords: words.length,
      uniqueWords: wordList.length,
      totalMessages: cards.length,
      language,
      generatedAt: new Date().toISOString(),
    };

    await cacheWordCloud(cacheKey, result, 3600);
    return NextResponse.json(result);
  } catch (error) {
    console.error('[ReceivedCards WordCloud] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: (error as Error).message },
      { status: 500 },
    );
  }
}
