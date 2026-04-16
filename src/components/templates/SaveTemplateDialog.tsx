'use client';

import { useState } from 'react';
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

const CATEGORIES = [
  { value: 'general', label: '通用' },
  { value: 'friendly', label: '友好热情' },
  { value: 'casual', label: '轻松随意' },
  { value: 'formal', label: '正式礼貌' },
  { value: 'humorous', label: '幽默风趣' },
  { value: 'poetic', label: '文艺诗意' },
];

export function SaveTemplateDialog({
  content,
  defaultName = '',
  trigger,
}: SaveTemplateDialogProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(defaultName);
  const [category, setCategory] = useState('general');
  const createTemplate = useCreateTemplate();

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error('请输入模板名称');
      return;
    }

    try {
      await createTemplate.mutateAsync({
        name: name.trim(),
        content,
        category,
      });
      toast.success('模板保存成功！');
      setOpen(false);
      setName('');
      setCategory('general');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '保存失败');
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm">
            <Bookmark className="h-4 w-4 mr-2" />
            保存为模板
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>保存为模板</DialogTitle>
          <DialogDescription>
            将当前内容保存为模板，方便以后快速使用。
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="name">模板名称</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例如：给日本朋友的友好问候"
              maxLength={100}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="category">分类</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger id="category">
                <SelectValue placeholder="选择分类" />
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
            <Label>内容预览</Label>
            <div className="max-h-[150px] overflow-y-auto rounded-md border bg-muted p-3 text-sm">
              <pre className="whitespace-pre-wrap font-sans">{content}</pre>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            取消
          </Button>
          <Button onClick={handleSave} disabled={createTemplate.isPending}>
            {createTemplate.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                保存中...
              </>
            ) : (
              '保存'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
