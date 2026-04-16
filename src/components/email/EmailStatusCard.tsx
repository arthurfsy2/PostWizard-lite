"use client";

import { Check } from "lucide-react";
import { ReactNode } from "react";

interface EmailStatusCardProps {
  /** 当前绑定邮箱地址 */
  email: string;
  /** 右侧操作区（ReactNode，可传入按钮组） */
  actions?: ReactNode;
  /** 额外类名 */
  className?: string;
}

/**
 * 邮箱绑定状态展示卡片。
 * 绿色背景，白色勾图标，邮箱地址居左，操作按钮居右。
 *
 * @example
 * // arrivals：仅显示"添加/切换邮箱"按钮
 * <EmailStatusCard email="xxx@gmail.com" actions={<AddButton />} />
 *
 * @example
 * // emails：显示"添加/切换邮箱" + "解绑"按钮
 * <EmailStatusCard email="xxx@gmail.com" actions={<><AddButton /><UnbindButton /></>} />
 */
export function EmailStatusCard({ email, actions, className = "" }: EmailStatusCardProps) {
  return (
    <div className={`flex items-center justify-between p-3 bg-emerald-50 rounded-lg border border-emerald-200 ${className}`}>
      <div className="flex items-center gap-2">
        <Check className="w-4 h-4 text-emerald-600" />
        <span className="text-sm text-emerald-700 font-medium">{email}</span>
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
