/**
 * Prompt 版本对比测试脚本
 *
 * 用法:
 *   npx tsx scripts/test-prompt.ts                          # 测试所有明信片，使用 v2
 *   npx tsx scripts/test-prompt.ts --version v1             # 使用 v1 prompt
 *   npx tsx scripts/test-prompt.ts --version v2             # 使用 v2 prompt
 *   npx tsx scripts/test-prompt.ts --ids CN-4196547,CN-4222990  # 指定明信片 ID
 *   npx tsx scripts/test-prompt.ts --version v1 --ids CN-4196547
 *
 * 输出: 每张明信片的三维评分表格（touching/emotional/culturalInsight）+ 字数统计
 */

import { PrismaClient } from '@prisma/client';
import { GenerationService, GenerationOptions, MatchedMaterial } from '../src/lib/services/generationService';
import { analyzeMessage } from '../src/lib/services/sentimentAnalysis';
import { createOpenAIClient, getAIModel } from '../src/lib/services/ai-config';

const prisma = new PrismaClient();
const generationService = new GenerationService();

// 解析命令行参数
function parseArgs() {
  const args = process.argv.slice(2);
  let version: 'v1' | 'v2' = 'v2';
  let ids: string[] | null = null;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--version' && args[i + 1]) {
      version = args[i + 1] as 'v1' | 'v2';
      i++;
    }
    if (args[i] === '--ids' && args[i + 1]) {
      ids = args[i + 1].split(',').map(s => s.trim());
      i++;
    }
  }

  return { version, ids };
}

// 统计英文单词数（不含日期行和签名）
function countWords(enContent: string): number {
  const lines = enContent.split('\n').filter(l => l.trim());
  // 跳过第一行（日期行）和最后两行（Best, / Name）
  const bodyLines = lines.slice(1, -2);
  const body = bodyLines.join(' ').trim();
  return body.split(/\s+/).filter(w => w.length > 0).length;
}

// 从 AI 生成内容中提取英文部分
function extractEnContent(raw: string): string {
  try {
    // 尝试解析 JSON
    const parsed = JSON.parse(raw);
    return parsed.en || raw;
  } catch {
    // 尝试从 markdown 代码块中提取
    const jsonMatch = raw.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[1]);
        return parsed.en || raw;
      } catch { /* ignore */ }
    }
    return raw;
  }
}

