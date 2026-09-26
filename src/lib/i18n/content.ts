// 实验内容的译文取用层。
//
// 译文按 slug 组织存在 content/<locale>.json，与数据库里的中文原文分离：
//   - 原文留在库里，因为 reagents / apparatus 是引擎的匹配键，翻译会让反应判定失效；
//   - 译文随代码发布，改一句文案不必动数据库、也不必给 501 个实验各存 60 份。
//
// 只覆盖 title / description / objectives 三个字段，其余字段（含试剂与仪器名）
// 保持原文，它们的展示译名走术语表。
import type { ExperimentDTO } from "@/types/experiment";
import { SOURCE_LOCALE } from "./locales";

/**
 * 内容缺译时的中间回退语言。
 *
 * 51 个 basic 语种只译了界面文案，实验内容没有译文。直接回退中文原文，
 * 等于让一个阿尔巴尼亚语用户对着满屏汉字 —— 英文虽然也不是他的语言，
 * 但至少读得出化学名词。中文仍是最终回退（英文译文缺失时）。
 */
const BRIDGE_LOCALE = "en";

/** 一个实验的可译字段 */
interface ContentEntry {
  title: string;
  description: string;
  objectives: string[];
}

type ContentMap = Record<string, ContentEntry>;

/**
 * 译文缓存：进程内按 locale 缓存一次。
 *
 * 501 个实验的 JSON 约 180 KB，每次请求重新 import 并解析既慢又无意义 ——
 * 文件随构建产物固定，运行期不会变。
 */
const cache = new Map<string, ContentMap | null>();

async function loadContent(locale: string): Promise<ContentMap | null> {
  if (cache.has(locale)) return cache.get(locale) ?? null;
  let value: ContentMap | null = null;
  try {
    value = (await import(`../../../content/${locale}.json`)).default as ContentMap;
  } catch {
    // 该语种尚未翻译（basic 语种，或翻译脚本未跑完）—— 回退原文，
    // 而不是让页面报错。缺译文是内容问题，不该表现为服务不可用。
    value = null;
  }
  cache.set(locale, value);
  return value;
}

/**
 * 给一个实验套上译文。
 *
 * 逐字段回退而非整条回退：翻译中断时可能只译出了 title，
 * 此时 description 该显示中文原文，而不是连 title 的译文一起丢掉。
 */
export async function localizeExperiment(
  exp: ExperimentDTO,
  locale: string,
): Promise<ExperimentDTO> {
  if (locale === SOURCE_LOCALE) return exp;
  const content = await loadContent(locale);
  // 该语种没有内容译文时借道英语，见 BRIDGE_LOCALE 的说明
  const t =
    content?.[exp.slug] ??
    (locale === BRIDGE_LOCALE ? undefined : (await loadContent(BRIDGE_LOCALE))?.[exp.slug]);
  if (!t) return exp;
  return {
    ...exp,
    title: t.title || exp.title,
    description: t.description || exp.description,
    // 条数必须与原文一致才采用：页面按索引渲染，少一条就少一个学习目标，
    // 多一条则是模型自己加的内容
    objectives:
      Array.isArray(t.objectives) && t.objectives.length === exp.objectives.length
        ? t.objectives
        : exp.objectives,
  };
}

/** 批量套译文，列表页用 */
export async function localizeExperiments(
  list: ExperimentDTO[],
  locale: string,
): Promise<ExperimentDTO[]> {
  if (locale === SOURCE_LOCALE) return list;
  return Promise.all(list.map((exp) => localizeExperiment(exp, locale)));
}

/**
 * 该语种下可用于搜索的文本（标题 + 描述）。
 *
 * 列表页的关键词过滤原本在数据库里按中文 title 做 LIKE，译文不在库里 ——
 * 日语用户搜「滴定」匹配不到任何东西。改为在应用层用这个函数比对：
 * 501 个实验的量级下，内存过滤比给每个语种建一张表实在得多。
 */
export async function searchableText(
  exp: ExperimentDTO,
  locale: string,
): Promise<string> {
  const t = locale === SOURCE_LOCALE ? null : (await loadContent(locale))?.[exp.slug];
  // 同时保留原文：中文用户在日语界面下搜中文关键词也该能搜到
  return [exp.title, exp.description, t?.title, t?.description]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}
