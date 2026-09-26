// 支持的界面语言清单。
//
// 语种口径取 OpenAI ChatGPT 的界面语言集合（英语 + 59 种），
// 见 https://help.openai.com/en/articles/6825453 —— 选它是因为这套集合
// 已经过大规模产品验证：覆盖面足够广，又不像"ISO 639 全表"那样铺进
// 没有真实用户的语种。
//
// `tier` 区分投入程度，而不是"支持与否"：
//   full  —— 实验内容与讲解文案全部预翻译，语音走 edge-tts 预生成的高音质 mp3
//   basic —— 界面文案预翻译；实验内容回退英语，语音走浏览器内置合成
// 把某个语种从 basic 提到 full，只需跑翻译与 TTS 脚本，不改代码。

/** 文字方向。阿拉伯语、波斯语、乌尔都语从右向左排版 */
export type TextDirection = "ltr" | "rtl";

/** 投入程度，见文件头说明 */
export type LocaleTier = "full" | "basic";

export interface LocaleMeta {
  /** BCP 47 语言标签，同时是 URL 前缀（/en/experiments） */
  code: string;
  /** 该语言自己的名字，语言切换器里就该这么显示 —— 一个只看得懂日语的用户
   *  在列表里找的是「日本語」而不是「Japanese」 */
  nativeName: string;
  /** 英文名，供开发者与日志使用 */
  englishName: string;
  dir: TextDirection;
  tier: LocaleTier;
}

/** 源语言：所有译文以它为准，缺失译文时的最终回退 */
export const SOURCE_LOCALE = "zh";

/**
 * 首批全量投入的语种。
 *
 * 取「使用人数 × 中学化学教育普及度」靠前的语言，并覆盖全部主要文字系统
 * （汉字、假名、谚文、拉丁、西里尔、阿拉伯），好让 RTL 与非拉丁排版的问题
 * 在第一批就暴露出来，而不是等铺到第 40 个语种才发现布局塌了。
 */
export const FULL_LOCALES = [
  "zh",
  "en",
  "ja",
  "ko",
  "es",
  "fr",
  "de",
  "ru",
  "ar",
] as const;

// tier 由 FULL_LOCALES 决定，不在每条里重复写 —— 两处各写一遍迟早对不上
function meta(
  code: string,
  nativeName: string,
  englishName: string,
  dir: TextDirection = "ltr",
): LocaleMeta {
  const tier: LocaleTier = (FULL_LOCALES as readonly string[]).includes(code)
    ? "full"
    : "basic";
  return { code, nativeName, englishName, dir, tier };
}

