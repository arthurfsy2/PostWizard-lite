// 功能描述
export interface FeatureContent {
  text: string;
  included: boolean;
}

// 流程步骤
export interface FlowStep {
  title: string;
  description: string;
  icon: string; // Lucide icon name
  gradient: string; // Tailwind gradient classes
  bg: string; // Tailwind background class
}

// FAQ
export interface FAQItem {
  question: string;
  answer: string;
  icon: string; // Lucide icon name
  category?: string;
}

// 额度奖励
export interface RewardContent {
  title: string;
  description: string;
  icon: string;
  action?: string;
  actionText?: string;
  badge?: string;
}

// 价值主张
export interface ValueProp {
  title: string;
  description: string;
  icon: string;
}

// Pricing 页面功能分类
export interface PlanFeatures {
  write: FeatureContent[];
  receive: FeatureContent[];
  export: FeatureContent[];
  automation: FeatureContent[];
}

// Pricing 套餐配置
export interface PlanContent {
  id: string;
  name: string;
  price: number;
  period: string;
  description: string;
  features: PlanFeatures;
  cta: string;
  recommended: boolean;
  icon: string; // Lucide icon name
  gradient: string;
  bg: string;
  popular?: boolean;
  discount?: string;
  saveAmount?: string;
  badge?: string;
}

// 帮助页面FAQ分类
export interface FAQCategory {
  title: string;
  icon: string;
  items: Array<{
    question: string;
    answer: string;
  }>;
}

// 主配置结构
export interface ContentConfig {
  // Pricing 页面
  plans: PlanContent[];
  faqCategories: FAQCategory[];
  
  // Help 页面
  flowSteps: {
    send: FlowStep[];
    receive: FlowStep[];
  };
  faqs: FAQItem[];
}
