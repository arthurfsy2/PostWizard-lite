/**
 * 检查用户素材并更新解析结果
 * 
 * 所有 Step 1 API 使用相同的逻辑判断是否已填写个人素材
 * 
 * @param userId - 用户 ID
 * @param parsedResult - AI 解析结果
 * @returns 更新后的解析结果（包含 hasMaterials 字段）
 */
export async function checkMaterialsAndUpdateResult(
  userId: string,
  parsedResult: any
) {
  try {
    const { prisma } = await import('@/lib/prisma');
    
    // 获取用户所有素材
    const materials = await prisma.userMaterial.findMany({
      where: { userId },
      select: { category: true, content: true },
    });

    // 转换为 { self_intro: "...", hobbies: "..." } 格式
    const materialsMap: Record<string, string> = {};
    materials.forEach((m) => {
      materialsMap[m.category] = m.content || '';
    });

    // 判断是否已填写
    const hasMaterials = Object.values(materialsMap).some(
      (content) => content && content.trim().length > 0
    );

    // 获取已填写的分类
    const filledCategories = Object.entries(materialsMap)
      .filter(([_, content]) => content && content.trim().length > 0)
      .map(([category]) => category);

    // 更新解析结果
    return {
      ...parsedResult,
      hasMaterials,
      filledMaterialsCategories: filledCategories,
    };
  } catch (error) {
    console.error('[checkMaterialsAndUpdateResult] 检查素材失败:', error);
    // 检查失败不影响主流程，返回默认值
    return {
      ...parsedResult,
      hasMaterials: false,
      filledMaterialsCategories: [],
    };
  }
}

/**
 * 简化的检查函数（用于前端）
 * 
 * @param materials - 用户素材对象 { [category]: content }
 * @returns 是否已填写
 */
export function checkHasMaterials(
  materials: Record<string, string | null | undefined>
): boolean {
  if (!materials || typeof materials !== 'object') {
    return false;
  }

  return Object.values(materials).some(
    (content) => content && content.trim().length > 0
  );
}
