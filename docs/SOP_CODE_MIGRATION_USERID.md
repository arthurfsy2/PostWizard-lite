# 代码移植 SOP - userId 本地化检查

**版本**: v1.0  
**创建日期**: 2026-04-16  
**适用范围**: 从私有库/多用户版本移植代码到开源单用户版本

---

## 📋 问题背景

从私有库（多用户 + 认证系统）移植代码到开源库（单用户 + 本地模式）时，**userId 处理是高频问题点**：

### 典型问题
1. **硬编码用户 ID**: `userId: "user_abc123"`
2. **使用认证系统**: `getCurrentUser()`, `useCurrentUser()`
3. **遗漏本地化导入**: 使用 `userId` 但未导入 `local-user.ts`
4. **Prisma 查询错误**: `Record to update not found`（用户记录不存在）

### 影响
- 🔴 **P0 级别错误**: API 无法正常工作
- 🔴 **数据隔离失效**: 可能访问错误的用户数据
- 🔴 **认证依赖**: 开源版无需认证但代码依赖认证系统

---

## 🛠️ 自动化检查工具

### 使用方法

```bash
# 1. 运行检查
npm run check:local-user

# 2. 查看报告
# 工具会自动输出：
# - 🔴 危险问题（需要立即修复）
# - 🟡 缺失导入（建议检查）
# - 📝 修复建议
```

### 检查内容

#### 1. 危险模式检测
- ✅ 硬编码用户 ID: `userId = "user_..."`
- ✅ 使用认证系统：`getCurrentUser()`, `useCurrentUser()`
- ✅ 未本地化的 auth 调用

#### 2. 导入完整性检测
- ✅ 使用 `prisma.user.*` 但未导入 `local-user`
- ✅ 使用 `userId` 变量但未定义来源
- ✅ 使用 Prisma CRUD 但未处理用户记录存在性

#### 3. 正确模式验证
- ✅ 使用 `getLocalUserId()`
- ✅ 使用 `LOCAL_USER_ID` 常量
- ✅ 正确导入：`import { getLocalUserId } from "@/lib/local-user"`

---

## 📝 移植检查清单

### 阶段 1: 代码移植前准备

- [ ] 确认目标代码来源（私有库分支/文件）
- [ ] 识别所有涉及用户 ID 的代码位置
- [ ] 准备 `src/lib/local-user.ts`（已存在）

### 阶段 2: 代码移植

- [ ] 复制目标文件到开源库
- [ ] **立即运行** `npm run check:local-user`
- [ ] 检查输出报告

### 阶段 3: 问题修复

#### 🔴 危险问题（必须修复）

**问题 1**: 使用 `getCurrentUser()` 或 `useCurrentUser()`

```typescript
// ❌ 错误
import { getCurrentUser } from "@/lib/auth";
const user = await getCurrentUser();
const userId = user.id;

// ✅ 正确
import { getLocalUserId } from "@/lib/local-user";
const userId = getLocalUserId();
```

**问题 2**: 硬编码用户 ID

```typescript
// ❌ 错误
const userId = "user_abc123";

// ✅ 正确
import { LOCAL_USER_ID } from "@/lib/local-user";
const userId = LOCAL_USER_ID;
```

#### 🟡 缺失导入（建议检查）

**问题**: 使用 `userId` 但未导入 `local-user`

```typescript
// ❌ 不完整
async function handler(req, res) {
  const userId = "local"; // 或从其他地方获取
  const data = await prisma.xxx.findMany({
    where: { userId }
  });
}

// ✅ 完整
import { getLocalUserId } from "@/lib/local-user";

async function handler(req, res) {
  const userId = getLocalUserId();
  const data = await prisma.xxx.findMany({
    where: { userId }
  });
}
```

### 阶段 4: 数据库兼容性

#### 使用 `upsert` 确保用户记录存在

```typescript
// ❌ 错误（用户记录可能不存在）
await prisma.user.update({
  where: { id: userId },
  data: { someField: value }
});

// ✅ 正确（自动创建或更新）
await prisma.user.upsert({
  where: { id: userId },
  create: {
    id: userId,
    email: 'local@postwizard.local',
    someField: value
  },
  update: {
    someField: value
  }
});
```

### 阶段 5: 验证测试

- [ ] 运行 `npm run check:local-user` 确认无 🔴 危险问题
- [ ] 手动测试移植的功能（端到端测试）
- [ ] 检查数据库记录是否正确创建
- [ ] 确认无认证相关错误

---

## 🔧 常见场景处理

### 场景 1: API 路由移植

```typescript
// src/app/api/xxx/route.ts

// ❌ 私有库代码（依赖认证）
import { getCurrentUser } from "@/lib/auth";

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  
  const data = await prisma.xxx.create({
    data: { userId: user.id, ... }
  });
}

// ✅ 开源库代码（本地模式）
import { getLocalUserId } from "@/lib/local-user";

export async function POST(req: Request) {
  const userId = getLocalUserId();
  
  const data = await prisma.xxx.create({
    data: { userId, ... }
  });
  
  return NextResponse.json({ success: true, data });
}
```

