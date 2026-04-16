import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";
import { Providers } from "@/components/Providers";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// 思源宋体繁体中文（本地字体，用于词云）
const notoSerifTC = localFont({
  src: "../fonts/NotoSerifTC-Bold.woff2",
  variable: "--font-noto-serif-tc",
  weight: "700",
  display: "swap",
});

export const metadata: Metadata = {
  title: "PostWizard AI - 明信片智能收、寄信助手",
  description:
    "AI 帮你分析收件人兴趣，自动生成个性化英文信件。让写明信片变得更简单！",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="zh-CN"
      className={`${geistSans.variable} ${geistMono.variable} ${notoSerifTC.variable} h-full antialiased`}
    >
      <head>
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
      </head>
      <body className="min-h-full flex flex-col">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
