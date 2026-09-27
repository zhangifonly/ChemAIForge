import type { Metadata } from "next";
import { Outfit } from "next/font/google";
import { notFound } from "next/navigation";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations } from "next-intl/server";
import Navbar from "@/components/layout/Navbar";
import { isLocale, localeMeta, LOCALE_CODES, SOURCE_LOCALE } from "@/lib/i18n/locales";
import "../globals.css";

// 西文 / 数字主字体：Outfit 有几何感与多字重，用作显示与数据；
// 各语言的正文走系统字体栈（见 globals.css 的 --font-sans），
// 这样日文假名、韩文谚文、阿拉伯文都由系统给出本地最佳字形，
// 不必为 60 个语种各打包一套 webfont。
const outfit = Outfit({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-outfit",
  display: "swap",
});

// 语言层布局：决定 <html lang> 与文字方向，并把词条交给客户端组件。
//
// html 标签放在这一层而不是根 layout：lang 与 dir 必须随语言变 ——
// lang 影响屏幕阅读器的发音与浏览器的断词换行，dir 决定整页排版方向，
// 阿拉伯语、波斯语、乌尔都语从右向左，写死 zh-CN 这两件事都是错的。

/**
 * 不预生成静态页面。
 *
 * 60 个语种 × 现有页面全部静态预渲染，收益很低而代价明确：实验详情页与实验台
 * 本来就是按需渲染（数据来自数据库），会话报告页更是每次都不同；
 * 而 next-intl 在服务端组件里取词条会读 headers，与静态渲染冲突。
 * 与其为每个页面补 setRequestLocale，不如承认这些页面本质是动态的。
 */
export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: { locale: string };
}): Promise<Metadata> {
  const t = await getTranslations({ locale: params.locale, namespace: "site" });
  // 语言互链放 <head> 而不是响应头：60 条互链在响应头里超过 nginx 的代理头缓冲、
  // 导致全站 502（见 middleware.ts 的 alternateLinks 说明）。
  // 这里只给出各语种首页；深层页面的逐页互链收益小，不值得在每个页面里再算一遍路径
  const languages = Object.fromEntries(LOCALE_CODES.map((l) => [l, `/${l}`]));
  return {
    title: t("title"),
    description: t("description"),
    alternates: { languages: { ...languages, "x-default": `/${SOURCE_LOCALE}` } },
  };
}

export default async function LocaleLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params: { locale: string };
}>) {
  // 未知语言直接 404，而不是静默回退：/xx/experiments 这种地址
  // 若渲染成中文页面，用户与搜索引擎都无从知道这个语言并不存在
  if (!isLocale(params.locale)) notFound();
  const { dir } = localeMeta(params.locale);
  const messages = await getMessages();
  const t = await getTranslations("a11y");

  return (
    <html lang={params.locale} dir={dir} className={outfit.variable} suppressHydrationWarning>
      <body>
        <NextIntlClientProvider messages={messages}>
          <a
            href="#main"
            className="sr-only focus:not-sr-only focus:absolute focus:start-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-brand-600 focus:px-4 focus:py-2 focus:text-white"
          >
            {t("skipToMain")}
          </a>
          <Navbar />
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
