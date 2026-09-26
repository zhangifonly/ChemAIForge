// 词条与术语表的完整性守卫。
//
// 这些不是"锦上添花"的测试：占位符丢失会让 next-intl 渲染时抛错、整页白屏；
// 某个语种漏词条则界面上突然冒出一句中文。两者都不会被类型检查发现，
// 只能靠这里拦住。
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { FULL_LOCALES, LOCALE_CODES, SOURCE_LOCALE } from "./locales";
import { voicedLocaleCodes } from "@/components/lab/lesson/audioKey";

const ROOT = join(__dirname, "../../..");
const MESSAGES = join(ROOT, "messages");
const GLOSSARY = join(__dirname, "glossary");

type Tree = { [k: string]: string | Tree };

function load(dir: string, name: string): Tree {
  return JSON.parse(readFileSync(join(dir, `${name}.json`), "utf8")) as Tree;
}

/** 摊平成 "a.b.c" → 文本，便于逐键比对 */
function flatten(t: Tree, prefix = ""): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(t)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (typeof v === "string") out[key] = v;
    else Object.assign(out, flatten(v, key));
  }
  return out;
}

/** ICU 占位符名，排序后可直接比较 */
function placeholders(text: string): string[] {
  return [...text.matchAll(/\{(\w+)[^}]*\}/g)].map((m) => m[1]).sort();
}

const source = flatten(load(MESSAGES, SOURCE_LOCALE));
// 实验内容、术语、现象按主力语种分层；界面词条则覆盖全部 59 个目标语种
const targets = FULL_LOCALES.filter((l) => l !== SOURCE_LOCALE);
const uiTargets = LOCALE_CODES.filter((l) => l !== SOURCE_LOCALE);
// 有 edge-tts 音色的语种：讲解会用该语言朗读，故实验内容、现象与术语都必须有译文，
// 否则就是"本地音色念英文"。三个无音色语种（hy/pa/tl）走浏览器语音，内容可回退英语
const voicedTargets = voicedLocaleCodes().filter((l) => l !== SOURCE_LOCALE);

describe("界面词条", () => {
  it("源词条非空", () => {
    expect(Object.keys(source).length).toBeGreaterThan(0);
  });

  it.each(uiTargets)("%s 的键与源语言完全一致", (locale) => {
    expect(existsSync(join(MESSAGES, `${locale}.json`)), `${locale} 缺界面词条文件`).toBe(true);
    const target = flatten(load(MESSAGES, locale));
    const missing = Object.keys(source).filter((k) => !(k in target));
    const extra = Object.keys(target).filter((k) => !(k in source));
    expect(missing, `${locale} 缺少词条`).toEqual([]);
    // 多余的键同样要报：通常是源词条改名后译文没跟上，留着会越积越多
    expect(extra, `${locale} 有源语言已不存在的词条`).toEqual([]);
  });

  it.each(uiTargets)("%s 的 ICU 占位符与源语言一致", (locale) => {
    const target = flatten(load(MESSAGES, locale));
    const broken: string[] = [];
    for (const [key, zh] of Object.entries(source)) {
      const t = target[key];
      if (t === undefined) continue;
      if (placeholders(zh).join(",") !== placeholders(t).join(",")) {
        broken.push(`${key}: [${placeholders(zh)}] → [${placeholders(t)}]`);
      }
    }
    expect(broken, `${locale} 占位符不匹配`).toEqual([]);
  });

  it.each(uiTargets)("%s 的译文不含未转义的 ASCII 直引号", (locale) => {
    // 直引号在德语等语言里本就不规范，且它曾让翻译脚本的 JSON 解析断裂，
    // 留在词条里说明修正流程漏了这一条
    const target = flatten(load(MESSAGES, locale));
    const bad = Object.entries(target)
      .filter(([, v]) => v.includes('"'))
      .map(([k]) => k);
    expect(bad, `${locale} 应改用成对的弯引号或书名号`).toEqual([]);
  });

  it.each(uiTargets)("%s 没有把词条译成空串", (locale) => {
    const target = flatten(load(MESSAGES, locale));
    const empty = Object.entries(target)
      // 源语言里本就为空的键是排版值（如句间分隔符，中文为空、拉丁语系为空格），不算漏译
      // 源语言里本就为空的键是排版值（如句间分隔符，中文为空、拉丁语系为空格），不算漏译；
      // 连接符类键（*Join）在泰语等不用标点分词的语言里取空格也是对的，只看是否真为空串
      .filter(([k, v]) => source[k] !== "" && (/Join$/.test(k) ? v === "" : v.trim() === ""))
      .map(([k]) => k);
    expect(empty, `${locale} 有空词条（界面会出现空白按钮）`).toEqual([]);
  });
});

interface Glossary {
  reagents: Record<string, string>;
  apparatus: Record<string, string>;
}

