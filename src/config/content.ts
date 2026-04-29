import { FlowStep, FAQItem, PlanContent, FAQCategory } from "@/types/content";

// ==================== Help 页面 - 寄信流程步骤 ====================
export const sendFlowSteps: FlowStep[] = [
  {
    title: "解析收信人偏好",
    description: "粘贴邮件或邮箱直连获取收信人信息",
    icon: "Mail",
    gradient: "from-blue-500 to-cyan-500",
    bg: "bg-blue-50",
  },
  {
    title: "AI 解析",
    description: "智能识别收件人信息",
    icon: "Sparkles",
    gradient: "from-purple-500 to-pink-500",
    bg: "bg-purple-50",
  },
  {
    title: "生成内容",
    description: "AI 创作个性化英文信件",
    icon: "FileText",
    gradient: "from-orange-500 to-amber-500",
    bg: "bg-orange-50",
  },
  {
    title: "打印邮寄",
    description: "导出 PDF 直接打印",
    icon: "Printer",
    gradient: "from-emerald-500 to-teal-500",
    bg: "bg-emerald-50",
  },
];

// ==================== Help 页面 - 收信流程步骤 ====================
export const receiveFlowSteps: FlowStep[] = [
  {
    title: "拍照上传",
    description: "上传收到的明信片照片",
    icon: "Camera",
    gradient: "from-pink-500 to-rose-500",
    bg: "bg-pink-50",
  },
  {
    title: "AI 识别",
    description: "自动识别手写内容和寄件人信息",
    icon: "ScanLine",
    gradient: "from-fuchsia-500 to-pink-500",
    bg: "bg-fuchsia-50",
  },
  {
    title: "选择模板",
    description: "挑选喜欢的晒单风格",
    icon: "Layout",
    gradient: "from-rose-500 to-red-500",
    bg: "bg-rose-50",
  },
  {
    title: "分享晒单",
    description: "生成精美图片，分享到小红书",
    icon: "Share2",
    gradient: "from-pink-500 to-rose-600",
    bg: "bg-pink-50",
  },
];

// ==================== Help 页面 - FAQ 列表 ====================
export const helpFaqs: FAQItem[] = [
  {
    question: "PostWizard AI 是什么？",
    answer:
      "PostWizard AI 是一个智能明信片收、寄信助手，使用 AI 分析收件人兴趣偏好，自动生成个性化英文信件，让国际明信片交流更简单。",
    icon: "HelpCircle",
  },
  {
    question: "免费额度有多少？",
    answer:
      "注册即送 {quota} 次免费 AI 生成额度（一次性赠送）。开通会员后可无限生成，并解锁邮箱绑定、批量生成等高级功能。",
    icon: "Zap",
  },
  {
    question: "如何绑定邮箱？",
    answer:
      "邮箱绑定是会员功能。绑定后，系统会自动从您的邮箱读取邮件，无需手动复制粘贴，大幅提升使用体验。",
    icon: "Mail",
  },
  {
    question: "支持哪些邮箱服务？",
    answer:
      "目前支持腾讯企业邮箱、QQ 邮箱、163 邮箱、Gmail 等主流邮箱服务。系统会自动配置 IMAP 设置，使用非常简单。",
    icon: "Send",
  },
  {
    question: "如何获得邀请奖励？",
    answer:
      "分享您的专属邀请链接，好友注册后您可获得 3 次免费额度，好友首次开通会员您还可额外获得 2 次额度奖励。",
    icon: "Users",
  },
  {
    question: "遇到问题如何反馈？",
    answer:
      "欢迎到 GitHub 仓库提交 Issue，开发者会尽快回复。",
    icon: "MessageCircle",
  },
  // 收信相关 FAQ
  {
    question: "如何记录收到的明信片？",
    answer:
      '进入"收信"页面，点击上传按钮选择明信片照片。AI 会自动识别明信片上的手写内容、寄件人信息，并生成精美的晒单图片供您保存或分享。',
    icon: "Camera",
  },
  {
    question: "收信识别免费额度有多少？",
    answer:
      "免费用户每月享有 {quota} 次收信 AI 识别额度。开通会员后可享受无限次识别额度。",
    icon: "Zap",
  },
  {
    question: "分享图会显示什么信息？",
    answer:
      "分享图会显示您选择的模板样式，包括 AI 识别的明信片内容摘要、寄件人信息、识别时间等，既美观又能保护隐私。您可以分享到小红书、朋友圈等社交平台。",
    icon: "Share2",
  },
  {
    question: "AI 能识别手写内容吗？",
    answer:
      "可以！我们使用先进的 AI 视觉识别技术，能够识别明信片上的手写内容，包括英文和中文。识别准确率会随着使用不断优化，您也可以手动修正识别结果。",
    icon: "FileText",
  },
  // 额度奖励 FAQ
  {
    question: "如何免费获取更多额度？",
    answer:
      "有多种方式可以获取免费额度：\n1. 邀请好友注册：双方各得 +3 次额度\n2. 提交反馈建议：采纳后得 +1~5 天会员\n3. 每日签到：连续签到奖励翻倍（即将上线）",
    icon: "Gift",
  },
  {
    question: "邀请奖励是如何计算的？",
    answer:
      "通过您的专属邀请链接注册的好友，注册成功后您和好友各获得 +3 次额度。奖励额度永久有效，可叠加使用。",
    icon: "Users",
  },
];

