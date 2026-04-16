"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useTypewriter } from "@/hooks/useTypewriter";
import {
  Send,
  Bot,
  User,
  Sparkles,
  Save,
  Loader2,
  MessageSquare,
  CheckCircle2,
  AlertCircle,
  SkipForward,
} from "lucide-react";

// 素材分类配置
const MATERIAL_CATEGORIES = [
  { id: "self_intro", name: "自我介绍", icon: "👤", color: "bg-blue-500" },
  { id: "hobbies", name: "兴趣爱好", icon: "🎨", color: "bg-purple-500" },
  { id: "hometown", name: "家乡介绍", icon: "🏠", color: "bg-green-500" },
  {
    id: "travel_stories",
    name: "旅行故事",
    icon: "✈️",
    color: "bg-orange-500",
  },
  { id: "fun_facts", name: "有趣故事", icon: "🎭", color: "bg-pink-500" },
];

// 消息类型
interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  isStreaming?: boolean;
}

// 收集的信息类型
interface CollectedInfo {
  self_intro?: string;
  hobbies?: string;
  hometown?: string;
  travel_stories?: string;
  fun_facts?: string;
}

// 对话上下文
interface ConversationContext {
  currentQuestion: string;
  collectedInfo: CollectedInfo;
  confidence: number;
  missingCategories: string[];
}

interface ConversationChatProps {
  token: string;
  initialMaterials?: Record<string, string>;
  onSave?: (materials: Record<string, string>) => void;
}

