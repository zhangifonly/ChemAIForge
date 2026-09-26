// 装载讲解所需的本地化内容：实验描述、目标、试剂术语译名。
//
// buildLesson 的三个调用方（详情页、播放器、TTS 脚本）都要这同一份数据，
// 各自拼一遍容易出现"页面上的口播和生成的语音不是同一句"。
import { SOURCE_LOCALE } from "./locales";

/** 缺译时的中间回退语言，理由同 content.ts 的 BRIDGE_LOCALE */
const BRIDGE_LOCALE = "en";
import type { LessonContent } from "@/components/lab/lesson/buildLesson";
import { loadPhrases } from "./phenomena";

type ContentMap = Record<
  string,
  { title: string; description: string; objectives: string[] }
>;
type Glossary = { reagents: Record<string, string>; apparatus: Record<string, string> };

const contentCache = new Map<string, ContentMap | null>();
const termsCache = new Map<string, Record<string, string> | null>();

async function loadContentMap(locale: string): Promise<ContentMap | null> {
  if (contentCache.has(locale)) return contentCache.get(locale) ?? null;
  let v: ContentMap | null = null;
  try {
    v = (await import(`../../../content/${locale}.json`)).default as ContentMap;
  } catch {
    v = null;
  }
  contentCache.set(locale, v);
  return v;
}

async function loadTerms(locale: string): Promise<Record<string, string> | null> {
  if (termsCache.has(locale)) return termsCache.get(locale) ?? null;
  let v: Record<string, string> | null = null;
  try {
    const g = (await import(`./glossary/${locale}.json`)).default as Glossary;
    // 试剂与仪器合成一张表：口播里两者都可能出现
    v = { ...g.reagents, ...g.apparatus };
  } catch {
    v = null;
  }
  termsCache.set(locale, v);
  return v;
}

/**
 * 取某个实验在该语种下的讲解内容。
 * 缺任何一项都回退中文原文 —— 讲解少一句译文不该让整页出错。
 */
export async function lessonContent(
  slug: string,
  locale: string,
): Promise<LessonContent> {
  if (locale === SOURCE_LOCALE) return {};
  const [content, terms] = await Promise.all([loadContentMap(locale), loadTerms(locale)]);
  let entry = content?.[slug];
  let termMap = terms;
  // basic 语种没有内容与术语译文，借道英语：讲解口播里出现汉字对他们毫无用处
  if (locale !== BRIDGE_LOCALE && (!entry || !termMap)) {
    const [bc, bt] = await Promise.all([
      loadContentMap(BRIDGE_LOCALE),
      loadTerms(BRIDGE_LOCALE),
    ]);
    entry ??= bc?.[slug];
    termMap ??= bt;
  }
  // 现象表同样带英语回退（loadPhrases 内部处理）：讲解两极现象等句子由引擎产出，
  // 不查表就会把中文原句拼进外语口播
  const phrases = await loadPhrases(locale);
  return {
    description: entry?.description,
    objectives: entry?.objectives,
    terms: termMap ?? undefined,
    phrases: phrases ?? undefined,
  };
}