/** 全部支持的语种，按英文名字母序（与 OpenAI 清单同序，便于核对） */
export const LOCALES: LocaleMeta[] = [
  meta("zh", "简体中文", "Chinese"),
  meta("en", "English", "English"),
  meta("sq", "Shqip", "Albanian"),
  meta("am", "አማርኛ", "Amharic"),
  meta("ar", "العربية", "Arabic", "rtl"),
  meta("hy", "Հայերեն", "Armenian"),
  meta("bn", "বাংলা", "Bengali"),
  meta("bs", "Bosanski", "Bosnian"),
  meta("bg", "Български", "Bulgarian"),
  meta("my", "မြန်မာ", "Burmese"),
  meta("ca", "Català", "Catalan"),
  meta("hr", "Hrvatski", "Croatian"),
  meta("cs", "Čeština", "Czech"),
  meta("da", "Dansk", "Danish"),
  meta("nl", "Nederlands", "Dutch"),
  meta("et", "Eesti", "Estonian"),
  meta("fi", "Suomi", "Finnish"),
  meta("fr", "Français", "French"),
  meta("ka", "ქართული", "Georgian"),
  meta("de", "Deutsch", "German"),
  meta("el", "Ελληνικά", "Greek"),
  meta("gu", "ગુજરાતી", "Gujarati"),
  meta("hi", "हिन्दी", "Hindi"),
  meta("hu", "Magyar", "Hungarian"),
  meta("is", "Íslenska", "Icelandic"),
  meta("id", "Bahasa Indonesia", "Indonesian"),
  meta("it", "Italiano", "Italian"),
  meta("ja", "日本語", "Japanese"),
  meta("kn", "ಕನ್ನಡ", "Kannada"),
  meta("kk", "Қазақша", "Kazakh"),
  meta("ko", "한국어", "Korean"),
  meta("lv", "Latviešu", "Latvian"),
  meta("lt", "Lietuvių", "Lithuanian"),
  meta("mk", "Македонски", "Macedonian"),
  meta("ms", "Bahasa Melayu", "Malay"),
  meta("ml", "മലയാളം", "Malayalam"),
  meta("mr", "मराठी", "Marathi"),
  meta("mn", "Монгол", "Mongolian"),
  meta("nb", "Norsk", "Norwegian"),
  meta("fa", "فارسی", "Persian", "rtl"),
  meta("pl", "Polski", "Polish"),
  meta("pt", "Português", "Portuguese"),
  meta("pa", "ਪੰਜਾਬੀ", "Punjabi"),
  meta("ro", "Română", "Romanian"),
  meta("ru", "Русский", "Russian"),
  meta("sr", "Српски", "Serbian"),
  meta("sk", "Slovenčina", "Slovak"),
  meta("sl", "Slovenščina", "Slovenian"),
  meta("so", "Soomaali", "Somali"),
  meta("es", "Español", "Spanish"),
  meta("sw", "Kiswahili", "Swahili"),
  meta("sv", "Svenska", "Swedish"),
  meta("tl", "Tagalog", "Tagalog"),
  meta("ta", "தமிழ்", "Tamil"),
  meta("te", "తెలుగు", "Telugu"),
  meta("th", "ไทย", "Thai"),
  meta("tr", "Türkçe", "Turkish"),
  meta("uk", "Українська", "Ukrainian"),
  meta("ur", "اردو", "Urdu", "rtl"),
  meta("vi", "Tiếng Việt", "Vietnamese"),
];

/** 全部语言代码，供路由生成与校验使用 */
export const LOCALE_CODES = LOCALES.map((l) => l.code);

const BY_CODE = new Map(LOCALES.map((l) => [l.code, l]));

/** 是否为受支持的语言代码 */
export function isLocale(code: string): boolean {
  return BY_CODE.has(code);
}

/** 取语言元信息；未知代码返回源语言，调用方无需各自兜底 */
export function localeMeta(code: string): LocaleMeta {
  return BY_CODE.get(code) ?? BY_CODE.get(SOURCE_LOCALE)!;
}

/**
 * 按 Accept-Language 选出最合适的语言。
 *
 * 只认语言主标签：浏览器发来的是 zh-CN / zh-TW / en-GB 这类带地区的标签，
 * 而界面文案不按地区分化，`zh-CN` 与 `zh-SG` 读的是同一份译文。
 * 一个都匹配不上时回退源语言，而不是英语 —— 这个项目的内容以中文为准，
 * 中文是唯一保证完整的那份。
 */
export function negotiateLocale(acceptLanguage: string | null): string {
  if (!acceptLanguage) return SOURCE_LOCALE;
  const ranked = acceptLanguage
    .split(",")
    .map((part) => {
      const [tag, ...params] = part.trim().split(";");
      const q = params.find((p) => p.trim().startsWith("q="));
      // 缺省权重按 RFC 9110 取 1；解析不出数字的按 0 处理，排到最后
      const weight = q ? Number.parseFloat(q.split("=")[1]) : 1;
      return { tag: tag.trim().toLowerCase(), q: Number.isNaN(weight) ? 0 : weight };
    })
    .filter((x) => x.tag && x.q > 0)
    .sort((a, b) => b.q - a.q);
  for (const { tag } of ranked) {
    if (BY_CODE.has(tag)) return tag;
    const primary = tag.split("-")[0];
    if (BY_CODE.has(primary)) return primary;
  }
  return SOURCE_LOCALE;
}
