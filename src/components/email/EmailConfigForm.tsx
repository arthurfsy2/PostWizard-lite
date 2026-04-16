'use client';

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CheckCircle, Wand2, ChevronDown, ChevronUp, Loader2, FolderOpen, RefreshCw } from 'lucide-react';
import { useCreateEmailConfig, useUpdateEmailConfig, useTestConnectionAndGetFolders } from '@/hooks/useApi';
import type { EmailConfig } from '@/lib/api';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

// 邮箱提供商配置映射
const EMAIL_PROVIDERS = {
  'qq.com': { name: 'QQ 邮箱', host: 'imap.qq.com', port: 993, username: 'email' },
  'foxmail.com': { name: 'Foxmail', host: 'imap.qq.com', port: 993, username: 'email' },
  '163.com': { name: '网易 163 邮箱', host: 'imap.163.com', port: 993, username: 'email' },
  '126.com': { name: '网易 126 邮箱', host: 'imap.126.com', port: 993, username: 'email' },
  'yeah.net': { name: '网易 Yeah 邮箱', host: 'imap.yeah.net', port: 993, username: 'email' },
  'gmail.com': { name: 'Gmail', host: 'imap.gmail.com', port: 993, username: 'email' },
  'outlook.com': { name: 'Outlook', host: 'outlook.office365.com', port: 993, username: 'email' },
  'hotmail.com': { name: 'Hotmail', host: 'outlook.office365.com', port: 993, username: 'email' },
  'icloud.com': { name: 'iCloud', host: 'imap.mail.me.com', port: 993, username: 'email' },
  'protonmail.com': { name: 'ProtonMail', host: '127.0.0.1', port: 993, username: 'email' },
  'yahoo.com': { name: 'Yahoo 邮箱', host: 'imap.mail.yahoo.com', port: 993, username: 'email' },
};

// 提取邮箱域名
const getEmailDomain = (email: string): string => {
  const match = email.match(/@([^@]+)$/);
  return match ? match[1].toLowerCase() : '';
};

// 根据邮箱获取提供商配置
const getProviderConfig = (email: string) => {
  const domain = getEmailDomain(email);
  return EMAIL_PROVIDERS[domain] || null;
};

interface EmailConfigFormProps {
  /** 提交成功后的回调 */
  onSuccess?: () => void;
  /** 取消回调 */
  onCancel?: () => void;
  /** 是否显示取消按钮 */
  showCancel?: boolean;
  /** 是否显示"下一步"按钮（用于弹窗内嵌场景） */
  showNextButton?: boolean;
  /** 编辑时预填充的配置 */
  editConfig?: EmailConfig | null;
  /** 自定义标题 */
  title?: string;
  /** 自定义描述 */
  description?: string;
}

