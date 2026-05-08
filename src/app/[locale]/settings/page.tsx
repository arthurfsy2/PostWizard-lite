'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Settings, Save, Loader2, Eye, EyeOff, Check, Zap, Wifi, Plus, Trash2, CheckCircle2 } from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { normalizeAIUrl } from '@/lib/ai-url';

interface AIConfig {
  id: string;
  provider: string;
  name: string;
  apiKey: string;
  baseUrl: string;
  model: string;
  useFor?: 'all' | 'text' | 'ocr';
  proxy?: string;
  enabled?: boolean;
  tier?: 'free' | 'paid';
  hasApiKey?: boolean;
}

// 预设配置
const PROVIDER_PRESETS = {
  qwen: {
    name: '通义千问 (阿里云)',
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    model: 'qwen-turbo',
    models: ['qwen-turbo', 'qwen-plus', 'qwen-max', 'qwen3.6-plus', 'qwen-vl-plus', 'qwen-vl-max', 'qwen-vl-ocr-latest'],
  },
  deepseek: {
    name: 'DeepSeek',
    baseUrl: 'https://api.deepseek.com/v1',
    model: 'deepseek-v4-flash',
    models: ['deepseek-v4-flash', 'deepseek-v4-pro'],
  },
  gemini: {
    name: 'Gemini (Google)',
    baseUrl: 'https://generativelanguage.googleapis.com',
    model: 'gemini-2.0-flash',
    models: ['gemini-3.1-flash-lite-preview', 'gemini-2.0-flash', 'gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-2.5-pro'],
  },
  openai: {
    name: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-4o-mini',
    models: ['gpt-4o-mini', 'gpt-4o', 'gpt-4.1-mini', 'gpt-4.1'],
  },
  custom: {
    name: '自定义',
    baseUrl: '',
    model: '',
    models: [],
  },
};