const terms = JSON.parse(
  readFileSync(join(GLOSSARY, "terms.json"), "utf8"),
) as { reagents: { term: string }[]; apparatus: { term: string }[] };

describe("化学术语表", () => {
  it("术语清单覆盖全库试剂与仪器", () => {
    expect(terms.reagents.length).toBeGreaterThan(150);
    expect(terms.apparatus.length).toBeGreaterThan(100);
  });

  it.each(voicedTargets)("%s 的术语表覆盖全部术语", (locale) => {
    const p = join(GLOSSARY, `${locale}.json`);
    // 术语表允许暂缺（basic 语种不译实验内容），但 full 语种必须齐全
    expect(existsSync(p), `${locale} 缺术语表文件`).toBe(true);
    const g = JSON.parse(readFileSync(p, "utf8")) as Glossary;
    const missR = terms.reagents.filter((t) => !g.reagents[t.term]).map((t) => t.term);
    const missA = terms.apparatus.filter((t) => !g.apparatus[t.term]).map((t) => t.term);
    expect(missR, `${locale} 缺试剂译名`).toEqual([]);
    expect(missA, `${locale} 缺仪器译名`).toEqual([]);
  });

  it.each(voicedTargets)("%s 的术语译名没有原样照抄中文", (locale) => {
    const g = JSON.parse(readFileSync(join(GLOSSARY, `${locale}.json`), "utf8")) as Glossary;
    const all = { ...g.reagents, ...g.apparatus };
    // 日语会保留部分汉字词（試験管、濃硫酸），是正常的；这里只抓
    // "整条与中文原文一字不差"的漏译
    const untranslated = Object.entries(all)
      // 原文本就不含汉字的（EDTA、pH 这类国际通用写法）在各语言里保持原样
      // 才是对的，不能算漏译
      .filter(([zh, t]) => zh === t && /[一-鿿]/.test(zh))
      .map(([zh]) => zh);
    // 非日语的译名里不该夹着汉字：模型有时只译一半（「คีมจับ坩埚」「濃 ಅಮೋನಿಯಾ」），
    // 整条比对抓不到这种，得逐字查
    if (locale !== "ja") {
      const mixed = Object.entries(all)
        .filter(([, t]) => /[\u4e00-\u9fff]/.test(t))
        .map(([zh, t]) => `${zh} → ${t}`);
      expect(mixed, `${locale} 有夹汉字的译名`).toEqual([]);
    }
    if (locale === "ja") {
      // 日语同形词较多，放宽到"不应超过术语总数的三成"
      expect(untranslated.length / Object.keys(all).length).toBeLessThan(0.3);
    } else {
      expect(untranslated, `${locale} 有未翻译的术语`).toEqual([]);
    }
  });
});

// 实验内容译文（content/<locale>.json）的完整性。
// 这些不是界面词条，但同样会直接显示给学生 —— 缺一条实验就显示中文原文，
// 多一条则是模型凭空造的实验（实测俄语出现过一个库里不存在的 slug）。
const CONTENT = join(ROOT, "content");

interface ContentEntry {
  title: string;
  description: string;
  objectives: string[];
}

const sourceContent = JSON.parse(
  readFileSync(join(CONTENT, `${SOURCE_LOCALE}.json`), "utf8"),
) as Record<string, ContentEntry>;

describe("实验内容译文", () => {
  it("源内容覆盖全部实验", () => {
    expect(Object.keys(sourceContent).length).toBeGreaterThan(500);
  });

  it.each(voicedTargets)("%s 的实验集合与源语言一致", (locale) => {
    const p = join(CONTENT, `${locale}.json`);
    expect(existsSync(p), `${locale} 缺内容译文`).toBe(true);
    const target = JSON.parse(readFileSync(p, "utf8")) as Record<string, ContentEntry>;
    const missing = Object.keys(sourceContent).filter((k) => !(k in target));
    // 多出的 slug 说明模型编了一个不存在的实验，必须清掉而不是留着
    const extra = Object.keys(target).filter((k) => !(k in sourceContent));
    expect(missing, `${locale} 缺少实验译文`).toEqual([]);
    expect(extra, `${locale} 有源库中不存在的实验`).toEqual([]);
  });

  it.each(voicedTargets)("%s 的每条实验都有标题与描述", (locale) => {
    const target = JSON.parse(
      readFileSync(join(CONTENT, `${locale}.json`), "utf8"),
    ) as Record<string, ContentEntry>;
    const broken = Object.entries(target)
      .filter(([, v]) => !v.title?.trim() || !v.description?.trim())
      .map(([k]) => k);
    expect(broken, `${locale} 有缺标题或描述的实验`).toEqual([]);
  });

  it.each(voicedTargets)("%s 的 objectives 条数与源语言一致", (locale) => {
    const target = JSON.parse(
      readFileSync(join(CONTENT, `${locale}.json`), "utf8"),
    ) as Record<string, ContentEntry>;
    // 页面按索引渲染学习目标，少一条就少显示一个，多一条则是模型自己加的
    const bad = Object.entries(sourceContent)
      .filter(([slug, src]) => target[slug]?.objectives?.length !== src.objectives.length)
      .map(([slug]) => slug);
    expect(bad, `${locale} 的学习目标条数不符`).toEqual([]);
  });
});