export function ConversationChat({
  token,
  initialMaterials = {},
  onSave,
}: ConversationChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [collectedInfo, setCollectedInfo] = useState<CollectedInfo>({});
  const [confidence, setConfidence] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // 初始化：如果有已有素材，显示欢迎消息
  useEffect(() => {
    if (Object.keys(initialMaterials).length > 0) {
      setCollectedInfo(initialMaterials as CollectedInfo);
      const filledCount = Object.values(initialMaterials).filter((v) =>
        v?.trim(),
      ).length;
      setConfidence(Math.min(filledCount * 20, 100));
    }

    // 添加初始欢迎消息
    const welcomeMessage: Message = {
      id: "welcome",
      role: "assistant",
      content: `你好！我是你的明信片收、寄信助手 ✉️\n\n为了更好地帮你写明信片，我想了解一些关于你的事情。\n\n让我们从简单的问题开始：\n\n**Q1: 如果让你用一句话介绍自己，你会怎么说？**\n\n比如："我是一名在深圳工作的软件工程师，喜欢周末去公园拍照。"`,
      timestamp: new Date(),
    };
    setMessages([welcomeMessage]);
  }, [initialMaterials]);

  // 自动滚动到底部
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // 自动调整输入框高度
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height =
        textareaRef.current.scrollHeight + "px";
    }
  }, [input]);

  // 发送消息
  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    // 创建临时的AI消息（用于流式显示）
    const aiMessageId = (Date.now() + 1).toString();
    const aiMessage: Message = {
      id: aiMessageId,
      role: "assistant",
      content: "",
      timestamp: new Date(),
      isStreaming: true,
    };
    setMessages((prev) => [...prev, aiMessage]);

    try {
      const response = await fetch("/api/materials/conversation", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          message: userMessage.content,
          context: {
            currentQuestion:
              messages.length > 0 ? messages[messages.length - 1].content : "",
            collectedInfo,
            confidence,
            missingCategories: getMissingCategories(collectedInfo),
          },
        }),
      });

      if (!response.ok) {
        throw new Error("请求失败");
      }

      const data = await response.json();

      // 设置打字机效果的完整文本
      setLastAiMessage(data.aiReply);
      setTypingComplete(false);

      // 更新AI消息（先显示空内容，打字机效果会填充）
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === aiMessageId
            ? {
                ...msg,
                content: data.aiReply,
                isStreaming: true,
              }
            : msg,
        ),
      );

      // 更新收集的信息
      if (data.extractedInfo) {
        setCollectedInfo((prev) => ({
          ...prev,
          ...data.extractedInfo,
        }));
      }

      // 更新置信度
      if (data.confidence !== undefined) {
        setConfidence(data.confidence);
      }
    } catch (error) {
      // console.error('对话请求失败:', error);
      const errorMessage = "抱歉，我遇到了一些问题。请稍后再试。";
      setLastAiMessage(errorMessage);
      setTypingComplete(false);
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === aiMessageId
            ? {
                ...msg,
                content: errorMessage,
                isStreaming: true,
              }
            : msg,
        ),
      );
    } finally {
      setIsLoading(false);
    }
  };

  // 获取缺失的分类
  const getMissingCategories = (info: CollectedInfo): string[] => {
    return MATERIAL_CATEGORIES.filter(
      (cat) => !info[cat.id as keyof CollectedInfo]?.trim(),
    ).map((cat) => cat.id);
  };

  // 保存素材
  const handleSave = async () => {
    if (!token) return;

    setIsSaving(true);
    try {
      // 逐个保存每个分类
      for (const category of MATERIAL_CATEGORIES) {
        const content = collectedInfo[category.id as keyof CollectedInfo] || "";
        await fetch("/api/content/materials", {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ category: category.id, content }),
        });
      }

      if (onSave) {
        onSave(collectedInfo as Record<string, string>);
      }

      // 添加保存成功的消息
      const successMessage: Message = {
        id: Date.now().toString(),
        role: "assistant",
        content: "✅ 素材保存成功！你的个人画像已更新。",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, successMessage]);
    } catch (error) {
      // console.error('保存失败:', error);
      alert("保存失败，请重试");
    } finally {
      setIsSaving(false);
    }
  };

  // 计算完成度
  const completionRate = Math.round(
    (MATERIAL_CATEGORIES.filter((cat) =>
      collectedInfo[cat.id as keyof CollectedInfo]?.trim(),
    ).length /
      MATERIAL_CATEGORIES.length) *
      100,
  );

  // 存储最后一条AI消息的完整内容，用于打字机效果
  const [lastAiMessage, setLastAiMessage] = useState<string>("");
  const [typingComplete, setTypingComplete] = useState(false);

  const { displayedText, isTyping, skip } = useTypewriter({
    text: lastAiMessage,
    speed: 25,
    enabled: !!lastAiMessage && !typingComplete,
    onComplete: () => {
      setTypingComplete(true);
      // 打字完成后，更新消息状态
      setMessages((prev) =>
        prev.map((msg) =>
          msg.role === "assistant" && msg.isStreaming
            ? { ...msg, isStreaming: false }
            : msg,
        ),
      );
    },
  });

  // 处理键盘事件
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-3 h-full">
      {/* 左侧：对话区域 */}
      <div className="lg:col-span-2 space-y-4 h-full">
        <Card className="border-0 shadow-xl shadow-slate-200/50 h-full flex flex-col">
          <CardHeader className="border-b bg-gradient-to-r from-orange-50 to-amber-50">
            <CardTitle className="flex items-center gap-2 text-lg">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center">
                <Bot className="h-4 w-4 text-white" />
              </div>
              <span className="bg-gradient-to-r from-orange-600 to-amber-600 bg-clip-text text-transparent">
                AI 对话助手
              </span>
              <Badge variant="secondary" className="ml-auto">
                <Sparkles className="h-3 w-3 mr-1" />
                智能引导
              </Badge>
            </CardTitle>
          </CardHeader>

          {/* 消息列表 */}
          <ScrollArea className="flex-1 p-4" ref={scrollRef}>
            <div className="space-y-4">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex gap-3 ${message.role === "user" ? "flex-row-reverse" : ""}`}
                >
                  {/* 头像 */}
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                      message.role === "user"
                        ? "bg-gradient-to-br from-blue-500 to-indigo-500"
                        : "bg-gradient-to-br from-orange-500 to-amber-500"
                    }`}
                  >
                    {message.role === "user" ? (
                      <User className="h-4 w-4 text-white" />
                    ) : (
                      <Bot className="h-4 w-4 text-white" />
                    )}
                  </div>

                  {/* 消息内容 */}
                  <div
                    className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm ${
                      message.role === "user"
                        ? "bg-gradient-to-br from-blue-500 to-indigo-500 text-white"
                        : "bg-slate-100 text-slate-800"
                    }`}
                  >
                    {message.role === "assistant" && message.isStreaming ? (
                      <div className="relative">
                        <div className="whitespace-pre-wrap">
                          {displayedText}
                          {isTyping && (
                            <span className="inline-block w-2 h-4 ml-0.5 bg-current animate-pulse" />
                          )}
                        </div>
                        {isTyping && (
                          <button
                            onClick={skip}
                            className="absolute -bottom-6 right-0 text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1"
                          >
                            <SkipForward className="h-3 w-3" />
                            跳过
                          </button>
                        )}
                      </div>
                    ) : (
                      <div className="whitespace-pre-wrap">
                        {message.content}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>

          {/* 输入区域 */}
          <CardContent className="border-t p-4">
            <div className="flex gap-2">
              <Textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="输入你的回答...（按 Enter 发送，Shift+Enter 换行）"
                className="min-h-[60px] max-h-[150px] resize-none rounded-xl border-slate-200 focus:border-orange-500 focus:ring-orange-200"
                disabled={isLoading}
              />
              <Button
                onClick={handleSend}
                disabled={!input.trim() || isLoading}
                className="self-end h-[60px] px-4 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white rounded-xl shadow-lg shadow-orange-200"
              >
                {isLoading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Send className="h-5 w-5" />
                )}
              </Button>
            </div>
            <p className="text-xs text-slate-400 mt-2 text-center">
              AI 助手会根据你的回答自动提取信息并归类
            </p>
          </CardContent>
        </Card>
      </div>

      {/* 右侧：已收集信息 */}
      <div className="space-y-4">
        {/* 完成度卡片 */}
        <Card className="border-0 shadow-lg shadow-slate-200/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-emerald-500" />
              素材完善度
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600">完成进度</span>
                <span className="text-lg font-bold text-orange-600">
                  {completionRate}%
                </span>
              </div>
              <Progress value={completionRate} className="h-2" />
              <p className="text-xs text-slate-500">
                已收集{" "}
                {
                  MATERIAL_CATEGORIES.filter((cat) =>
                    collectedInfo[cat.id as keyof CollectedInfo]?.trim(),
                  ).length
                }{" "}
                / {MATERIAL_CATEGORIES.length} 个分类
              </p>
            </div>
          </CardContent>
        </Card>

        {/* 已收集信息卡片 */}
        <Card className="border-0 shadow-lg shadow-slate-200/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-blue-500" />
              已收集信息
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {MATERIAL_CATEGORIES.map((category) => {
                const content =
                  collectedInfo[category.id as keyof CollectedInfo];
                const hasContent = content?.trim();

                return (
                  <div
                    key={category.id}
                    className={`p-3 rounded-xl transition-all ${
                      hasContent
                        ? "bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-100"
                        : "bg-slate-50 border border-slate-100"
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-lg">{category.icon}</span>
                      <span
                        className={`text-sm font-medium ${hasContent ? "text-emerald-700" : "text-slate-500"}`}
                      >
                        {category.name}
                      </span>
                      {hasContent ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-500 ml-auto" />
                      ) : (
                        <AlertCircle className="h-4 w-4 text-slate-300 ml-auto" />
                      )}
                    </div>
                    {hasContent ? (
                      <p className="text-xs text-slate-600 line-clamp-3">
                        {content}
                      </p>
                    ) : (
                      <p className="text-xs text-slate-400 italic">待收集...</p>
                    )}
                  </div>
                );
              })}
            </div>

            {/* 保存按钮 */}
            <Button
              onClick={handleSave}
              disabled={isSaving || completionRate === 0}
              className="w-full mt-4 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white shadow-lg shadow-orange-200 rounded-xl"
            >
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  保存中...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  保存素材
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
