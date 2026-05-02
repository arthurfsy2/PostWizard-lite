<div align="center">

<img src="public/favicon.svg" width="120" alt="PostWizard Logo">

# PostWizard Lite ✨

**开源版 · 明信片智能收寄信助手**

<p align="center">
  <a href="#-功能特性">功能特性</a> •
  <a href="#-快速开始">快速开始</a> •
  <a href="#-技术栈">技术栈</a> •
  <a href="#-截图预览">截图预览</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Next.js-16-black?logo=next.js&logoColor=white" alt="Next.js">
  <img src="https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white" alt="React">
  <img src="https://img.shields.io/badge/TypeScript-5.0-3178C6?logo=typescript&logoColor=white" alt="TypeScript">
  <img src="https://img.shields.io/badge/Tailwind-4-06B6D4?logo=tailwindcss&logoColor=white" alt="Tailwind">
  <img src="https://img.shields.io/badge/Prisma-5-2D3748?logo=prisma&logoColor=white" alt="Prisma">
</p>

<p align="center">
  <img src="https://img.shields.io/github/license/arthurfsy2/PostWizard-lite" alt="License">
  <img src="https://img.shields.io/github/stars/arthurfsy2/PostWizard-lite?style=social" alt="Stars">
  <img src="https://img.shields.io/github/forks/arthurfsy2/PostWizard-lite?style=social" alt="Forks">
</p>

</div>

---

## 🎯 一句话介绍

基于 AI 的明信片收、寄信助手。
寄信：分析收件人兴趣、自动生成个性化明信片内容，解决不知道写什么的苦恼；抓取邮箱中的他人注册时的回复，自动生成 Timeline、词云、精选留言。
收信：识别难以辨认的手写内容、趣味抽卡评价明信片

