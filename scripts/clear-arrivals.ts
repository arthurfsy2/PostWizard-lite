/**
 * 清空开源版（SQLite）的 arrival 页面记录
 * 
 * 功能：
 * 1. 删除所有 ArrivalReply 和 MessageAnalysis 记录
 * 2. 显示删除统计
 */
import { prisma } from '@/lib/prisma';

async function main() {
  console.log('🗑️ 准备清空开源版的 arrival 记录...\n');

  // 1. 统计待删除记录
  const arrivalCount = await prisma.arrivalReply.count();
  const analysisCount = await prisma.messageAnalysis.count();

  console.log(`📊 待删除记录：`);
  console.log(`   - ArrivalReply: ${arrivalCount} 条`);
  console.log(`   - MessageAnalysis: ${analysisCount} 条`);
  console.log(`   - 总计：${arrivalCount + analysisCount} 条\n`);

  // 2. 确认删除
  console.log('⚠️ 即将执行删除操作...\n');

  // 3. 删除 MessageAnalysis
  const deletedAnalyses = await prisma.messageAnalysis.deleteMany();
  console.log(`✅ 已删除 MessageAnalysis: ${deletedAnalyses.count} 条`);

  // 4. 删除 ArrivalReply
  const deletedArrivals = await prisma.arrivalReply.deleteMany();
  console.log(`✅ 已删除 ArrivalReply: ${deletedArrivals.count} 条`);

  console.log(`\n🎉 清空完成！`);

  await prisma.$disconnect();
}

main().catch(console.error);
