import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import localFont from "next/font/local";
import "../globals.css";
import { Providers } from "@/components/Providers";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const notoSerifTC = localFont({
  src: "../../fonts/NotoSerifTC-Bold.woff2",
  variable: "--font-noto-serif-tc",
  weight: "700",
  display: "swap",
});

export const metadata: Metadata = {
  title: "PostWizard - 明信片收寄信助手",
  description:
    "帮你分析收件人兴趣，自动生成个性化英文信件。让写明信片变得更简单！",
};

import { NextIntlClientProvider } from 'next-intl';

export default async function RootLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { locale: string };
}) {
  const { locale } = await params;
  // 直接根据 params locale 加载 messages，不依赖 getMessages() 的请求上下文
  const messages = (await import(`../../../messages/${locale}.json`)).default;

  return (
    <html
      lang={locale}
      className={`${geistSans.variable} ${geistMono.variable} ${notoSerifTC.variable} h-full antialiased`}
    >
      <head>
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
      </head>
      <body className="min-h-full flex flex-col">
        <NextIntlClientProvider locale={locale} messages={messages}>
          <Providers>{children}</Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