> 💡 **项目来源**：本开源版核心功能来自 [PostWizard 完整版](https://postwizard.cn)（支持用户注册、多用户管理、捐赠支持、反馈、帮助等）。这是 PostWizard 的简化开源+本地使用版本。

---

## ✨ 功能特性

### 📮 寄信流程

- **📋 粘贴解析** — 直接粘贴邮件文本，智能提取收件人信息，根据收件人画像自动生成个性化英文内容
- **📧 邮件解析** — IMAP 自动抓取收件人信息邮件，一键识别（和粘贴解析二选一即可）
- **📜 历史记录** — 管理所有待寄和已寄明信片
- **✍️ 送达回复** — 抓取邮箱中的他人注册时的回复，自动生成 Timeline、词云、精选留言。

### 📬 收信流程

- **📷 上传识别** — 上传明信片照片，OCR 自动识别文字
- **🗂️ 收信历史** — 整理所有收到的明信片
- **🖼️ 图片处理** — 自动裁剪、增强、旋转图片（优化中）

### 🎮 特色功能

- **🎴 收片抽卡菜单** — AI 分析明信片内容，评定内容真诚度 + 号码 lucky 值（SSR/SR/R/N）并生成多维评分
- **👤 个人要素** — 个人简介中英双语管理，让收信人感受到真实的你！
- **📊 收信分析** — 送达回复追踪、词云、精选留言
- **🖨️ 打印功能** — A4 批量打印版，带剪切线

---

## 🚀 快速开始

### 1. 克隆项目

```bash
git clone https://github.com/arthurfsy2/PostWizard-lite.git
cd PostWizard-lite
```

### 2. 安装依赖

```bash
npm install
```

### 3. 配置数据库

开源版使用 SQLite，无需额外配置。数据库文件 `dev.db` 会在首次运行时自动创建。

```bash
# 生成 Prisma Client
npm run db:generate

# 推送数据库结构
npm run db:push
```

### 4. 配置 AI API

#### 方式一：环境变量（推荐）

创建 `.env.local` 文件：

```bash
# OpenAI 兼容 API（必需，作为网页配置的 fallback）
DASHSCOPE_API_KEY=your-api-key
AI_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
AI_MODEL=qwen3.6-plus

# 可选：启用管理员密码保护
ADMIN_PASSWORD=your-strong-password

# 可选：禁用 Prisma 查询日志
DISABLE_PRISMA_QUERY_LOGS=true
```

> 加密密钥 `ENCRYPTION_KEY` 会**在首次运行时自动生成**并写入 `.env.local`，无需手动配置。

#### 方式二：网页配置

启动后访问 `/settings` 页面，在网页中配置 API Key、Base URL 和模型。

![API SETTINGS](docs/screenshots/api-settings.png)

**高级功能**：

- **分用途配置**：可为 OCR 图片识别和文字分析分别配置不同的模型和服务商。例如用千问 VL 做图片识别，用 DeepSeek 做文字分析。在配置中选择"仅图片"或"仅文字"用途即可。
- **代理设置**：如需访问 Gemini 等境外服务，可在配置中填写代理地址（如 `127.0.0.1:7890`）。建议使用美国、日本、新加坡等地区节点，香港节点可能不被部分 API 支持。

---

## 🔑 API Key 申请指南

### 阿里云百炼（推荐 · 有免费额度）

阿里云百炼提供 **免费试用额度**，支持视觉识别模型（适合明信片 OCR 识别）。

**申请步骤**：
1. 访问 [阿里云百炼控制台](https://bailian.console.aliyun.com/)
2. 注册/登录阿里云账号
3. 进入「模型广场」→ 选择 **Qwen-VL-Max** 或 **Qwen-VL-Plus**（视觉识别模型）
4. 点击「开通服务」→ 领取免费试用额度
5. 创建 API Key：进入「API-KEY 管理」→ 创建新的 API Key

**配置示例**（与截图一致）：
```bash
# 配置名称（仅网页配置显示）
qwen 配置

# AI 服务商：通义千问 (阿里云)
DASHSCOPE_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxx
AI_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
AI_MODEL=qwen3-vl-8b-thinking
```

> 💡 **提示**：
> - 免费额度约 **100 万 token**（具体以官网为准）
> - 必须选择 **Qwen-VL** 系列模型（支持图片识别，如 `qwen3-vl-8b-thinking`）
> - Base URL 使用阿里云百炼的兼容模式地址
> - SDK 实际请求地址：`https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions`

### 其他 API 提供商

你也可以使用其他 OpenAI 兼容的 API 服务：
- **OpenAI 官方**：`https://api.openai.com/v1`
- **DeepSeek**：`https://api.deepseek.com/v1`
- **Google Gemini**：`https://generativelanguage.googleapis.com/v1beta/openai`（需代理）
- **智谱 AI**：`https://open.bigmodel.cn/api/paas/v4`
- **自定义服务**：本地部署的 Ollama、vLLM 等

### 5. 启动开发服务器

```bash
npm run dev
```

访问 http://localhost:3001

---

## ⚠️ 安全提示

默认**无用户认证系统**，适合本地开发和私有网络部署。

### 启用管理员登录

如需部署到公网，设置 `ADMIN_PASSWORD` 环境变量即可开启密码保护：

```bash
# .env.local
ADMIN_PASSWORD=your-strong-password
```

> 修改密码后需**重启服务器**才能生效。

- ✅ 设置后：所有页面需要密码登录才能访问
- ⬜ 未设置时：无认证，行为与之前一致
- 登录状态通过 httpOnly Cookie 保持，有效期 7 天

---

## 📁 项目结构

```
src/
├── app/                  # Next.js App Router 页面
│   ├── arrivals/         # 送达回复追踪
│   ├── emails/           # 邮件解析
│   │   ├── received/         # 收信管理
│   ├── sent/             # 寄信管理
│   ├── profile/          # 个人要素
│   ├── settings/         # 设置
│   └── api/              # API 路由
├── components/           # UI 组件
│   ├── ui/               # 基础组件 (shadcn/ui)
│   ├── gacha/            # 抽卡系统
│   └── ...
├── lib/                  # 工具库 & 服务
├── hooks/                # React Hooks
└── types/                # TypeScript 类型定义
```

---

## 🛠️ 技术栈

| 类别               | 技术                    |
| ------------------ | ----------------------- |
| **框架**     | Next.js 16 (App Router) |
| **语言**     | TypeScript / React 19   |
| **样式**     | Tailwind CSS 4          |
| **数据库**   | SQLite (Prisma ORM)     |
| **状态管理** | Zustand                 |
| **数据获取** | TanStack Query + SWR    |
| **AI**       | OpenAI 兼容 API         |
| **OCR**      | Tesseract.js            |
| **测试**     | Vitest + Playwright     |
| **部署**     | 本地 / 私有服务器       |

---

## 📸 截图预览

<div align="center">

|               AI 解析收件人               |                  收信智能评价                  |
| :----------------------------------------: | :--------------------------------------------: |
| ![AI Parse](docs/screenshots/sent-parse.jpg) | ![Received AI](docs/screenshots/received-ai.jpg) |

|                送达时间线                |                  词云分析                  |
| :--------------------------------------: | :----------------------------------------: |
| ![Timeline](docs/screenshots/timeline.png) | ![WordCloud](docs/screenshots/wordcloud.png) |

</div>

---

## 🧪 开发脚本

```bash
# 开发
npm run dev              # 启动开发服务器
npm run dev:uat          # 启动 UAT 环境 (端口 3002)

# 测试
npm run test             # 运行单元测试
npm run test:coverage    # 生成测试覆盖率报告
npm run test:e2e         # 运行 E2E 测试

# 代码质量
npm run lint             # ESLint 检查
npm run check:tech-debt  # 检查技术债务
npm run check:local-user # 检查 userId 本地化

# 数据库
npm run db:generate      # 生成 Prisma Client
npm run db:push          # 推送数据库结构
npm run db:migrate       # 运行数据库迁移

# 部署
npm run build            # 构建生产版本
npm run start            # 启动生产服务器
```

---

## 🌟 Star History

<a href="https://star-history.com/#arthurfsy2/PostWizard-lite&Date">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/svg?repos=arthurfsy2/PostWizard-lite&type=Date&theme=dark" />
    <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/svg?repos=arthurfsy2/PostWizard-lite&type=Date" />
    <img alt="Star History Chart" src="https://api.star-history.com/svg?repos=arthurfsy2/PostWizard-lite&type=Date" />
  </picture>
</a>

---

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

1. Fork 本项目
2. 创建你的特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 打开一个 Pull Request

---

## 📄 许可证

[MIT](./LICENSE) © 2025 PostWizard

---

<div align="center">

**用 ❤️ 和 🎴 制作**

<p>
  <a href="https://github.com/arthurfsy2/PostWizard-lite/stargazers">⭐ Star 支持我们</a> •
  <a href="https://github.com/arthurfsy2/PostWizard-lite/issues">🐛 报告问题</a> •
  <a href="https://github.com/arthurfsy2/PostWizard-lite/discussions">💬 参与讨论</a>
</p>

</div>
