import type { Metadata } from "next";
import { Outfit } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/layout/Navbar";

// 西文 / 数字主字体：Outfit 有几何感与多字重，用作显示与数据；
// 中文走系统优质字体栈（见 globals.css 的 --font-sans）。
const outfit = Outfit({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-outfit",
  display: "swap",
});

export const metadata: Metadata = {
  title: "ChemAIForge · AI 虚拟化学实验室",
  description:
    "在浏览器里做化学实验：拖拽试剂、观察反应、获取 AI 导师指导，自动生成实验报告。",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className={outfit.variable}>
      <body>
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-brand-600 focus:px-4 focus:py-2 focus:text-white"
        >
          跳到主内容
        </a>
        <Navbar />
        {children}
      </body>
    </html>
  );
}