### 场景 2: Service 层移植

```typescript
// lib/services/xxxService.ts

// ❌ 私有库代码
export async function createItem(userId: string, data: any) {
  // 假设 userId 来自认证系统
  return await prisma.xxx.create({
    data: { userId, ...data }
  });
}

// ✅ 开源库代码
import { getLocalUserId } from "@/lib/local-user";

export async function createItem(_userId?: string, data: any) {
  // 使用本地用户 ID（忽略传入的参数）
  const userId = getLocalUserId();
  return await prisma.xxx.create({
    data: { userId, ...data }
  });
}
```

### 场景 3: 前端组件移植

```typescript
// components/xxx.tsx

// ❌ 私有库代码（使用 Hook）
import { useCurrentUser } from "@/hooks/useCurrentUser";

export function MyComponent() {
  const { user } = useCurrentUser();
  
  return <div>Hello {user.name}</div>;
}

// ✅ 开源库代码（本地模式）
import { getLocalUser } from "@/lib/local-user";

export function MyComponent() {
  const user = getLocalUser();
  
  return <div>Hello {user.name || "User"}</div>;
}
```

### 场景 4: Prisma 查询移植

```typescript
// 任何使用 Prisma 的地方

// ❌ 私有库代码（多用户查询）
const items = await prisma.xxx.findMany({
  where: {
    userId: "user_specific_id" // 或从认证获取
  }
});

// ✅ 开源库代码（单用户查询）
import { getLocalUserId } from "@/lib/local-user";

const userId = getLocalUserId();
const items = await prisma.xxx.findMany({
  where: { userId }
});

// 或者使用常量
import { LOCAL_USER_ID } from "@/lib/local-user";

const items = await prisma.xxx.findMany({
  where: { userId: LOCAL_USER_ID }
});
```

---

## 📊 检查工具输出示例

```bash
$ npm run check:local-user

🔍 开始检查本地用户 ID 使用情况...

📁 扫描文件：236 个

⚠️  发现 36 个潜在问题：

🔴 危险问题（需要立即修复）:

  1. lib\api.ts:158
     检测到 getCurrentUser() 调用（可能未本地化）
     建议：替换为：getLocalUserId()（来自 src/lib/local-user.ts）

  2. lib\local-user.ts:9
     检测到 getCurrentUser() 调用（可能未本地化）
     建议：替换为：getLocalUserId()（来自 src/lib/local-user.ts）

🟡 缺失导入（建议检查）:

  1. app\api\received-cards\check-duplicate\route.ts
     检测到使用 userId 但未导入 local-user 模块
     建议：添加导入：import { getLocalUserId } from "@/lib/local-user";

  ... (更多问题)

📝 修复建议:
   1. 对于危险问题：立即按照建议修复
   2. 对于缺失导入：检查文件是否确实需要本地用户 ID
   3. 运行此脚本：node scripts/local-user-check.js
```

---

## 🎯 最佳实践

### 1. 移植后立即检查
```bash
# 移植代码后的第一个命令
npm run check:local-user
```

### 2. 统一使用本地用户模块
```typescript
// 推荐：始终使用函数
import { getLocalUserId } from "@/lib/local-user";
const userId = getLocalUserId();

// 也可：使用常量
import { LOCAL_USER_ID } from "@/lib/local-user";
where: { userId: LOCAL_USER_ID }

// 也可：获取完整用户对象
import { getLocalUser } from "@/lib/local-user";
const user = getLocalUser();
```

### 3. Prisma 操作使用 upsert
```typescript
// 永远假设用户记录可能不存在
await prisma.user.upsert({
  where: { id: getLocalUserId() },
  create: { id: getLocalUserId(), email: '...' },
  update: { ... }
});
```

### 4. 避免认证依赖
```typescript
// ❌ 避免
import { auth } from "@/lib/auth";
import { getSession } from "next-auth/react";

// ✅ 使用
import { getLocalUserId, getLocalUser } from "@/lib/local-user";
```

---

## 🔗 相关文档

- **本地用户模块**: `src/lib/local-user.ts`
- **检查工具脚本**: `scripts/local-user-check.js`
- **技术债务检查**: `scripts/tech-debt-checker.js`
- **团队 SOP**: `.workbuddy/sop/TEAM_SOP.md`

---

## 📈 持续改进

### 检查工具增强计划
- [ ] 自动修复功能（`--fix` 参数）
- [ ] Git 预提交钩子集成
- [ ] CI/CD 检查集成
- [ ] 更精确的上下文分析

### 文档更新记录
- **v1.0** (2026-04-16): 初始版本，包含基础检查工具和 SOP

---

**最后更新**: 2026-04-16  
**维护者**: PostWizard Team
