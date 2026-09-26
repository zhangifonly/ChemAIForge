// locale 感知的导航：Link / redirect / usePathname / useRouter。
//
// 必须用这里的 Link 而不是 next/link：后者的 href="/experiments" 会跳到
// 无前缀路径，被 middleware 按浏览器语言重定向 —— 用户正在看日语页面，
// 点一下链接却可能落回中文。这套包装会自动带上当前 locale。
import { createSharedPathnamesNavigation } from "next-intl/navigation";
import { LOCALE_CODES } from "./locales";

export const { Link, redirect, usePathname, useRouter } =
  createSharedPathnamesNavigation({ locales: LOCALE_CODES });
