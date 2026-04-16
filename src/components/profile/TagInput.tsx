'use client';

import * as React from 'react';
import { X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

export interface TagInputProps {
  tags: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
  maxTags?: number;
  disabled?: boolean;
  className?: string;
}

export function TagInput({
  tags = [],
  onChange,
  placeholder = '添加标签...',
  maxTags = 20,
  disabled = false,
  className,
}: TagInputProps) {
  const [inputValue, setInputValue] = React.useState('');
  const inputRef = React.useRef<HTMLInputElement>(null);

  const addTag = React.useCallback(
    (tag: string) => {
      const trimmedTag = tag.trim().toLowerCase();
      if (!trimmedTag) return;
      if (tags.includes(trimmedTag)) return;
      if (tags.length >= maxTags) return;

      onChange([...tags, trimmedTag]);
      setInputValue('');
    },
    [tags, onChange, maxTags]
  );

  const removeTag = React.useCallback(
    (tagToRemove: string) => {
      onChange(tags.filter((tag) => tag !== tagToRemove));
    },
    [tags, onChange]
  );

  const handleKeyDown = React.useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter' || e.key === ',') {
        e.preventDefault();
        addTag(inputValue);
      } else if (e.key === 'Backspace' && !inputValue && tags.length > 0) {
        // 按退格键删除最后一个标签
        removeTag(tags[tags.length - 1]);
      }
    },
    [inputValue, tags, addTag, removeTag]
  );

  const handleBlur = React.useCallback(() => {
    if (inputValue.trim()) {
      addTag(inputValue);
    }
  }, [inputValue, addTag]);

  return (
    <div
      className={cn(
        'flex flex-wrap gap-2 rounded-lg border border-input bg-background p-3 min-h-[80px] focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/20 transition-all',
        disabled && 'opacity-50 cursor-not-allowed',
        className
      )}
      onClick={() => inputRef.current?.focus()}
    >
      {tags.map((tag) => (
        <Badge
          key={tag}
          variant="secondary"
          className="gap-1.5 px-2.5 py-1 h-8 text-sm bg-orange-100 text-orange-800 hover:bg-orange-200 dark:bg-orange-900 dark:text-orange-100"
        >
          {tag}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              removeTag(tag);
            }}
            className="flex items-center justify-center w-4 h-4 rounded-full hover:bg-orange-300 transition-colors"
            disabled={disabled}
          >
            <X className="w-3 h-3" />
          </button>
        </Badge>
      ))}
      <Input
        ref={inputRef}
        type="text"
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
        placeholder={tags.length === 0 ? placeholder : ''}
        disabled={disabled}
        className="flex-1 min-w-[120px] h-8 border-0 focus-visible:ring-0 focus-visible:ring-offset-0 px-2 py-1 bg-transparent"
      />
    </div>
  );
}

TagInput.displayName = 'TagInput';
