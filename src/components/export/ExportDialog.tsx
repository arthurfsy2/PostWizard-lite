'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, FileText, FileDown, Printer } from 'lucide-react';

interface ExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedCount: number;
  onExport: (options: ExportOptions) => void;
  onPrint?: () => void;
  isLoading?: boolean;
}

export interface ExportOptions {
  format: 'markdown' | 'pdf';
  includeRecipient: boolean;
  includeSignature: boolean;
  fontSize: 'small' | 'medium' | 'large';
}

export function ExportDialog({
  open,
  onOpenChange,
  selectedCount,
  onExport,
  onPrint,
  isLoading = false,
}: ExportDialogProps) {
  const t = useTranslations('Export');
  const [format, setFormat] = useState<'markdown' | 'pdf'>('markdown');
  const [includeRecipient, setIncludeRecipient] = useState(true);
  const [includeSignature, setIncludeSignature] = useState(true);
  const [fontSize, setFontSize] = useState<'small' | 'medium' | 'large'>('medium');

  const handleExport = () => {
    onExport({
      format,
      includeRecipient,
      includeSignature,
      fontSize,
    });
  };

  const handleDownload = (data: string, filename: string, type: string) => {
    const blob = new Blob([data], { type });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{t('title')}</DialogTitle>
          <DialogDescription>
            {t('description', { count: selectedCount })}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-6 py-4">
          {/* 导出格式 */}
          <div className="grid gap-2">
            <Label htmlFor="format">{t('format')}</Label>
            <Select
              value={format}
              onValueChange={(value: 'markdown' | 'pdf') => setFormat(value)}
            >
              <SelectTrigger id="format">
                <SelectValue placeholder={t('formatPlaceholder')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="markdown">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    {t('markdown')}
                  </div>
                </SelectItem>
                <SelectItem value="pdf">
                  <div className="flex items-center gap-2">
                    <FileDown className="h-4 w-4" />
                    {t('pdf')}
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {format === 'markdown'
                ? t('markdownDesc')
                : t('pdfDesc')}
            </p>
          </div>

          {/* 导出内容选项 */}
          <div className="space-y-3">
            <Label>{t('content')}</Label>
            <div className="flex flex-col gap-3">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="includeRecipient"
                  checked={includeRecipient}
                  onCheckedChange={(checked) => setIncludeRecipient(checked as boolean)}
                />
                <Label htmlFor="includeRecipient" className="font-normal cursor-pointer">
                  {t('includeRecipient')}
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="includeSignature"
                  checked={includeSignature}
                  onCheckedChange={(checked) => setIncludeSignature(checked as boolean)}
                />
                <Label htmlFor="includeSignature" className="font-normal cursor-pointer">
                  {t('includeSignature')}
                </Label>
              </div>
            </div>
          </div>

          {/* 字体大小 */}
          <div className="grid gap-2">
            <Label htmlFor="fontSize">{t('fontSize')}</Label>
            <Select
              value={fontSize}
              onValueChange={(value: 'small' | 'medium' | 'large') => setFontSize(value)}
            >
              <SelectTrigger id="fontSize">
                <SelectValue placeholder={t('fontSizePlaceholder')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="small">{t('small')}</SelectItem>
                <SelectItem value="medium">{t('medium')}</SelectItem>
                <SelectItem value="large">{t('large')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter className="gap-2">
          {onPrint && (
            <Button
              variant="outline"
              onClick={onPrint}
              disabled={isLoading}
              className="mr-auto"
            >
              <Printer className="h-4 w-4 mr-2" />
              {t('batchPrint')}
            </Button>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('cancel')}
          </Button>
          <Button onClick={handleExport} disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                {t('exporting')}
              </>
            ) : (
              <>
                <FileDown className="h-4 w-4 mr-2" />
                {t('export', { count: selectedCount })}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
