"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Sparkles,
  Mail,
  FileText,
  Printer,
  ChevronRight,
  ChevronLeft,
  X,
  Camera,
  ScanLine,
  Layout,
  Share2,
  Send,
  MapPin,
  CheckCircle,
  UserPlus,
  ImageIcon,
} from "lucide-react";
import { useNewUserQuota } from "@/hooks/useNewUserQuota";

const ONBOARDING_STORAGE_KEY = "postwizard_onboarding_completed";

type PathType = "send" | "receive" | null;

// 寄信路径步骤
const sendPathSteps = [
  {
    id: "send-1",
    title: "输入收件人地址",
    description: "粘贴邮件中的收件人信息",
    icon: MapPin,
    color: "from-orange-500 to-amber-500",
    bgColor: "bg-orange-50",
  },
  {
    id: "send-2",
    title: "AI 智能写信",
    description: "AI 分析收件人喜好，生成个性化英文信件",
    icon: Sparkles,
    color: "from-purple-500 to-pink-500",
    bgColor: "bg-purple-50",
  },
  {
    id: "send-3",
    title: "选择明信片样式",
    description: "挑选喜欢的模板风格，预览最终效果",
    icon: Layout,
    color: "from-blue-500 to-cyan-500",
    bgColor: "bg-blue-50",
  },
  {
    id: "send-4",
    title: "确认寄送",
    description: "导出 PDF 打印，或复制内容手写",
    icon: Send,
    color: "from-emerald-500 to-teal-500",
    bgColor: "bg-emerald-50",
  },
];

// 收信路径步骤
const receivePathSteps = [
  {
    id: "receive-1",
    title: "拍照上传明信片",
    description: "上传收到的明信片照片，支持多张",
    icon: Camera,
    color: "from-pink-500 to-rose-500",
    bgColor: "bg-pink-50",
  },
  {
    id: "receive-2",
    title: "AI 智能识别",
    description: "自动识别手写内容、寄件人信息和邮票",
    icon: ScanLine,
    color: "from-fuchsia-500 to-purple-500",
    bgColor: "bg-fuchsia-50",
  },
  {
    id: "receive-3",
    title: "选择分享模板",
    description: "挑选晒单风格，生成精美分享图",
    icon: ImageIcon,
    color: "from-rose-500 to-red-500",
    bgColor: "bg-rose-50",
  },
  {
    id: "receive-4",
    title: "保存/分享记录",
    description: "保存到卡册，或分享到小红书、朋友圈",
    icon: Share2,
    color: "from-pink-500 to-rose-600",
    bgColor: "bg-pink-50",
  },
];

interface WelcomeGuideProps {
  forceShow?: boolean;
  onClose?: () => void;
}

