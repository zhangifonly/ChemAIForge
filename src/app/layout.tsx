import type { Metadata } from "next";
import Link from "next/link";
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
      <body>
        <nav className="flex items-center gap-6 border-b border-foreground/10 px-8 py-4 text-sm">
          <Link href="/" className="font-semibold">
            ChemAIForge
          </Link>
          <Link href="/experiments" className="text-foreground/70 hover:text-foreground">
            实验库
          </Link>
        </nav>
        {children}
      </body>
    </html>
  );
}
