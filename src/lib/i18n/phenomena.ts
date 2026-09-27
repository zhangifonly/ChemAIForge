// 化学现象描述的译文查表。
//
// 为什么在展示层查表、而不是让引擎按语言产出文案：
// 引擎（react / electrolyze / galvanicCell）是纯函数，输入试剂与条件、输出化学结论。
// 给它加一个 locale 参数，等于让 24 个规则文件、每条规则的 build 都要关心语言 ——
// 化学规则与界面语言从此耦合，加一个语种要动一百多条规则。
// 让它继续只说中文，由这里把输出映射成当前语言，引擎保持纯粹。
//
// 键是中文原文本身：很多描述由模板拼出（"EDTA 以六个配位点包住${name}离子…"），
// 没有稳定 id 可用，而运行时能拿到的恰好就是成句的文本。
import { SOURCE_LOCALE } from "./locales";

/** 缺译时的中间回退语言，理由同 content.ts 的 BRIDGE_LOCALE */
const BRIDGE_LOCALE = "en";

type Phrases = Record<string, string>;

/** 进程内缓存：文件随构建固定，运行期不会变 */
const cache = new Map<string, Phrases | null>();

async function load(locale: string): Promise<Phrases | null> {
  if (cache.has(locale)) return cache.get(locale) ?? null;
  let value: Phrases | null = null;
  try {
    value = (await import(`../../../content/phenomena-${locale}.json`)).default as Phrases;
  } catch {
    // 该语种未翻译时回退中文原文：看到中文总比看到空白或报错好
    value = null;
  }
  cache.set(locale, value);
  return value;
}

/** 供服务端组件载入整张表后注入客户端（见 PhenomenaProvider） */
export async function loadPhrases(locale: string): Promise<Record<string, string> | null> {
  if (locale === SOURCE_LOCALE) return null;
  // 该语种没有现象译文时借道英语：对不懂中文的用户，英文现象描述远比汉字有用
  return (await load(locale)) ?? (locale === BRIDGE_LOCALE ? null : load(BRIDGE_LOCALE));
}

/**
 * 把一句现象描述译成目标语言；查不到时原样返回。
 *
 * 查不到是正常情况，不是错误：规则文案改动后、新语种翻译跑完前都会如此。
 * 此时显示中文原文，而不是显示键名或空串。
 */
export async function localizePhrase(text: string, locale: string): Promise<string> {
  if (!text || locale === SOURCE_LOCALE) return text;
  const map = await loadPhrases(locale);
  return map?.[text] || text;
}

/** 批量翻译，供一次渲染里多条现象共用一次查表 */
export async function localizePhrases(
  texts: (string | undefined)[],
  locale: string,
): Promise<(string | undefined)[]> {
  if (locale === SOURCE_LOCALE) return texts;
  const map = await load(locale);
  if (!map) return texts;
  return texts.map((t) => (t ? map[t] || t : t));
}

/**
 * 同步版本：客户端组件里已通过 Provider 拿到整张表时使用。
 * 服务端请用上面的异步版本，避免把 180 KB 的表打进客户端包。
 */
export function localizePhraseWith(text: string, map: Phrases | null): string {
  if (!text || !map) return text;
  return map[text] || text;
}