export default function SettingsPage() {
  const [configs, setConfigs] = useState<AIConfig[]>([]);
  const [activeId, setActiveId] = useState<string>('');
  const [currentConfig, setCurrentConfig] = useState<AIConfig>({
    id: '',
    provider: 'qwen',
    name: '通义千问',
    apiKey: '',
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    model: 'qwen-turbo',
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [error, setError] = useState('');
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message?: string;
    error?: string;
  } | null>(null);

  const t = useTranslations('Settings');

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const response = await fetch('/api/settings/ai');
      if (response.ok) {
        const data = await response.json();
        if (data.configs) {
          setConfigs(data.configs);
          setActiveId(data.activeId);
          // 从顶层字段加载激活配置（apiKey 已掩码）
          setCurrentConfig({
            id: data.activeId,
            provider: data.provider || 'qwen',
            name: data.name || '通义千问',
            apiKey: '',
            baseUrl: data.baseUrl || '',
            model: data.model || '',
            useFor: data.useFor || 'all',
            proxy: data.proxy || '',
            tier: data.tier || 'free',
            hasApiKey: data.hasApiKey,
          });
        }
      }
    } catch {
      // ignore
    } finally {
      setIsLoading(false);
    }
  };

  // 处理 provider 切换
  const handleProviderChange = (provider: string) => {
    const preset = PROVIDER_PRESETS[provider as keyof typeof PROVIDER_PRESETS];
    if (preset && provider !== 'custom') {
      setCurrentConfig({
        ...currentConfig,
        provider,
        name: preset.name,
        baseUrl: preset.baseUrl,
        model: preset.models[0] || preset.model,
      });
    } else {
      setCurrentConfig({ ...currentConfig, provider });
    }
  };

  // 切换到已有配置
  const handleSwitchConfig = async (configId: string) => {
    const config = configs.find(c => c.id === configId);
    if (!config) return;

    // 乐观更新
    setActiveId(configId);
    setCurrentConfig({
      ...config,
      apiKey: '',
      useFor: config.useFor || 'all',
      hasApiKey: config.hasApiKey,
    });

    try {
      const response = await fetch('/api/settings/ai', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activeId: configId }),
      });
      if (!response.ok) {
        throw new Error('切换失败');
      }
    } catch (err) {
      setError(t('switchFailed'));
    }
  };

  // 新建配置
  const handleNewConfig = () => {
    setCurrentConfig({
      id: '',
      provider: 'qwen',
      name: '新配置',
      apiKey: '',
      baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
      model: 'qwen-turbo',
      useFor: 'all',
    });
    setTestResult(null);
  };

  // 保存当前配置
  const handleSave = async () => {
    setError('');
    setSaveSuccess(false);

    // 前端校验
    if (!currentConfig.name.trim()) {
      setError(t('configNameRequired'));
      return;
    }
    if (!currentConfig.baseUrl.trim()) {
      setError(t('apiBaseUrlRequired'));
      return;
    }
    if (!currentConfig.model.trim()) {
      setError(t('modelRequired'));
      return;
    }

    setIsSaving(true);

    try {
      const response = await fetch('/api/settings/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: currentConfig.id || undefined,
          provider: currentConfig.provider,
          name: currentConfig.name,
          apiKey: currentConfig.apiKey,
          baseUrl: currentConfig.baseUrl,
          model: currentConfig.model,
          useFor: currentConfig.useFor || 'all',
          proxy: currentConfig.proxy || '',
          tier: currentConfig.tier || 'free',
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || t('saveFailed'));
      }

      setConfigs(result.configs);
      setActiveId(result.activeId);
      setCurrentConfig(prev => ({
        ...prev,
        id: result.activeId,
        apiKey: '',
        hasApiKey: true,
      }));
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      setError(err.message || t('saveFailed'));
    } finally {
      setIsSaving(false);
    }
  };

  // 删除配置
  const handleDelete = async (configId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(t('confirmDelete'))) return;

    setError('');

    try {
      const response = await fetch('/api/settings/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: configId, action: 'delete' }),
      });

      if (response.ok) {
        const result = await response.json();
        setConfigs(result.configs);
        if (configId === activeId && result.configs.length > 0) {
          await handleSwitchConfig(result.configs[0].id);
        }
      } else {
        const data = await response.json();
        setError(data.error || '删除失败');
      }
    } catch (err) {
      setError(t('deleteFailed'));
    }
  };

  // 切换配置启用/禁用
  const handleToggleEnabled = async (configId: string, enabled: boolean) => {
    const config = configs.find(c => c.id === configId);
    if (!config) return;

    // 乐观更新
    setConfigs(prev => prev.map(c => c.id === configId ? { ...c, enabled } : c));

    try {
      const response = await fetch('/api/settings/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: config.id,
          provider: config.provider,
          name: config.name,
          apiKey: '', // 空值会保留原 key
          baseUrl: config.baseUrl,
          model: config.model,
          useFor: config.useFor || 'all',
          proxy: config.proxy || '',
          enabled,
          tier: config.tier || 'free',
        }),
      });

      if (!response.ok) {
        // 回滚
        setConfigs(prev => prev.map(c => c.id === configId ? { ...c, enabled: !enabled } : c));
      } else {
        const result = await response.json();
        setConfigs(result.configs);
      }
    } catch {
      setConfigs(prev => prev.map(c => c.id === configId ? { ...c, enabled: !enabled } : c));
    }
  };

  const handleTest = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const response = await fetch('/api/settings/ai/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiKey: currentConfig.apiKey,
          baseUrl: currentConfig.baseUrl,
          model: currentConfig.model?.trim(),
          provider: currentConfig.provider,
          proxy: currentConfig.proxy || '',
          useFor: currentConfig.useFor || 'all',
          configId: currentConfig.id || undefined,
        }),
      });
      const data = await response.json();
      setTestResult(data);
    } catch {
      setTestResult({ success: false, error: t('connectionFailed') });
    } finally {
      setIsTesting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="container max-w-3xl mx-auto px-4 py-8 flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-orange-50/30 relative">
      {/* 页面背景装饰 */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        {/* 渐变光晕 */}
        <div
          className="absolute -top-40 -right-40 w-[500px] h-[500px] rounded-full opacity-60"
          style={{
            background: 'radial-gradient(ellipse at center, rgba(249, 115, 22, 0.08) 0%, transparent 60%)'
          }}
        />
        <div
          className="absolute top-1/3 -left-40 w-[400px] h-[400px] rounded-full opacity-40"
          style={{
            background: 'radial-gradient(ellipse at center, rgba(245, 158, 11, 0.06) 0%, transparent 60%)'
          }}
        />
        {/* 底纹 */}
        <div
          className="absolute inset-0 opacity-[0.015]"
          style={{
            backgroundImage: `repeating-linear-gradient(
              45deg,
              transparent,
              transparent 40px,
              rgba(249, 115, 22, 0.3) 40px,
              rgba(249, 115, 22, 0.3) 80px
            )`
          }}
        />
      </div>

      <Header />

      <main className="relative z-10">
        <div className="container max-w-3xl mx-auto px-4 py-8">
          <div className="mb-8">
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Settings className="h-6 w-6 text-orange-500" />
              {t('title')}
            </h1>
            <p className="text-muted-foreground mt-1">{t('description')}</p>
          </div>

          <div className="grid gap-6">
        {/* 已保存的配置列表 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <CheckCircle2 className="h-5 w-5 text-green-500" />
              {t('savedConfigs')}
            </CardTitle>
            <CardDescription>{t('savedConfigsDesc')}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {configs.map((config) => (
                <div
                  key={config.id}
                  onClick={() => handleSwitchConfig(config.id)}
                  className={`
                    cursor-pointer group flex items-center gap-2 px-3 py-2 rounded-lg border
                    transition-all duration-200 hover:shadow-md
                    ${config.enabled === false ? 'opacity-50' : ''}
                    ${activeId === config.id
                      ? 'bg-green-50 border-green-300 text-green-800'
                      : 'bg-white border-gray-200 hover:border-orange-300'
                    }
                  `}
                >
                  <div onClick={(e) => e.stopPropagation()}>
                    <Switch
                      checked={config.enabled !== false}
                      onCheckedChange={(checked) => handleToggleEnabled(config.id, checked)}
                      className="scale-75"
                    />
                  </div>
                  <span className="text-sm font-medium">{config.name}</span>
                  <Badge variant="outline" className="text-xs">
                    {config.provider}
                  </Badge>
                  {config.useFor && config.useFor !== 'all' && (
                    <Badge variant="secondary" className="text-xs">
                      {config.useFor === 'ocr' ? t('useForOcr') : t('useForText')}
                    </Badge>
                  )}
                  {activeId === config.id && (
                    <Check className="h-3.5 w-3.5 text-green-600" />
                  )}
                  <button
                    onClick={(e) => handleDelete(config.id, e)}
                    className="ml-1 opacity-0 group-hover:opacity-100 p-1 hover:bg-red-100 rounded transition-opacity"
                    title={t('deleteConfig')}
                  >
                    <Trash2 className="h-3.5 w-3.5 text-red-500" />
                  </button>
                </div>
              ))}
              <Button
                variant="outline"
                size="sm"
                onClick={handleNewConfig}
                className="border-dashed"
              >
                <Plus className="h-4 w-4 mr-1" />
                {t('newConfig')}
              </Button>
            </div>
            {/* 当前生效配置摘要 */}
            {(() => {
              const enabledConfigs = configs.filter(c => c.enabled !== false);
              const ocrConfig = enabledConfigs.find(c => c.useFor === 'ocr');
              const textConfig = enabledConfigs.find(c => c.useFor === 'text');
              const generalConfig = enabledConfigs.find(c => c.useFor === 'all' || !c.useFor);

              return (
                <div className="mt-3 pt-3 border-t text-xs text-muted-foreground space-y-1">
                  <div className="font-medium text-foreground/70 mb-1">{t('activeSummary')}：</div>
                  <div>
                    {t('imageRecognition')}：<span className="text-foreground">{ocrConfig ? `${ocrConfig.name}（${ocrConfig.model}）` : generalConfig ? `${generalConfig.name}（${generalConfig.model}）` : t('notConfigured')}</span>
                    {ocrConfig && <span className="ml-1 text-green-600">{t('dedicated')}</span>}
                  </div>
                  <div>
                    {t('textAnalysis')}：<span className="text-foreground">{textConfig ? `${textConfig.name}（${textConfig.model}）` : generalConfig ? `${generalConfig.name}（${generalConfig.model}）` : t('notConfigured')}</span>
                    {textConfig && <span className="ml-1 text-green-600">{t('dedicated')}</span>}
                  </div>
                </div>
              );
            })()}
          </CardContent>
        </Card>

        {/* AI 配置编辑区 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-orange-500" />
              {currentConfig.id ? t('editConfig') : t('newConfig')}
            </CardTitle>
            <CardDescription>{t('editConfigDesc')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {saveSuccess && (
              <Alert className="border-green-200 bg-green-50">
                <Check className="h-4 w-4 text-green-600" />
                <AlertDescription className="text-green-700">{t('saveSuccess')}</AlertDescription>
              </Alert>
            )}

            {/* 配置名称 */}
            <div className="space-y-2">
              <Label htmlFor="name">{t('configName')}</Label>
              <Input
                id="name"
                value={currentConfig.name}
                onChange={(e) => setCurrentConfig({ ...currentConfig, name: e.target.value })}
                placeholder="例如：我的通义千问"
              />
            </div>

            {/* Provider 选择 */}
            <div className="space-y-2">
              <Label>{t('provider')}</Label>
              <Select value={currentConfig.provider} onValueChange={handleProviderChange}>
                <SelectTrigger>
                  <SelectValue placeholder="选择 AI 服务商" />
                </SelectTrigger>
                <SelectContent className="bg-white border shadow-lg z-50">
                  {Object.entries(PROVIDER_PRESETS).map(([key, preset]) => (
                    <SelectItem key={key} value={key} className="cursor-pointer hover:bg-gray-100">
                      {preset.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {t('providerSwitchHint')}
              </p>
            </div>

            {/* API Key */}
            <div className="space-y-2">
              <Label htmlFor="apiKey">API Key</Label>
              {currentConfig.hasApiKey && !currentConfig.apiKey && (
                <p className="text-xs text-green-600 font-medium">{t('apiKeySet')}</p>
              )}
              <div className="flex gap-2">
                <Input
                  id="apiKey"
                  type={showApiKey ? 'text' : 'password'}
                  value={currentConfig.apiKey}
                  onChange={(e) => setCurrentConfig({ ...currentConfig, apiKey: e.target.value, hasApiKey: false })}
                  placeholder={currentConfig.hasApiKey ? t('apiKeyPlaceholder') : 'sk-...'}
                  className="flex-1"
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setShowApiKey(!showApiKey)}
                >
                  {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">{t('apiKeyDesc')}</p>
            </div>

            {/* Base URL */}
            <div className="space-y-2">
              <Label htmlFor="baseUrl" className="flex items-center gap-1">
                <Wifi className="h-3.5 w-3.5" />
                API Base URL
              </Label>
              <Input
                id="baseUrl"
                value={currentConfig.baseUrl}
                onChange={(e) => setCurrentConfig({ ...currentConfig, baseUrl: e.target.value })}
                placeholder="https://api.openai.com/v1"
              />
              {/* URL 预览 */}
              <div className="text-xs text-muted-foreground bg-gray-50 px-3 py-2 rounded border">
                <span className="text-gray-500">{t('sdkEndpoint')}：</span>
                <code className="text-orange-600">
                  {currentConfig.baseUrl
                    ? `${normalizeAIUrl(currentConfig.baseUrl, currentConfig.provider)}/chat/completions`
                    : 'https://...'}
                </code>
              </div>
            </div>

            {/* Proxy */}
            <div className="space-y-2">
              <Label htmlFor="proxy" className="flex items-center gap-1">
                {t('proxy')}
              </Label>
              <Input
                id="proxy"
                value={currentConfig.proxy || ''}
                onChange={(e) => setCurrentConfig({ ...currentConfig, proxy: e.target.value })}
                placeholder={t('proxyPlaceholder')}
              />
              <p className="text-xs text-muted-foreground">{t('proxyDesc')}</p>
            </div>

            {/* Tier */}
            <div className="space-y-2">
              <Label>{t('tier')}</Label>
              <div className="flex gap-2">
                {([
                  { value: 'free', label: t('tierFree'), desc: t('tierFreeDesc') },
                  { value: 'paid', label: t('tierPaid'), desc: t('tierPaidDesc') },
                ] as const).map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setCurrentConfig({ ...currentConfig, tier: opt.value })}
                    className={`flex-1 px-3 py-2 rounded-lg border text-left transition-all ${
                      (currentConfig.tier || 'free') === opt.value
                        ? 'border-orange-400 bg-orange-50 text-orange-800'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="text-sm font-medium">{opt.label}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">{opt.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Model */}
            <div className="space-y-2">
              <Label htmlFor="model">{t('model')}</Label>
              {(() => {
                const preset = PROVIDER_PRESETS[currentConfig.provider as keyof typeof PROVIDER_PRESETS];
                const hasModels = preset && preset.models.length > 0;
                const isCustomModel = hasModels && !preset.models.includes(currentConfig.model);

                if (hasModels) {
                  return (
                    <>
                      <Select
                        value={isCustomModel ? '__custom__' : currentConfig.model}
                        onValueChange={(val) => {
                          if (val === '__custom__') {
                            setCurrentConfig({ ...currentConfig, model: '' });
                          } else {
                            setCurrentConfig({ ...currentConfig, model: val });
                          }
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder={t('modelSelect')} />
                        </SelectTrigger>
                        <SelectContent className="bg-white border shadow-lg z-50">
                          {preset.models.map((m) => (
                            <SelectItem key={m} value={m} className="cursor-pointer hover:bg-gray-100">
                              {m}
                            </SelectItem>
                          ))}
                          <SelectItem value="__custom__" className="cursor-pointer hover:bg-gray-100 text-muted-foreground">
                            {t('modelCustom')}
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      {isCustomModel && (
                        <Input
                          id="model"
                          value={currentConfig.model}
                          onChange={(e) => setCurrentConfig({ ...currentConfig, model: e.target.value })}
                          placeholder={t('modelPlaceholder')}
                          className="mt-2"
                        />
                      )}
                    </>
                  );
                }

                return (
                  <Input
                    id="model"
                    value={currentConfig.model}
                    onChange={(e) => setCurrentConfig({ ...currentConfig, model: e.target.value })}
                    placeholder="例如：gpt-4o、qwen-plus、deepseek-chat"
                  />
                );
              })()}
              <p className="text-xs text-muted-foreground">{t('modelDesc')}</p>
            </div>

            {/* 用途选择 */}
            <div className="space-y-3">
              <Label>{t('useFor')}</Label>
              <div className="flex flex-wrap gap-3">
                {[
                  { value: 'all' as const, label: t('useForAll'), desc: t('useForAllDesc') },
                  { value: 'text' as const, label: t('useForText'), desc: t('useForTextDesc') },
                  { value: 'ocr' as const, label: t('useForOcr'), desc: t('useForOcrDesc') },
                ].map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setCurrentConfig({ ...currentConfig, useFor: opt.value })}
                    className={`
                      flex-1 min-w-[120px] px-4 py-3 rounded-xl border-2 text-left transition-all
                      ${currentConfig.useFor === opt.value
                        ? 'border-orange-400 bg-orange-50 shadow-sm'
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                      }
                    `}
                  >
                    <div className="flex items-center gap-2">
                      <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                        currentConfig.useFor === opt.value
                          ? 'border-orange-500 bg-orange-500'
                          : 'border-slate-300'
                      }`}>
                        {currentConfig.useFor === opt.value && (
                          <div className="w-1.5 h-1.5 rounded-full bg-white" />
                        )}
                      </div>
                      <span className="text-sm font-medium">{opt.label}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 ml-6">{opt.desc}</p>
                  </button>
                ))}
              </div>
              {currentConfig.useFor === 'ocr' && (
                <p className="text-xs text-amber-600">
                  {t('useForOcrHint')}
                </p>
              )}
            </div>

            {/* 测试连接结果 */}
            {testResult && (
              <Alert className={testResult.success ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}>
                <AlertDescription className={testResult.success ? 'text-green-700' : 'text-red-700'}>
                  {testResult.success
                    ? `✅ 连接成功：${testResult.message}`
                    : `❌ 连接失败：${testResult.error}`}
                </AlertDescription>
              </Alert>
            )}

            {/* 操作按钮 */}
            <div className="flex gap-3 pt-2">
              <Button
                onClick={handleSave}
                disabled={isSaving}
                className="bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600"
              >
                {isSaving ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" />保存中...</>
                ) : (
                  <><Save className="h-4 w-4 mr-2" />{t('saveConfig')}</>
                )}
              </Button>
              <Button
                variant="outline"
                onClick={handleTest}
                disabled={isTesting}
              >
                {isTesting ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" />{t('testing')}</>
                ) : (
                  <><Wifi className="h-4 w-4 mr-2" />{t('testConnection')}</>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
      </main>

      <Footer />
    </div>
  );
}
