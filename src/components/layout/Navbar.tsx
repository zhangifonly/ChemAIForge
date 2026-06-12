import Link from "next/link";

// 全局顶部导航：平台已去除登录注册，所有功能对访客开放，无需会话态切换
export default function Navbar() {
  return (
    <nav className="sticky top-0 z-40 flex items-center gap-6 border-b border-foreground/10 bg-background/70 px-6 py-3.5 text-sm backdrop-blur-xl sm:px-8">
      <Link href="/" className="group flex items-center gap-2 font-semibold">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-brand-400 to-brand-600 text-base shadow-glow transition-transform group-hover:scale-105">
          ⚗
        </span>
        <span className="bg-gradient-to-r from-brand-600 to-brand-800 bg-clip-text text-transparent dark:from-brand-300 dark:to-brand-200">
          ChemAIForge
        </span>
      </Link>
      <Link
        href="/experiments"
        className="text-foreground/65 transition-colors hover:text-brand-600 dark:hover:text-brand-300"
      >
        实验库
      </Link>
      <Link
        href="/sessions"
        className="text-foreground/65 transition-colors hover:text-brand-600 dark:hover:text-brand-300"
      >
        我的会话
      </Link>
    </nav>
  );
}