export function WelcomeGuide({
  forceShow = false,
  onClose,
}: WelcomeGuideProps) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  // 使用统一的 Hook 获取新用户额度
  const { newUserQuota } = useNewUserQuota();

  // 引导流程状态
  const [currentStep, setCurrentStep] = useState(0); // 0=欢迎, 1=路径选择, 2+=具体路径步骤
  const [currentPath, setCurrentPath] = useState<PathType>(null);

  useEffect(() => {
    setMounted(true);

    if (forceShow) {
      setOpen(true);
      return;
    }

    // 检查用户是否已看过引导
    const hasCompletedOnboarding = localStorage.getItem(ONBOARDING_STORAGE_KEY);
    if (!hasCompletedOnboarding) {
      // 稍微延迟显示，避免页面加载时就弹窗
      const timer = setTimeout(() => {
        setOpen(true);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [forceShow]);

  // 获取当前路径的步骤
  const getCurrentPathSteps = () => {
    return currentPath === "send" ? sendPathSteps : receivePathSteps;
  };

  // 获取总步骤数
  const getTotalSteps = () => {
    if (currentStep === 0) return 1; // 欢迎页
    if (currentStep === 1) return 1; // 路径选择
    return getCurrentPathSteps().length; // 具体路径步骤
  };

  // 获取当前步骤的序号（用于进度显示）
  const getCurrentStepNumber = () => {
    if (currentStep === 0) return 1;
    if (currentStep === 1) return 2;
    return currentStep; // 路径步骤从 2 开始
  };

  // 获取总步骤数（包含欢迎和路径选择）
  const getOverallTotalSteps = () => {
    return 2 + (currentPath ? getCurrentPathSteps().length : 4); // 2 (欢迎+选择) + 路径步骤
  };

  const handleNext = () => {
    if (currentStep === 0) {
      // 从欢迎页到路径选择
      setCurrentStep(1);
    } else if (currentStep === 1) {
      // 路径选择页面需要选择后才能继续
      return;
    } else {
      // 路径步骤中
      const pathSteps = getCurrentPathSteps();
      const currentPathStep = currentStep - 2; // 减去欢迎和路径选择
      if (currentPathStep < pathSteps.length - 1) {
        setCurrentStep(currentStep + 1);
      } else {
        handleComplete();
      }
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
      // 如果返回到路径选择，重置路径
      if (currentStep === 2) {
        setCurrentPath(null);
      }
    }
  };

  const handlePathSelect = (path: "send" | "receive") => {
    setCurrentPath(path);
    setCurrentStep(2); // 进入路径第一步
  };

  const handleSkip = () => {
    localStorage.setItem(ONBOARDING_STORAGE_KEY, "true");
    setOpen(false);
    onClose?.();
  };

  const handleComplete = () => {
    localStorage.setItem(ONBOARDING_STORAGE_KEY, "true");
    setOpen(false);
    onClose?.();
  };

  // 渲染欢迎页面
  const renderWelcomeStep = () => (
    <div className="space-y-6">
      <div className="bg-gradient-to-br from-orange-50 to-amber-50 rounded-2xl p-8 text-center">
        <div className="w-20 h-20 bg-gradient-to-br from-orange-400 to-amber-500 rounded-2xl flex items-center justify-center mx-auto mb-5 shadow-lg">
          <Sparkles className="h-10 w-10 text-white" />
        </div>
        <h3 className="text-xl font-bold text-gray-900 mb-3">
          让明信片写作变简单
        </h3>
        <p className="text-sm text-gray-600 leading-relaxed">
          AI 明信片收、寄信助手，学习项目
          <br />
          免费赠送{" "}
          <span className="font-semibold text-orange-600">
            {newUserQuota}
          </span>{" "}
          次额度，学生党友好 🎓
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-slate-50 rounded-xl p-4 text-center">
          <Mail className="h-6 w-6 text-orange-500 mx-auto mb-2" />
          <div className="text-sm font-medium text-slate-900">AI 写信</div>
          <div className="text-xs text-slate-500">粘贴即生成</div>
        </div>
        <div className="bg-slate-50 rounded-xl p-4 text-center">
          <Camera className="h-6 w-6 text-pink-500 mx-auto mb-2" />
          <div className="text-sm font-medium text-slate-900">收信晒单</div>
          <div className="text-xs text-slate-500">拍照即识别</div>
        </div>
      </div>
    </div>
  );

  // 渲染路径选择页面
  const renderPathSelection = () => (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <p className="text-sm text-slate-600">
          选择您想了解的流程，我们将为您展示详细步骤
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* 寄信路径卡片 */}
        <button
          onClick={() => handlePathSelect("send")}
          className="group relative p-6 rounded-2xl border-2 border-slate-200 hover:border-orange-400 hover:bg-orange-50/50 transition-all duration-300 text-left"
        >
          <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
            <ChevronRight className="h-5 w-5 text-orange-500" />
          </div>
          <div className="w-14 h-14 bg-gradient-to-br from-orange-400 to-amber-500 rounded-xl flex items-center justify-center mb-4 shadow-lg group-hover:scale-110 transition-transform">
            <Mail className="h-7 w-7 text-white" />
          </div>
          <h3 className="text-lg font-bold text-slate-900 mb-2">开始寄信</h3>
          <p className="text-sm text-slate-600 leading-relaxed">
            AI 帮你写明信片
            <br />4 步完成寄送
          </p>
          <div className="mt-4 flex items-center gap-2 text-xs text-orange-600 font-medium">
            <Sparkles className="h-3 w-3" />
            <span>推荐新用户</span>
          </div>
        </button>

        {/* 收信路径卡片 */}
        <button
          onClick={() => handlePathSelect("receive")}
          className="group relative p-6 rounded-2xl border-2 border-slate-200 hover:border-pink-400 hover:bg-pink-50/50 transition-all duration-300 text-left"
        >
          <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
            <ChevronRight className="h-5 w-5 text-pink-500" />
          </div>
          <div className="w-14 h-14 bg-gradient-to-br from-pink-400 to-rose-500 rounded-xl flex items-center justify-center mb-4 shadow-lg group-hover:scale-110 transition-transform">
            <Camera className="h-7 w-7 text-white" />
          </div>
          <h3 className="text-lg font-bold text-slate-900 mb-2">记录收信</h3>
          <p className="text-sm text-slate-600 leading-relaxed">
            拍照识别明信片
            <br />
            生成精美晒单
          </p>
          <div className="mt-4 flex items-center gap-2 text-xs text-pink-600 font-medium">
            <Share2 className="h-3 w-3" />
            <span>适合晒单分享</span>
          </div>
        </button>
      </div>
    </div>
  );

  // 渲染路径步骤
  const renderPathStep = () => {
    const steps = getCurrentPathSteps();
    const currentPathStep = currentStep - 2; // 减去欢迎和路径选择
    const step = steps[currentPathStep];
    // 安全检查：如果步骤不存在，返回 null
    if (!step) {
      return null;
    }
    const Icon = step.icon;
    const isLastStep = currentPathStep === steps.length - 1;

    return (
      <div className="space-y-5">
        {/* 步骤卡片 */}
        <div className={`${step.bgColor} rounded-2xl p-6`}>
          <div className="flex items-start gap-4">
            <div
              className={`w-12 h-12 bg-gradient-to-br ${step.color} rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg`}
            >
              <Icon className="h-6 w-6 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900 mb-1">
                {step.title}
              </h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                {step.description}
              </p>
            </div>
          </div>
        </div>

        {/* 步骤预览图（示意） */}
        <div className="bg-slate-50 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
              步骤预览
            </span>
            <span className="text-xs text-slate-400">
              {currentPathStep + 1} / {steps.length}
            </span>
          </div>
          <div className="flex gap-2">
            {steps.map((s, idx) => {
              const StepIcon = s.icon;
              return (
                <div
                  key={s.id}
                  className={`flex-1 h-16 rounded-lg flex flex-col items-center justify-center gap-1 transition-all ${
                    idx === currentPathStep
                      ? "bg-white shadow-md ring-2 ring-offset-1 " +
                        (currentPath === "send"
                          ? "ring-orange-400"
                          : "ring-pink-400")
                      : idx < currentPathStep
                        ? "bg-slate-100"
                        : "bg-slate-100/50"
                  }`}
                >
                  <StepIcon
                    className={`h-4 w-4 ${
                      idx === currentPathStep
                        ? currentPath === "send"
                          ? "text-orange-500"
                          : "text-pink-500"
                        : idx < currentPathStep
                          ? "text-slate-400"
                          : "text-slate-300"
                    }`}
                  />
                  <span className="text-[10px] text-slate-500 truncate w-full text-center px-1">
                    {s.title.slice(0, 4)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* 完成提示 */}
        {isLastStep && (
          <div className="bg-emerald-50 rounded-xl p-4 flex items-center gap-3">
            <CheckCircle className="h-5 w-5 text-emerald-500 flex-shrink-0" />
            <p className="text-sm text-emerald-700">
              完成！您可以开始
              {currentPath === "send" ? "寄出第一张明信片" : "记录第一张收信"}了
            </p>
          </div>
        )}
      </div>
    );
  };

  // 渲染当前步骤内容
  const renderContent = () => {
    if (currentStep === 0) return renderWelcomeStep();
    if (currentStep === 1) return renderPathSelection();
    return renderPathStep();
  };

  // 获取当前步骤标题和描述
  const getStepInfo = () => {
    if (currentStep === 0) {
      return {
        title: "欢迎来到 PostWizard AI",
        description: "AI 帮你写信，让国际交流更简单！",
        icon: Sparkles,
      };
    }
    if (currentStep === 1) {
      return {
        title: "选择您的起点",
        description: "告诉我们您想先了解哪个功能",
        icon: UserPlus,
      };
    }
    const steps = getCurrentPathSteps();
    const currentPathStep = currentStep - 2;
    return {
      title: steps[currentPathStep]?.title || "",
      description: steps[currentPathStep]?.description || "",
      icon: steps[currentPathStep]?.icon || Sparkles,
    };
  };

  const stepInfo = getStepInfo();
  const StepIcon = stepInfo.icon;
  const isWelcome = currentStep === 0;
  const isPathSelection = currentStep === 1;

  // 防止 hydration 不匹配
  if (!mounted) {
    return null;
  }

  // 处理对话框关闭（点击外部或按ESC）
  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      // 用户关闭对话框时，保存完成状态
      localStorage.setItem(ONBOARDING_STORAGE_KEY, "true");
    }
    setOpen(isOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        showClose={false}
        className="sm:max-w-lg p-0 overflow-hidden"
      >
        {/* 头部渐变区域 */}
        <div
          className={`p-6 text-white ${
            currentPath === "receive" && !isWelcome && !isPathSelection
              ? "bg-gradient-to-r from-pink-500 to-rose-500"
              : "bg-gradient-to-r from-orange-500 to-amber-500"
          }`}
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                <StepIcon className="h-5 w-5" />
              </div>
              <span className="text-sm font-medium opacity-90">
                {!isPathSelection &&
                  `步骤 ${getCurrentStepNumber()} / ${getOverallTotalSteps()}`}
                {isPathSelection && "选择路径"}
              </span>
            </div>
            <button
              onClick={handleSkip}
              className="text-white/70 hover:text-white transition-colors"
              aria-label="跳过引导"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <DialogHeader className="space-y-2">
            <DialogTitle className="text-xl text-white">
              {stepInfo.title}
            </DialogTitle>
            <DialogDescription className="text-white/80">
              {stepInfo.description}
            </DialogDescription>
          </DialogHeader>

          {/* 进度条 */}
          {!isPathSelection && (
            <div className="mt-4">
              <div className="flex items-center gap-1">
                {Array.from({ length: getOverallTotalSteps() }).map(
                  (_, idx) => {
                    const stepNum = idx + 1;
                    const currentStepNum = getCurrentStepNumber();
                    return (
                      <div
                        key={idx}
                        className={`h-1.5 rounded-full transition-all duration-300 ${
                          stepNum === currentStepNum
                            ? "flex-1 bg-white"
                            : stepNum < currentStepNum
                              ? "w-4 bg-white/60"
                              : "w-4 bg-white/30"
                        }`}
                      />
                    );
                  },
                )}
              </div>
            </div>
          )}
        </div>

        {/* 内容区域 */}
        <div className="p-6">{renderContent()}</div>

        {/* 按钮区域 */}
        {!isPathSelection && (
          <DialogFooter className="p-6 pt-0 gap-2">
            {!isWelcome && (
              <Button
                variant="outline"
                onClick={handlePrevious}
                className="flex-1"
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                上一步
              </Button>
            )}

            <Button
              onClick={handleNext}
              className={`flex-1 bg-gradient-to-r ${
                currentPath === "receive"
                  ? "from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600"
                  : "from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600"
              }`}
            >
              {currentStep >= 2 &&
              currentStep - 2 === getCurrentPathSteps().length - 1 ? (
                "开始使用"
              ) : (
                <>
                  下一步
                  <ChevronRight className="h-4 w-4 ml-1" />
                </>
              )}
            </Button>
          </DialogFooter>
        )}

        {/* 跳过按钮 */}
        <div className="pb-4 text-center">
          <button
            onClick={handleSkip}
            className="text-sm text-gray-400 hover:text-gray-600 transition-colors"
          >
            跳过引导
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// 导出重置函数，方便测试
export function resetOnboardingStatus() {
  if (typeof window !== "undefined") {
    localStorage.removeItem(ONBOARDING_STORAGE_KEY);
  }
}

export default WelcomeGuide;