// ==================== Pricing 页面 - 套餐配置 ====================
export const defaultPlans: PlanContent[] = [
  {
    id: "free",
    name: "免费版",
    price: 0,
    period: "永久",
    description: "基础功能，每月 {quota} 次 AI 额度",
    features: {
      write: [
        { text: "每月 {quota} 次 AI 写信", included: true },
        { text: "AI 收件人分析", included: true },
        { text: "基础写信模板 (3款)", included: true },
      ],
      receive: [
        { text: "每月 {quota} 次收信 AI 识别", included: true },
        { text: "基础收信模板 (2款)", included: true },
        { text: "基础信息识别", included: true },
      ],
      export: [
        { text: "Markdown 导出", included: true },
        { text: "高清 PDF 导出", included: false },
        { text: "批量导出", included: false },
      ],
      automation: [
        { text: "邮箱自动搜索", included: false },
        { text: "批量处理", included: false },
        { text: "优先客服支持", included: false },
      ],
    },
    cta: "当前套餐",
    recommended: false,
    icon: "Zap",
    gradient: "from-slate-400 to-slate-500",
    bg: "bg-slate-50",
  },
  {
    id: "monthly",
    name: "月卡",
    price: 15.9,
    period: "30 天",
    description: "无限生成，解锁全部功能",
    features: {
      write: [
        { text: "无限 AI 写信", included: true },
        { text: "AI 收件人分析", included: true },
        { text: "全部写信模板 (10+款)", included: true },
      ],
      receive: [
        { text: "无限收信 AI 识别", included: true },
        { text: "全部收信模板 (8+款)", included: true },
        { text: "高级信息识别", included: true },
        { text: "精美晒单图生成", included: true },
      ],
      export: [
        { text: "Markdown 导出", included: true },
        { text: "高清 PDF 导出", included: true },
        { text: "批量导出", included: true },
      ],
      automation: [
        { text: "邮箱自动搜索", included: true },
        { text: "批量处理", included: true },
        { text: "优先客服支持", included: true },
      ],
    },
    cta: "申请开通",
    recommended: true,
    icon: "Sparkles",
    gradient: "from-orange-500 to-amber-500",
    bg: "bg-orange-50",
    popular: true,
  },
  {
    id: "yearly",
    name: "年卡",
    price: 99,
    period: "365 天",
    description: "超值优惠，每天不到 3 毛钱",
    features: {
      write: [
        { text: "无限 AI 写信", included: true },
        { text: "AI 收件人分析", included: true },
        { text: "全部写信模板 (10+款)", included: true },
      ],
      receive: [
        { text: "无限收信 AI 识别", included: true },
        { text: "全部收信模板 (8+款)", included: true },
        { text: "高级信息识别", included: true },
        { text: "精美晒单图生成", included: true },
      ],
      export: [
        { text: "Markdown 导出", included: true },
        { text: "高清 PDF 导出", included: true },
        { text: "批量导出", included: true },
      ],
      automation: [
        { text: "邮箱自动搜索", included: true },
        { text: "批量处理", included: true },
        { text: "优先客服支持", included: true },
      ],
    },
    cta: "申请开通",
    recommended: false,
    icon: "Crown",
    gradient: "from-purple-500 to-pink-500",
    bg: "bg-purple-50",
    discount: "省 47%",
    saveAmount: "¥91.8",
    badge: "性价比爆表",
  },
];

