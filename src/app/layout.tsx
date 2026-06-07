import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ChemAIForge",
  description: "AI 驱动的化学研究平台",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
