"use client";

import { FolderOpen, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface FolderSelectorProps {
  /** 当前选中的文件夹路径 */
  value: string;
  /** 可用文件夹列表 */
  folders: string[];
  /** 是否正在加载文件夹列表 */
  isLoading?: boolean;
  /** 文件夹路径变化时触发 */
  onChange: (path: string) => void;
  /** 刷新文件夹列表 */
  onRefresh: () => void;
  /** 提示内容（可选，默认提供默认提示语） */
  hint?: React.ReactNode;
  /** 额外类名 */
  className?: string;
}

export function FolderSelector({
  value,
  folders,
  isLoading = false,
  onChange,
  onRefresh,
  hint,
  className = "",
}: FolderSelectorProps) {
  const defaultHint =
    folders.length > 0
      ? `已获取 ${folders.length} 个文件夹，系统会自动记住您的选择`
      : '点击"获取文件夹"查看可用选项，或手动输入文件夹路径';

  return (
    <div className={`space-y-2 ${className}`}>
      <div className="flex items-center justify-between">
        <Label className="text-slate-700">文件夹路径</Label>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onRefresh}
          disabled={isLoading}
          className="h-7 px-2 text-xs text-orange-600 hover:text-orange-700 hover:bg-orange-50"
        >
          {isLoading ? (
            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
          ) : (
            <RefreshCw className="h-3 w-3 mr-1" />
          )}
          获取文件夹
        </Button>
      </div>

      {folders.length > 0 ? (
        <Select value={value} onValueChange={onChange}>
          <SelectTrigger className="h-10 border-gray-200 focus:border-orange-400 focus:ring-orange-400/20">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="max-h-[300px] bg-white border border-gray-200 shadow-lg">
            <SelectItem value="__default__">
              <span className="text-gray-400">使用默认（INBOX）</span>
            </SelectItem>
            {folders.map((folder) => (
              <SelectItem key={folder} value={folder}>
                <div className="flex items-center gap-2">
                  <FolderOpen className="h-3.5 w-3.5 text-gray-400" />
                  <span>{folder}</span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : (
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="INBOX"
          className="h-10 border-gray-200 focus:border-orange-400 focus:ring-orange-400/20"
        />
      )}

      {hint ? (
        <div>{hint}</div>
      ) : (
        <p className="text-xs text-slate-500">{defaultHint}</p>
      )}
    </div>
  );
}
