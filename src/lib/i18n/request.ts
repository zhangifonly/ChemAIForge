// next-intl 的服务端配置：按请求的 locale 装载对应词条。
//
// 词条按 locale 存成独立 JSON（messages/<locale>.json），而不是一个大文件里
// 分语言分支 —— 用户只会看一种语言，没有理由把 60 份译文都送到浏览器。
import type { AbstractIntlMessages } from "next-intl";
import { getRequestConfig } from "next-intl/server";
import { isLocale, SOURCE_LOCALE } from "./locales";

/**
 * 装载某个 locale 的词条，缺失的键回退到源语言。
 *
 * 回退必须做深合并而不是整份替换：basic 语种只译了界面文案，
 * 实验内容那部分键根本不存在，整份替换会让它们直接显示 key。
 */
async function loadMessages(locale: string): Promise<AbstractIntlMessages> {
  const base = (await import(`../../../messages/${SOURCE_LOCALE}.json`)).default;
  if (locale === SOURCE_LOCALE) return base;
  // 缺译的键先借道英语、再回退中文：一个阿尔巴尼亚语用户碰到漏译，
  // 看到英文远比看到汉字有用。与实验内容层（content.ts）的回退链一致。
  let bridge: AbstractIntlMessages = base;
  try {
    bridge = deepMerge(base, (await import(`../../../messages/en.json`)).default);
  } catch {
    /* 英文词条缺失时直接用中文 */
  }
  if (locale === "en") return bridge;
  try {
    const target = (await import(`../../../messages/${locale}.json`)).default;
    return deepMerge(bridge, target);
  } catch {
    // 译文文件还没生成（新加语种、或翻译脚本没跑完）时退回英语，
    // 而不是让整页 500 —— 缺译文是内容问题，不该表现为服务崩溃
    return bridge;
  }
}

/** 深合并：target 的键覆盖 base，target 缺的键保留 base 的值 */
function deepMerge(
  base: AbstractIntlMessages,
  target: AbstractIntlMessages,
): AbstractIntlMessages {
  const out: AbstractIntlMessages = { ...base };
  for (const [k, v] of Object.entries(target)) {
    const b = out[k];
    if (isPlainObject(b) && isPlainObject(v)) {
      out[k] = deepMerge(b, v);
    } else if (v !== "" && v !== null && v !== undefined) {
      // 空字符串视为"未翻译"而非"译成空" —— 翻译工具常留空占位，
      // 采信它会让界面出现空白按钮
      out[k] = v;
    }
  }
  return out;
}

function isPlainObject(v: unknown): v is AbstractIntlMessages {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

export default getRequestConfig(async ({ requestLocale }) => {
  // requestLocale 取代旧的 locale 参数（next-intl 3.22 起）：
  // 它是个 Promise，且在静态渲染时可能为空，故需自行兜底
  const requested = await requestLocale;
  const resolved = requested && isLocale(requested) ? requested : SOURCE_LOCALE;
  return {
    locale: resolved,
    messages: await loadMessages(resolved),
    // 时区与数字格式跟随语言的通行习惯，由 Intl 自行处理；
    // 这里不写死时区 —— 会话时间应按访问者所在地显示
  };
});