export function EmailConfigForm({
  onSuccess,
  onCancel,
  showCancel = true,
  showNextButton = false,
  editConfig,
  title,
  description,
}: EmailConfigFormProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [detectedProvider, setDetectedProvider] = useState<{ name: string; icon: string } | null>(null);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [availableFolders, setAvailableFolders] = useState<string[]>([]);
  const [folderError, setFolderError] = useState<string>('');

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    imapHost: '',
    imapPort: 993,
    imapUsername: '',
    imapPassword: '',
    folderPath: '',
  });

  const createMutation = useCreateEmailConfig();
  const updateMutation = useUpdateEmailConfig();
  const testConnectionMutation = useTestConnectionAndGetFolders();
  const isEditing = !!editConfig;

  // 邮箱变化时自动识别并填充配置
  const handleEmailChange = (email: string) => {
    const provider = getProviderConfig(email);
    if (provider) {
      setDetectedProvider({ name: provider.name, icon: '✓' });
      setFormData(prev => ({
        ...prev,
        email,
        name: prev.name || provider.name,
        imapHost: provider.host,
        imapPort: provider.port,
        imapUsername: provider.username === 'email' ? email : email.split('@')[0],
      }));
    } else {
      setDetectedProvider(null);
      setFormData(prev => ({
        ...prev,
        email,
      }));
    }
    if (formErrors.email) setFormErrors(prev => ({ ...prev, email: '' }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // 表单验证
    const errors: Record<string, string> = {};
    if (!formData.name.trim()) errors.name = '请输入配置名称';
    if (!formData.email.trim()) errors.email = '请输入邮箱地址';
    if (!formData.imapHost.trim()) errors.imapHost = '请输入 IMAP 服务器地址';
    if (!formData.imapUsername.trim()) errors.imapUsername = '请输入 IMAP 用户名';
    if (!formData.imapPassword.trim()) errors.imapPassword = '请输入 IMAP 授权码';
    
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }
    setFormErrors({});
    
    try {
      if (isEditing && editConfig?.id) {
        // 更新模式
        await updateMutation.mutateAsync({
          id: editConfig.id,
          updates: {
            ...formData,
            isActive: true,
          },
        });
      } else {
        // 创建模式
        await createMutation.mutateAsync({
          ...formData,
          isActive: true,
        });
      }
      
      // 重置表单
      resetForm();
      
      // 触发成功回调
      onSuccess?.();
    } catch (error) {
      toast.error('保存失败：' + (error instanceof Error ? error.message : '未知错误'));
    }
  };

  // 重置表单
  const resetForm = useCallback(() => {
    setFormData({
      name: '',
      email: '',
      imapHost: '',
      imapPort: 993,
      imapUsername: '',
      imapPassword: '',
      folderPath: '',
    });
    setDetectedProvider(null);
    setShowAdvanced(false);
    setFormErrors({});
    setAvailableFolders([]);
    setFolderError('');
  }, []);

  // 弹窗打开时重置表单或填充编辑数据
  useEffect(() => {
    if (editConfig) {
      // 编辑模式：填充现有数据
      setFormData({
        name: editConfig.name || '',
        email: editConfig.email || '',
        imapHost: editConfig.imapHost || '',
        imapPort: editConfig.imapPort || 993,
        imapUsername: editConfig.imapUsername || '',
        imapPassword: editConfig.imapPassword || '',
        folderPath: editConfig.folderPath || '',
      });
      // 识别提供商
      const provider = getProviderConfig(editConfig.email);
      if (provider) {
        setDetectedProvider({ name: provider.name, icon: '✓' });
      }
      // 如果有文件夹路径，展开高级设置
      if (editConfig.folderPath) {
        setShowAdvanced(true);
      }
    } else {
      // 创建模式：重置表单
      resetForm();
    }
  }, [editConfig, resetForm]);

  // 获取文件夹列表
  const handleFetchFolders = async () => {
    setFolderError('');
    try {
      const result = await testConnectionMutation.mutateAsync({
        imapHost: formData.imapHost,
        imapPort: formData.imapPort,
        imapUsername: formData.imapUsername,
        imapPassword: formData.imapPassword,
        useTLS: true,
        rejectUnauthorized: false,
      });

      if (result.success && result.folders) {
        setAvailableFolders(result.folders || []);
        toast.success('连接成功', {
          description: result.message || `成功连接到 ${formData.imapHost}`,
        });
      } else if (result.success && result.data && result.data.folders) {
        setAvailableFolders(result.data.folders || []);
        toast.success('连接成功', {
          description: result.message || '邮箱配置验证通过',
        });
      } else {
        setFolderError(result.error || '获取文件夹列表失败');
        toast.error('连接失败', {
          description: result.error || '请检查邮箱配置是否正确',
        });
      }
    } catch (error: any) {
      setFolderError(error.message || '获取文件夹列表失败');
      toast.error('连接失败', {
        description: error.message || '请检查邮箱配置是否正确',
      });
    }
  };

  // 手动选择文件夹
  const handleFolderChange = (value: string) => {
    if (value === '__custom__') {
      setFormData({ ...formData, folderPath: '' });
    } else {
      setFormData({ ...formData, folderPath: value });
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* 标题（可选，用于内嵌场景） */}
      {(title || description) && (
        <div className="mb-4">
          {title && (
            <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center">
                <Wand2 className="h-4 w-4 text-white" />
              </div>
              {title}
            </h3>
          )}
          {description && (
            <p className="text-sm text-gray-500 mt-1">{description}</p>
          )}
        </div>
      )}

      {/* 主要字段：邮箱 + 授权码 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="form-email" className="text-gray-700 font-medium">
            邮箱地址
          </Label>
          <div className="relative mt-1.5">
            <Input
              id="form-email"
              type="email"
              value={formData.email}
              onChange={(e) => handleEmailChange(e.target.value)}
              placeholder="your@email.com"
              className="h-10 border-gray-200 focus:border-orange-400 focus:ring-orange-400/20 pr-20"
              required
            />
            {detectedProvider && (
              <div className="absolute right-2 top-1/2 -translate-y-1/2">
                <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded-full text-xs font-medium flex items-center gap-1">
                  <CheckCircle className="h-3 w-3" />
                  {detectedProvider.name}
                </span>
              </div>
            )}
          </div>
          {formErrors.email && (
            <p className="text-sm text-red-500 mt-1">{formErrors.email}</p>
          )}
        </div>
        <div>
          <Label htmlFor="form-imap-password" className="text-gray-700 font-medium">
            授权码
          </Label>
          <Input
            id="form-imap-password"
            type="password"
            value={formData.imapPassword}
            onChange={(e) => {
              setFormData({ ...formData, imapPassword: e.target.value });
              if (formErrors.imapPassword) setFormErrors(prev => ({ ...prev, imapPassword: '' }));
            }}
            placeholder="邮箱授权码（非登录密码）"
            className="h-10 mt-1.5 border-gray-200 focus:border-orange-400 focus:ring-orange-400/20"
            required
          />
          {formErrors.imapPassword && (
            <p className="text-sm text-red-500 mt-1">{formErrors.imapPassword}</p>
          )}
        </div>
      </div>

      {/* 配置名称（可选，自动填充） */}
      <div>
        <Label htmlFor="form-name" className="text-gray-700 font-medium">
          配置名称 <span className="text-gray-400 font-normal">（可选）</span>
        </Label>
        <Input
          id="form-name"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          placeholder={detectedProvider ? detectedProvider.name : "例如：我的 QQ 邮箱"}
          className="h-10 mt-1.5 border-gray-200 focus:border-orange-400 focus:ring-orange-400/20"
        />
      </div>

      {/* 高级选项切换 */}
      <div className="border-t border-gray-100 pt-3">
        <button
          type="button"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="flex items-center gap-2 text-sm text-gray-500 hover:text-orange-600 transition-colors"
        >
          {showAdvanced ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          {showAdvanced ? '收起高级配置' : '展开高级配置（手动设置 IMAP）'}
        </button>
      </div>

      {/* 高级配置区域 */}
      {showAdvanced && (
        <div className="space-y-4 p-4 bg-gray-50/80 rounded-xl border border-gray-100">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="form-imap-host" className="text-gray-700">IMAP 服务器</Label>
              <Input
                id="form-imap-host"
                value={formData.imapHost}
                onChange={(e) => {
                  setFormData({ ...formData, imapHost: e.target.value });
                  if (formErrors.imapHost) setFormErrors(prev => ({ ...prev, imapHost: '' }));
                }}
                placeholder="imap.qq.com"
                className="h-9 mt-1 border-gray-200 focus:border-orange-400"
                required
              />
              {formErrors.imapHost && (
                <p className="text-sm text-red-500 mt-1">{formErrors.imapHost}</p>
              )}
            </div>
            <div>
              <Label htmlFor="form-imap-port" className="text-gray-700">IMAP 端口</Label>
              <Input
                id="form-imap-port"
                type="number"
                value={formData.imapPort}
                onChange={(e) => setFormData({ ...formData, imapPort: parseInt(e.target.value) || 993 })}
                placeholder="993"
                className="h-9 mt-1 border-gray-200 focus:border-orange-400"
                required
              />
            </div>
          </div>

          <div>
            <Label htmlFor="form-imap-username" className="text-gray-700">IMAP 用户名</Label>
            <Input
              id="form-imap-username"
              value={formData.imapUsername}
              onChange={(e) => {
                setFormData({ ...formData, imapUsername: e.target.value });
                if (formErrors.imapUsername) setFormErrors(prev => ({ ...prev, imapUsername: '' }));
              }}
              placeholder="通常与邮箱相同"
              className="h-9 mt-1 border-gray-200 focus:border-orange-400"
              required
            />
            {formErrors.imapUsername && (
              <p className="text-sm text-red-500 mt-1">{formErrors.imapUsername}</p>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between">
              <Label className="text-gray-700">
                邮件文件夹路径 <span className="text-gray-400 font-normal">（可选）</span>
              </Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleFetchFolders}
                disabled={testConnectionMutation.isPending || !formData.imapHost || !formData.imapUsername || !formData.imapPassword}
                className="h-7 px-2 text-xs text-orange-600 hover:text-orange-700 hover:bg-orange-50"
              >
                {testConnectionMutation.isPending ? (
                  <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                ) : (
                  <RefreshCw className="h-3 w-3 mr-1" />
                )}
                获取文件夹
              </Button>
            </div>
            
            {availableFolders.length > 0 ? (
              <Select
                value={formData.folderPath || '__default__'}
                onValueChange={handleFolderChange}
              >
                <SelectTrigger className="h-9 mt-1 border-gray-200 focus:border-orange-400">
                  <SelectValue placeholder="选择文件夹（默认为 INBOX）" />
                </SelectTrigger>
                <SelectContent className="max-h-[200px] bg-white border-gray-200 shadow-lg">
                  <SelectItem value="__default__">
                    <span className="text-gray-400">使用默认（INBOX）</span>
                  </SelectItem>
                  {availableFolders.map((folder) => (
                    <SelectItem key={folder} value={folder}>
                      <div className="flex items-center gap-2">
                        <FolderOpen className="h-3 w-3 text-gray-400" />
                        <span>{folder}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Input
                value={formData.folderPath}
                onChange={(e) => setFormData({ ...formData, folderPath: e.target.value })}
                placeholder="例如：其他文件夹/Mail"
                className="h-9 mt-1 border-gray-200 focus:border-orange-400"
              />
            )}
            
            {folderError && (
              <p className="text-sm text-red-500 mt-1">{folderError}</p>
            )}
          </div>
        </div>
      )}

      {/* 支持的邮箱提示 */}
      <div className="flex flex-wrap gap-2 text-xs text-gray-400">
        <span>支持：</span>
        {Object.values(EMAIL_PROVIDERS).slice(0, 6).map((provider, idx) => (
          <span key={idx} className="bg-gray-100 px-2 py-0.5 rounded-full">
            {provider.name}
          </span>
        ))}
        <span>等 {Object.keys(EMAIL_PROVIDERS).length}+ 种邮箱</span>
      </div>

      {/* 操作按钮 */}
      <div className="flex justify-end gap-2 pt-2">
        {showCancel && onCancel && (
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            className="border-gray-300"
          >
            取消
          </Button>
        )}
        <Button
          type="submit"
          disabled={createMutation.isPending || updateMutation.isPending}
          className="bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600"
        >
          {(createMutation.isPending || updateMutation.isPending) && (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          )}
          {isEditing ? '更新配置' : '保存并继续'}
        </Button>
      </div>
    </form>
  );
}