// 现象描述与安全提醒译文（content/phenomena-<locale>.json）的完整性。
// 安全提醒尤其不能漏：一个只读阿拉伯语的学生看不懂"须在通风橱中操作"，
// 那条提醒就等于不存在。
const phenomenaSource = JSON.parse(
  readFileSync(join(CONTENT, "phenomena-zh.json"), "utf8"),
) as { descriptions: string[]; observations: string[] };
const phenomenaKeys = [...phenomenaSource.descriptions, ...phenomenaSource.observations];

describe("现象与安全提醒译文", () => {
  it("源表覆盖引擎输出与安全提醒", () => {
    expect(phenomenaKeys.length).toBeGreaterThan(500);
  });

  it.each(voicedTargets)("%s 覆盖全部现象与安全提醒", (locale) => {
    const target = JSON.parse(
      readFileSync(join(CONTENT, `phenomena-${locale}.json`), "utf8"),
    ) as Record<string, string>;
    const missing = phenomenaKeys.filter((k) => !target[k]?.trim());
    expect(missing, `${locale} 缺现象译文`).toEqual([]);
  });

  it.each(voicedTargets)("%s 没有源表里已不存在的键", (locale) => {
    const target = JSON.parse(
      readFileSync(join(CONTENT, `phenomena-${locale}.json`), "utf8"),
    ) as Record<string, string>;
    const src = new Set(phenomenaKeys);
    // 规则文案改动后旧句子会残留在译文里，越积越多且永远查不到
    expect(Object.keys(target).filter((k) => !src.has(k)), `${locale} 有残留键`).toEqual([]);
  });
});

// 译文里夹带的汉字：批量翻译偶尔只译一半（方程式里的「浓」「盐」、句中的「析氢腐蚀」）。
// 整条比对抓不到，要逐字扫。日语本就用汉字，只查简体专有字形。
const SIMPLIFIED_ONLY = /[实验这们为说对时过还发进开关现样应将么级经图两从问题错读选动气测试结话请击]/;
function leaksChinese(locale: string, s: string): boolean {
  return (locale === "ja" ? SIMPLIFIED_ONLY : /[\u4e00-\u9fff]/).test(s);
}

describe("译文不夹带汉字", () => {
  it.each(voicedTargets)("%s 的实验内容无汉字残留", (locale) => {
    const target = JSON.parse(readFileSync(join(CONTENT, `${locale}.json`), "utf8")) as Record<
      string,
      ContentEntry
    >;
    const bad: string[] = [];
    for (const [slug, e] of Object.entries(target)) {
      for (const v of [e.title, e.description, ...e.objectives]) {
        if (leaksChinese(locale, v)) bad.push(`${slug}: ${v.slice(0, 40)}`);
      }
    }
    expect(bad.slice(0, 5), `${locale} 有 ${bad.length} 条夹汉字`).toEqual([]);
  });

  it.each(voicedTargets)("%s 的现象与安全提醒无汉字残留", (locale) => {
    const target = JSON.parse(
      readFileSync(join(CONTENT, `phenomena-${locale}.json`), "utf8"),
    ) as Record<string, string>;
    const bad = Object.values(target).filter((v) => leaksChinese(locale, v));
    expect(bad.slice(0, 5), `${locale} 有 ${bad.length} 条夹汉字`).toEqual([]);
  });
});

// 讲解里带器皿的句子要整句翻译（见 buildLesson 的 vesselSentence）。
// 若某语种缺这 9 句，取词会退回键名、口播念出 "narrTake_flask"；
// 若译文里残留 {vessel}，则是还在拼接 —— 那正是要消除的「Բաժակ-ի」类语法错误。
describe("讲解器皿整句", () => {
  const KEYS = ["narrTake", "narrHeat", "narrMix"].flatMap((s) =>
    ["beaker", "tube", "flask"].map((v) => `lesson.${s}_${v}`),
  );
  it.each(uiTargets)("%s 有全部 9 句且不再拼接器皿占位符", (locale) => {
    const target = flatten(load(MESSAGES, locale));
    expect(KEYS.filter((k) => !target[k]), `${locale} 缺整句`).toEqual([]);
    expect(KEYS.filter((k) => target[k]?.includes("{vessel}")), `${locale} 仍在拼接`).toEqual([]);
  });
});