async function main() {
  const { version, ids } = parseArgs();

  console.log(`\n🔬 Prompt 版本对比测试`);
  console.log(`   版本: ${version}`);
  console.log(`   明信片: ${ids ? ids.join(', ') : '全部'}\n`);

  // 获取明信片数据
  const where = ids ? { id: { in: ids } } : {};
  const postcards = await prisma.postcard.findMany({
    where,
    orderBy: { createdAt: 'desc' },
  });

  if (postcards.length === 0) {
    console.log('❌ 未找到明信片数据');
    await prisma.$disconnect();
    return;
  }

  console.log(`📋 找到 ${postcards.length} 张明信片\n`);

  // 获取用户 profile（使用 local 用户）
  const userProfile = await prisma.userProfile.findUnique({
    where: { userId: 'local' },
  });

  if (!userProfile) {
    console.log('❌ 未找到用户 profile，请先填写个人要素');
    await prisma.$disconnect();
    return;
  }

  // 构建素材
  const allMaterials = generationService.buildMaterials(userProfile);

  // 准备 AI 客户端
  const client = await createOpenAIClient();
  const model = await getAIModel();

  const results: Array<{
    id: string;
    name: string;
    country: string;
    wordCount: number;
    touching: number;
    emotional: number;
    culturalInsight: number;
    score: number;
    primaryCategory: string;
  }> = [];

  for (const postcard of postcards) {
    console.log(`\n━━━ ${postcard.id} (${postcard.recipientName}, ${postcard.recipientCountry}) ━━━`);

    // 匹配素材（优先使用 coreInterests）
    const matchedMaterials = generationService.matchMaterialsForTest(
      allMaterials,
      (postcard as any).coreInterests || postcard.recipientInterests,
    );

    // 构建 prompt
    const options: GenerationOptions = {
      tone: 'friendly',
      wordCount: 100,
    };

    const prompt = generationService.buildPromptForVersion(
      postcard,
      options,
      allMaterials,
      matchedMaterials,
      version,
    );

    console.log(`   Prompt 长度: ${prompt.length} 字符`);

    // 调用 AI 生成内容
    let generatedContent = '';
    try {
      const response = await client.chat.completions.create({
        model,
        messages: [
          {
            role: 'system',
            content: '你是一位专业的 Postcrossing 明信片收、寄信助手。你的任务是生成友好、真诚、个性化的英文明信片内容。内容要自然流畅，避免模板化。',
          },
          { role: 'user', content: prompt },
        ],
        max_tokens: 800,
        temperature: 0.8,
      });
      generatedContent = response.choices[0]?.message?.content || '';
    } catch (err: any) {
      console.log(`   ❌ AI 生成失败: ${err.message}`);
      continue;
    }

    // 提取英文内容
    const enContent = extractEnContent(generatedContent);
    const wordCount = countWords(enContent);

    console.log(`   生成字数: ${wordCount} 词`);
    console.log(`\n   === 完整英文内容 ===`);
    console.log(enContent);
    console.log(`   === 内容结束 ===\n`);

    // 三维评分
    let touching = 0, emotional = 0, culturalInsight = 0, score = 0, primaryCategory = '';
    try {
      const analysis = await analyzeMessage(enContent);
      touching = analysis.categories.touching;
      emotional = analysis.categories.emotional;
      culturalInsight = analysis.categories.culturalInsight;
      score = analysis.score;
      primaryCategory = analysis.primaryCategory;
      console.log(`   评分: touching=${touching}, emotional=${emotional}, cultural=${culturalInsight}, score=${score} (${primaryCategory})`);
    } catch (err: any) {
      console.log(`   ⚠️ 评分失败: ${err.message}`);
    }

    results.push({
      id: postcard.id,
      name: postcard.recipientName || '',
      country: postcard.recipientCountry || '',
      wordCount,
      touching,
      emotional,
      culturalInsight,
      score,
      primaryCategory,
    });
  }

  // 输出对比表格
  console.log('\n\n' + '═'.repeat(80));
  console.log(`📊 测试结果汇总 (Prompt ${version.toUpperCase()})`);
  console.log('═'.repeat(80));

  const header = [
    'ID'.padEnd(15),
    'Name'.padEnd(12),
    'Country'.padEnd(10),
    'Words'.padStart(6),
    'Touch'.padStart(6),
    'Emot'.padStart(6),
    'Cult'.padStart(6),
    'Score'.padStart(6),
    'Primary'.padEnd(12),
  ].join(' │ ');

  console.log(header);
  console.log('─'.repeat(80));

  for (const r of results) {
    const row = [
      r.id.padEnd(15),
      (r.name || '-').substring(0, 10).padEnd(12),
      (r.country || '-').substring(0, 8).padEnd(10),
      String(r.wordCount).padStart(6),
      String(r.touching).padStart(6),
      String(r.emotional).padStart(6),
      String(r.culturalInsight).padStart(6),
      String(r.score).padStart(6),
      r.primaryCategory.padEnd(12),
    ].join(' │ ');
    console.log(row);
  }

  // 平均分
  if (results.length > 1) {
    console.log('─'.repeat(80));
    const avg = {
      wordCount: Math.round(results.reduce((s, r) => s + r.wordCount, 0) / results.length),
      touching: Math.round(results.reduce((s, r) => s + r.touching, 0) / results.length),
      emotional: Math.round(results.reduce((s, r) => s + r.emotional, 0) / results.length),
      culturalInsight: Math.round(results.reduce((s, r) => s + r.culturalInsight, 0) / results.length),
      score: Math.round(results.reduce((s, r) => s + r.score, 0) / results.length),
    };
    const avgRow = [
      'AVERAGE'.padEnd(15),
      ''.padEnd(12),
      ''.padEnd(10),
      String(avg.wordCount).padStart(6),
      String(avg.touching).padStart(6),
      String(avg.emotional).padStart(6),
      String(avg.culturalInsight).padStart(6),
      String(avg.score).padStart(6),
      ''.padEnd(12),
    ].join(' │ ');
    console.log(avgRow);
  }

  console.log('═'.repeat(80));

  await prisma.$disconnect();
}

main().catch(err => {
  console.error('❌ 测试失败:', err);
  prisma.$disconnect();
  process.exit(1);
});
