"use client";

import { usePathname, useRouter, Link } from "@/i18n/routing";
import { useLocale, useTranslations } from "next-intl";
import {
  Clipboard,
  Mail,
  History,
  Inbox,
  Download,
  Send,
  ChevronDown,
  X,
  Menu,
  Settings,
  Upload,
  Languages,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useState, useRef, useEffect } from "react";

export function Header() {
  const t = useTranslations("Navigation");
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sendDropdownOpen, setSendDropdownOpen] = useState(false);
  const [receiveDropdownOpen, setReceiveDropdownOpen] = useState(false);
  const sendDropdownRef = useRef<HTMLDivElement>(null);
  const receiveDropdownRef = useRef<HTMLDivElement>(null);

  const sendMailNav = [
    { name: t("pasteParse"), href: "/sent/parse", icon: Clipboard },
    { name: t("emailParse"), href: "/sent/email-parse", icon: Mail },
    { name: t("sendReply"), href: "/sent/reply", icon: Send },
    { name: t("sendHistory"), href: "/sent/history", icon: History },
  ];

  const receiveMailNav = [
    { name: t("uploadRecognize"), href: "/received/upload", icon: Download },
    { name: t("batchUpload"), href: "/received/batch", icon: Upload },
    { name: t("receiveHistory"), href: "/received/history", icon: Inbox },
  ];

  // 点击外部关闭下拉菜单
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        sendDropdownRef.current &&
        !sendDropdownRef.current.contains(event.target as Node)
      ) {
        setSendDropdownOpen(false);
      }
      if (
        receiveDropdownRef.current &&
        !receiveDropdownRef.current.contains(event.target as Node)
      ) {
        setReceiveDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const switchLocale = () => {
    const nextLocale = locale === "en" ? "zh" : "en";
    router.replace(pathname, { locale: nextLocale });
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-white shadow-sm supports-[backdrop-filter]:bg-white">
      <div className="container flex h-16 items-center justify-between">
        <div className="flex items-center pl-4 sm:pl-6">
          <Link href="/" className="mr-6 flex items-center space-x-2 group">
            <div className="w-8 h-8 bg-orange-500 rounded-lg flex items-center justify-center shadow-md group-hover:shadow-lg transition-warm">
              <Mail className="h-4 w-4 text-white" />
            </div>
            <span className="font-bold text-lg hidden sm:inline">
              PostWizard
            </span>
          </Link>

          {/* 桌面端导航 */}
          <nav className="hidden lg:flex items-center space-x-1 text-sm font-medium">
            {/* 寄信下拉菜单 */}
            <div className="relative" ref={sendDropdownRef}>
              <button
                onClick={() => setSendDropdownOpen(!sendDropdownOpen)}
                className={cn(
                  "flex items-center space-x-1 px-3 py-2 rounded-lg transition-all",
                  sendDropdownOpen || pathname.startsWith("/sent")
                    ? "bg-orange-100 text-orange-700"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted",
                )}
              >
                <Send className="h-4 w-4" />
                <span>{t("send")}</span>
                <ChevronDown
                  className={cn(
                    "h-3 w-3 transition-transform",
                    sendDropdownOpen && "rotate-180",
                  )}
                />
              </button>
              {sendDropdownOpen && (
                <div className="absolute top-full left-0 mt-1 w-48 bg-white rounded-xl border shadow-lg py-2 z-50">
                  {sendMailNav.map((item) => {
                    const Icon = item.icon;
                    const isActive = pathname === item.href;
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setSendDropdownOpen(false)}
                        className={cn(
                          "flex items-center gap-3 px-4 py-2.5 text-sm transition-colors",
                          isActive
                            ? "bg-orange-50 text-orange-700"
                            : "text-muted-foreground hover:bg-muted hover:text-foreground",
                        )}
                      >
                        <Icon className="h-4 w-4" />
                        <span>{item.name}</span>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>

            {/* 收信下拉菜单 */}
            <div className="relative" ref={receiveDropdownRef}>
              <button
                onClick={() => setReceiveDropdownOpen(!receiveDropdownOpen)}
                className={cn(
                  "flex items-center space-x-1 px-3 py-2 rounded-lg transition-all",
                  receiveDropdownOpen || pathname.startsWith("/received")
                    ? "bg-orange-100 text-orange-700"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted",
                )}
              >
                <Download className="h-4 w-4" />
                <span>{t("receive")}</span>
                <ChevronDown
                  className={cn(
                    "h-3 w-3 transition-transform",
                    receiveDropdownOpen && "rotate-180",
                  )}
                />
              </button>
              {receiveDropdownOpen && (
                <div className="absolute top-full left-0 mt-1 w-48 bg-white rounded-xl border shadow-lg py-2 z-50">
                  {receiveMailNav.map((item) => {
                    const Icon = item.icon;
                    const isActive = pathname === item.href;
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setReceiveDropdownOpen(false)}
                        className={cn(
                          "flex items-center gap-3 px-4 py-2.5 text-sm transition-colors",
                          isActive
                            ? "bg-orange-50 text-orange-700"
                            : "text-muted-foreground hover:bg-muted hover:text-foreground",
                        )}
                      >
                        <Icon className="h-4 w-4" />
                        <span>{item.name}</span>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>

            {/* 个人要素 */}
            <Link
              href="/profile"
              className={cn(
                "flex items-center space-x-1 px-3 py-2 rounded-lg transition-all",
                pathname === "/profile"
                  ? "bg-orange-100 text-orange-700"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted",
              )}
            >
              <Inbox className="h-4 w-4" />
              <span>{t("profile")}</span>
            </Link>

            {/* 设置 */}
            <Link
              href="/settings"
              className={cn(
                "flex items-center space-x-1 px-3 py-2 rounded-lg transition-all",
                pathname === "/settings"
                  ? "bg-orange-100 text-orange-700"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted",
              )}
            >
              <Settings className="h-4 w-4" />
              <span>{t("settings")}</span>
            </Link>
          </nav>
        </div>

        <div className="flex items-center gap-3">
          {/* 语言切换 */}
          <button
            onClick={switchLocale}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-all border border-transparent hover:border-border"
            aria-label="Switch language"
          >
            <Languages className="h-4 w-4" />
            <span>{locale === "en" ? "中文" : "English"}</span>
          </button>

          {/* 移动端汉堡菜单按钮 */}
          <button
            className="lg:hidden p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-all"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? (
              <X className="h-5 w-5" />
            ) : (
              <Menu className="h-5 w-5" />
            )}
          </button>
        </div>
      </div>

      {/* 移动端展开菜单 */}
      {mobileMenuOpen && (
        <div className="lg:hidden border-t bg-white shadow-lg">
          <nav className="container py-3 flex flex-col space-y-1">
            {/* 寄信流程分组 */}
            <div className="px-3 py-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                <Send className="h-3 w-3" />
                {t("sendProcess")}
              </div>
              <div className="space-y-1">
                {sendMailNav.map((item) => {
                  const Icon = item.icon;
                  const isActive = pathname === item.href;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMobileMenuOpen(false)}
                      className={cn(
                        "flex items-center gap-3 px-4 py-3 rounded-lg transition-all text-sm font-medium",
                        isActive
                          ? "bg-orange-100 text-orange-700"
                          : "text-muted-foreground hover:text-foreground hover:bg-muted",
                      )}
                    >
                      <Icon className="h-4 w-4" />
                      <span>{item.name}</span>
                    </Link>
                  );
                })}
              </div>
            </div>

            <div className="border-t my-2" />

            {/* 收信流程分组 */}
            <div className="px-3 py-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                <Download className="h-3 w-3" />
                {t("receiveProcess")}
              </div>
              <div className="space-y-1">
                {receiveMailNav.map((item) => {
                  const Icon = item.icon;
                  const isActive = pathname === item.href;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMobileMenuOpen(false)}
                      className={cn(
                        "flex items-center gap-3 px-4 py-3 rounded-lg transition-all text-sm font-medium",
                        isActive
                          ? "bg-orange-100 text-orange-700"
                          : "text-muted-foreground hover:text-foreground hover:bg-muted",
                      )}
                    >
                      <Icon className="h-4 w-4" />
                      <span>{item.name}</span>
                    </Link>
                  );
                })}
              </div>
            </div>

            <div className="border-t my-2" />

            {/* 其他 */}
            <div className="px-3 py-2 space-y-1">
              <Link
                href="/profile"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-3 px-4 py-3 rounded-lg transition-all text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted"
              >
                <Inbox className="h-4 w-4" />
                <span>{t("profile")}</span>
              </Link>
              <Link
                href="/settings"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-3 px-4 py-3 rounded-lg transition-all text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted"
              >
                <Settings className="h-4 w-4" />
                <span>{t("settings")}</span>
              </Link>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
