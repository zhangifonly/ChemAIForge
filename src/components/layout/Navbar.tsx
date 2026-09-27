import { getTranslations } from "next-intl/server";
import { Link } from "@/lib/i18n/navigation";
import LocaleSwitcher from "./LocaleSwitcher";

// 全局顶部导航：平台已去除登录注册，所有功能对访客开放，无需会话态切换
export default async function Navbar() {
  const t = await getTranslations("nav");
  return (
    // 手机上导航链接与语言按钮会超宽：中文「实验库」三个字放得下，但俄语「Библиотека
    // экспериментов」、葡语「Minhas sessões」加上语言名，60 个语种里 13 个抽样有 11 个
    // 溢出屏幕、整页出现横向滚动。min-w-0 + truncate 让链接在空间不够时截断而不是撑破，
    // 语言按钮在手机上只显示地球图标与语言代码（见 LocaleSwitcher）
    <nav className="sticky top-0 z-40 flex items-center gap-3 whitespace-nowrap border-b border-foreground/10 bg-background/70 px-4 py-3.5 text-sm backdrop-blur-xl sm:gap-6 sm:px-8">
      <Link href="/" className="group -my-1.5 flex shrink-0 items-center gap-2 py-1.5 font-semibold">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-brand-400 to-brand-600 text-base shadow-glow transition-transform group-hover:scale-105">
          ⚗
        </span>
        <span className="hidden bg-gradient-to-r from-brand-600 to-brand-800 bg-clip-text text-transparent min-[420px]:inline dark:from-brand-300 dark:to-brand-200">
          ChemAIForge
        </span>
      </Link>
      <Link
        href="/experiments"
        className="-my-2 min-w-0 truncate py-2 text-foreground/65 transition-colors hover:text-brand-600 dark:hover:text-brand-300"
      >
        {t("catalog")}
      </Link>
      <Link
        href="/sessions"
        className="-my-2 min-w-0 truncate py-2 text-foreground/65 transition-colors hover:text-brand-600 dark:hover:text-brand-300"
      >
        {t("sessions")}
      </Link>
      <LocaleSwitcher />
    </nav>
  );
}
