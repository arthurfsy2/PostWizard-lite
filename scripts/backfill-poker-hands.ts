import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// 幸运等级类型
type LuckyLevel = 'none' | 'lucky' | 'special' | 'superLucky';

// 扑克牌型检测（与 gachaService.ts 一致，要求聚集）
function analyzeLuckyLevel(postcardId: string): {
  level: LuckyLevel;
  bonus: number;
  reason: string;
  label: string;
} {
  const numbers = postcardId.replace(/[^0-9]/g, '');

  if (numbers.length < 2) {
    return { level: 'none', bonus: 0, reason: '', label: '' };
  }

  // 提取所有连续相同数字的游程
  const runs: { digit: string; len: number }[] = [];
  let i = 0;
  while (i < numbers.length) {
    let j = i + 1;
    while (j < numbers.length && numbers[j] === numbers[i]) j++;
    runs.push({ digit: numbers[i], len: j - i });
    i = j;
  }

  const maxRun = Math.max(...runs.map(r => r.len));

  // Five of a Kind: 连续 5+
  if (maxRun >= 5) {
    return { level: 'superLucky', bonus: 20, reason: '🃏 五条！Postcard ID 包含 5 个连续相同数字', label: 'Five of a Kind!' };
  }

  // Four of a Kind: 连续 4+
  if (maxRun >= 4) {
    return { level: 'superLucky', bonus: 15, reason: '🃏 四条！Postcard ID 包含 4 个连续相同数字', label: 'Four of a Kind!' };
  }

  // Full House: 一组连续 3+ + 另一组连续 2+（不同数字）
  const hasRun3 = runs.some(r => r.len >= 3);
  if (hasRun3) {
    const tripleDigit = runs.find(r => r.len >= 3)!.digit;
    if (runs.some(r => r.digit !== tripleDigit && r.len >= 2)) {
      return { level: 'superLucky', bonus: 15, reason: '🃏 葫芦！Postcard ID 包含聚集的 3+2 数字组合', label: 'Full House!' };
    }
  }

  // Straight: 4位及以上连续递增/递减
  const straightUp = /1234|2345|3456|4567|5678|6789|12345|23456|34567|45678|56789/;
  const straightDown = /9876|8765|7654|6543|5432|4321|98765|87654|76543|65432|54321/;
  if (straightUp.test(numbers) || straightDown.test(numbers)) {
    return { level: 'special', bonus: 10, reason: '🃏 顺子！Postcard ID 包含 4 位及以上连续数字', label: 'Straight!' };
  }

  // Three of a Kind: 连续 3
  if (maxRun >= 3) {
    return { level: 'special', bonus: 10, reason: '🃏 三条！Postcard ID 包含 3 个连续相同数字', label: 'Three of a Kind!' };
  }

  // Two Pair: 两组各自连续 2+
  const pairRuns = runs.filter(r => r.len >= 2);
  if (pairRuns.length >= 2) {
    return { level: 'lucky', bonus: 5, reason: '🃏 两对！Postcard ID 包含两组聚集重复数字', label: 'Two Pair' };
  }

  // One Pair: 连续 2
  if (maxRun >= 2) {
    return { level: 'lucky', bonus: 5, reason: '🃏 一对！Postcard ID 包含一对连续相同数字', label: 'One Pair' };
  }

  // Palindrome: 回文
  const len = numbers.length;
  if (len >= 4) {
    const half = Math.floor(len / 2);
    const isPalindrome = numbers.slice(0, half) === numbers.slice(len - half).split('').reverse().join('');
    if (isPalindrome) {
      return { level: 'lucky', bonus: 5, reason: '🃏 回文！Postcard ID 数字呈镜像对称', label: 'Palindrome' };
    }
  }

  return { level: 'none', bonus: 0, reason: '', label: '' };
}

async function main() {
  console.log('=== 扑克牌型 Lucky 数据回填 ===\n');

  // 获取所有有 postcardId 的抽卡记录
  const logs = await prisma.userGachaLog.findMany({
    where: { postcardId: { not: null } },
    select: {
      id: true,
      postcardId: true,
      luckyLevel: true,
      luckyBonus: true,
      summary: true,
      aiScore: true,
    },
  });

  console.log(`共找到 ${logs.length} 条记录\n`);

  let updatedCount = 0;
  let unchangedCount = 0;
  const handStats: Record<string, number> = {};

  for (const log of logs) {
    if (!log.postcardId) continue;

    const lucky = analyzeLuckyLevel(log.postcardId);
    const newLevel = lucky.level === 'none' ? null : lucky.level;
    const newBonus = lucky.bonus || null;

    // 更新 summary：移除旧的 lucky 描述，添加新的
    let newSummary = log.summary || '';
    // 移除旧的 lucky 后缀（🌟/💎/🍀/🃏 开头到句末）
    newSummary = newSummary.replace(/\s*(🌟|💎|🍀|🃏)[^。]*$/, '');

    // 如果有新的 lucky 信息，追加到 summary
    if (lucky.reason) {
      newSummary += ' ' + lucky.reason;
    }

    // 检查是否有变化
    const levelChanged = log.luckyLevel !== newLevel;
    const bonusChanged = log.luckyBonus !== newBonus;
    const summaryChanged = log.summary !== newSummary;

    if (!levelChanged && !bonusChanged && !summaryChanged) {
      unchangedCount++;
      continue;
    }

    await prisma.userGachaLog.update({
      where: { id: log.id },
      data: {
        luckyLevel: newLevel,
        luckyBonus: newBonus,
        summary: newSummary,
      },
    });

    updatedCount++;
    const handName = lucky.label || 'None';
    handStats[handName] = (handStats[handName] || 0) + 1;

    console.log(`✅ ${log.postcardId} → ${handName} (+${lucky.bonus})`);
  }

  console.log(`\n=== 回填完成 ===`);
  console.log(`更新: ${updatedCount} 条`);
  console.log(`未变: ${unchangedCount} 条`);
  console.log(`\n牌型分布:`);
  for (const [hand, count] of Object.entries(handStats).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${hand}: ${count}`);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
