// 语言路由：把 /experiments 这类无前缀路径按访问者语言重定向到 /<locale>/...
//
// 用 URL 前缀而不是只存 Cookie：同一个网址在不同人那里显示不同语言，
// 搜索引擎只能收录一种，用户也无法分享"某个语言版本"的链接。
// 前缀方案下每个语种的页面可被独立收录，链接自带语言。
import createMiddleware from "next-intl/middleware";
import { LOCALE_CODES, SOURCE_LOCALE } from "@/lib/i18n/locales";

export default createMiddleware({
  locales: LOCALE_CODES,
  defaultLocale: SOURCE_LOCALE,
  // always：源语言也带前缀（/zh/experiments）。
  // 若让中文走无前缀的根路径，则"根路径"与"/zh"是两个 URL、同一份内容，
  // 搜索引擎视作重复内容，站内链接也要分两种写法。统一带前缀更简单。
  localePrefix: "always",
  // 按 Accept-Language 协商首访语言，并把选择写入 cookie
  localeDetection: true,
  // 不在响应头里发语言互链（Link: rel="alternate" hreflang）。
  // 60 个语种的互链是一条 5.7 KB 的响应头，超过 nginx 默认 4 KB 的代理头缓冲，
  // 线上全站因此 502（upstream sent too big header）—— 本地直连 4300 端口一切正常，
  // 只有经过 nginx 才暴露。hreflang 对 SEO 仍有用，改由页面 <head> 里的
  // <link rel="alternate"> 输出（见 [locale]/layout.tsx 的 generateMetadata），那里没有长度限制。
  alternateLinks: false,
});

export const config = {
  // 排除 API、静态资源与音频：它们与界面语言无关，
  // 尤其音频路径由 audioSrc 直接拼出，被重定向会 404
  matcher: ["/((?!api|_next|audio|favicon.ico|.*\\..*).*)"],
};
