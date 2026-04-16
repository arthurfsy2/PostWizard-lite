'use client';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { EmailConfigForm } from './EmailConfigForm';
import type { EmailConfig } from '@/lib/api';

interface EmailConfigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  editConfig?: EmailConfig | null;
}

/**
 * 邮箱配置弹窗
 * 内部使用 EmailConfigForm 组件
 */
export function EmailConfigDialog({
  open,
  onOpenChange,
  onSuccess,
  editConfig,
}: EmailConfigDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[672px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-slate-800">
            <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-amber-500 rounded-xl flex items-center justify-center shadow-md">
              <span className="text-lg">📧</span>
            </div>
            {editConfig ? '编辑邮箱' : '配置邮箱'}
          </DialogTitle>
          <DialogDescription className="text-slate-600">
            {editConfig 
              ? '修改邮箱配置信息' 
              : '输入邮箱地址和授权码，我们将自动为您匹配配置'}
          </DialogDescription>
        </DialogHeader>

        <EmailConfigForm
          editConfig={editConfig}
          onSuccess={() => {
            onOpenChange(false);
            onSuccess?.();
          }}
          onCancel={() => onOpenChange(false)}
          showCancel={true}
        />
      </DialogContent>
    </Dialog>
  );
}
