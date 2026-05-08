'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Bookmark, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useCreateTemplate } from '@/hooks/useApi';
import { toast } from 'sonner';

interface SaveTemplateDialogProps {
  content: string;
  defaultName?: string;
  trigger?: React.ReactNode;
}

export function SaveTemplateDialog({
  content,
  defaultName = '',
  trigger,
}: SaveTemplateDialogProps) {
  const t = useTranslations('TemplateSave');
  const [open, setOpen] = useState(false);

  const CATEGORIES = [
    { value: 'general', label: t('categoryGeneral') },
    { value: 'friendly', label: t('categoryFriendly') },
    { value: 'casual', label: t('categoryCasual') },
    { value: 'formal', label: t('categoryFormal') },
    { value: 'humorous', label: t('categoryHumorous') },
    { value: 'poetic', label: t('categoryPoetic') },
  ];
  const [name, setName] = useState(defaultName);
  const [category, setCategory] = useState('general');
  const createTemplate = useCreateTemplate();

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error(t('alertEnterName'));
      return;
    }

    try {
      await createTemplate.mutateAsync({
        name: name.trim(),
        content,
        category,
      });
      toast.success(t('alertSaveSuccess'));
      setOpen(false);
      setName('');
      setCategory('general');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('alertSaveFailed'));
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm">
            <Bookmark className="h-4 w-4 mr-2" />
            {t('triggerLabel')}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{t('title')}</DialogTitle>
          <DialogDescription>
            {t('description')}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="name">{t('name')}</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('namePlaceholder')}
              maxLength={100}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="category">{t('category')}</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger id="category">
                <SelectValue placeholder={t('categoryPlaceholder')} />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((cat) => (
                  <SelectItem key={cat.value} value={cat.value}>
                    {cat.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label>{t('preview')}</Label>
            <div className="max-h-[150px] overflow-y-auto rounded-md border bg-muted p-3 text-sm">
              <pre className="whitespace-pre-wrap font-sans">{content}</pre>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            {t('cancel')}
          </Button>
          <Button onClick={handleSave} disabled={createTemplate.isPending}>
            {createTemplate.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                {t('saving')}
              </>
            ) : (
              t('save')
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
