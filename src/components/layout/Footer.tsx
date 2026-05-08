"use client";

import { VERSION } from "@/lib/version";
import { useTranslations } from "next-intl";
import Link from "next/link";

export function Footer() {
  const t = useTranslations("Navigation");

  return (
    <footer className="border-t py-4 bg-gradient-to-b from-slate-50/50 to-white">
      <div className="max-w-4xl mx-auto">
        {/* 免责声明 - 根据当前语言显示 */}
        <div className="mb-3 text-xs text-center text-slate-500 px-4">
          <p>{t("disclaimer")}</p>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-2 text-sm">
          <span className="font-medium text-slate-700">PostWizard</span>
          <span className="text-slate-300">·</span>
          <span className="text-slate-500">{t("slogan")}</span>
          <span className="text-slate-300">·</span>
          <a
            href="https://xhslink.com/m/772qGJ8u1HU"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-100 hover:from-orange-100 hover:to-amber-100 transition-all"
            title="关注小红书"
          >
            <svg
              viewBox="0 0 40 40"
              className="w-3.5 h-3.5"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <rect width="40" height="40" rx="8" fill="#FF2442" />
              <path d="M11 12h4v4h-4z" fill="white" />
              <path d="M18 12h4v4h-4z" fill="white" />
              <path d="M25 12h4v4h-4z" fill="white" />
              <path d="M11 18h2v10h-2z" fill="white" />
              <path d="M15 18h2v10h-2z" fill="white" />
              <path d="M19 18h2v10h-2z" fill="white" />
              <path d="M23 18h2v10h-2z" fill="white" />
              <path d="M27 18h2v10h-2z" fill="white" />
            </svg>
            <span className="text-xs font-medium bg-gradient-to-r from-orange-600 to-amber-600 bg-clip-text text-transparent">
              arthurFsy
            </span>
          </a>
          <span className="text-slate-300">·</span>
          <Link
            href="/about"
            className="text-slate-500 hover:text-orange-600 transition-colors"
          >
            {t("about")}
          </Link>
          <span className="text-slate-300">·</span>
          <Link
            href="/privacy"
            className="text-slate-500 hover:text-orange-600 transition-colors"
          >
            {t("privacy")}
          </Link>
          <span className="text-slate-300">·</span>
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-100">
            <span className="text-xs font-medium text-orange-600">
              {t("buildVersion", { version: VERSION })}
            </span>
          </span>
        </div>
      </div>
    </footer>
  );
}