// ==================== Pricing 页面 - FAQ 分类 ====================
export const pricingFaqCategories: FAQCategory[] = [
  {
    title: "💳 支付问题",
    icon: "CreditCard",
    items: [
      {
        question: "支持哪些支付方式？",
        answer: "支持微信支付和支付宝扫码支付。",
      },
      {
        question: "支付后多久生效？",
        answer: "管理员确认后 5 分钟内生效，通常在 24 小时内处理。",
      },
    ],
  },
  {
    title: "📋 订阅说明",
    icon: "FileText",
    items: [
      {
        question: "订阅从什么时候开始计算？",
        answer: "从支付确认成功后开始计算。",
      },
      {
        question: "可以同时购买多个套餐吗？",
        answer: "可以，新套餐会从当前订阅到期后开始生效。",
      },
    ],
  },
  {
    title: "💬 其他问题",
    icon: "MessageCircle",
    items: [
      {
        question: "如何联系客服？",
        answer: "发送邮件至 {customerServiceEmail}，我们会尽快回复。",
      },
      {
        question: "可以升级或降级套餐吗？",
        answer: "可以随时购买新套餐，会在当前套餐到期后生效。",
      },
    ],
  },
];

// ==================== 占位符替换工具函数 ====================

/**
 * 替换 Help 页面 FAQ 中的 {quota} 占位符
 */
export function getHelpFaqsWithQuota(
  faqs: FAQItem[],
  quota: number,
): FAQItem[] {
  return faqs.map((faq) => ({
    ...faq,
    answer: faq.answer.replace("{quota}", String(quota)),
  }));
}

/**
 * 替换 Pricing 页面套餐中的 {quota} 占位符
 */
export function getPlansWithQuota(
  plans: PlanContent[],
  quota: number,
): PlanContent[] {
  return plans.map((plan) => ({
    ...plan,
    description: plan.description.replace("{quota}", String(quota)),
    features: {
      write: plan.features.write.map((f) => ({
        ...f,
        text: f.text.replace("{quota}", String(quota)),
      })),
      receive: plan.features.receive.map((f) => ({
        ...f,
        text: f.text.replace("{quota}", String(quota)),
      })),
      export: plan.features.export.map((f) => ({
        ...f,
        text: f.text.replace("{quota}", String(quota)),
      })),
      automation: plan.features.automation.map((f) => ({
        ...f,
        text: f.text.replace("{quota}", String(quota)),
      })),
    },
  }));
}

/**
 * 替换 Pricing FAQ 中的客服邮箱占位符
 */
export function getPricingFaqsWithEmail(
  categories: FAQCategory[],
  customerServiceEmail: string,
): FAQCategory[] {
  return categories.map((category) => ({
    ...category,
    items: category.items.map((item) => ({
      ...item,
      answer: item.answer.replace(
        "{customerServiceEmail}",
        customerServiceEmail,
      ),
    })),
  }));
}
