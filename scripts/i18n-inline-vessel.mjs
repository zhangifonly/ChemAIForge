// 把讲解模板里的器皿占位符 {vessel} 展开成完整句子。
//
// 为什么：「取用{reagent}，加入{vessel}中。」这类句子在中文里是顺的，但器皿名单独翻译、
// 句子单独翻译再拼起来，到了有格变化或后置词的语言就会出问题：
//   亚美尼亚语  {vessel}-ի մեջ   → 「Բաժակ-ի」：大写名词 + 连字符硬接格尾
//   德语       in {vessel} geben → 器皿名作为独立词条译成主格、首字母大写，缺冠词
//   英语       add it to {vessel} → "add it to Erlenmeyer Flask"：缺冠词、首字母大写
// 实测 10 个语种占位符硬接词尾、40 个语种器皿名首字母大写。
//
// 做法：器皿只有 3 种（烧杯 / 试管 / 锥形瓶），用到器皿的句子只有 3 句（取用 / 加热 / 混合）。
// 为每个语种把 3×3 = 9 句完整翻译好，存成 narrTake_beaker 这样的键；
// buildLesson 按器皿选整句，不再做字符串拼接。器皿名在各语言里怎么变格由译者一次处理好。
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { getClaudeApiConfig } from "../src/server/ai/config.ts";
import { localeMeta, SOURCE_LOCALE } from "../src/lib/i18n/locales.ts";
import { extractJson } from "./lib/extractJson.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const MESSAGES = join(ROOT, "messages");

const VESSELS = { beaker: "vesselBeaker", tube: "vesselTube", flask: "vesselFlask" };
const SENTENCES = ["narrTake", "narrHeat", "narrMix"];

/** 源语言：直接代入中文器皿名，得到 9 句中文原句 */
function sourceSentences(zh) {
  const out = {};
  for (const s of SENTENCES) {
    for (const [v, key] of Object.entries(VESSELS)) {
      out[`${s}_${v}`] = zh.lesson[s].replaceAll("{vessel}", zh.lesson[key]);
    }
  }
  return out;
}

async function translate(src, locale) {
  const { baseUrl, apiKey, model } = getClaudeApiConfig();
  const lang = localeMeta(locale).englishName;
  const prompt = [
    `Translate these instructions from a chemistry lab lesson into natural ${lang}.`,
    "They are read aloud to students, so grammar must be correct: inflect the vessel noun for",
    "case, add articles, and use the case suffix or postposition the sentence requires.",
    "The vessel is an ordinary noun (lowercase unless the language capitalizes all nouns, e.g. German).",
    "Keep the placeholder {reagent} exactly as-is, unchanged, and do NOT add any other placeholder.",
    // {reagent} 是任意试剂名（185 种），无法预知它的变格形式。把格尾硬接在它后面
    // （亚美尼亚语 {reagent}-ը、蒙古语 {reagent}-ийг）等于给一个外来词随手套词尾。
    // 让它作为同位语跟在一个会变格的中心词后面，格由中心词承担
    "- NEVER attach a case suffix or postposition directly to {reagent} (no {reagent}-ը, {reagent}-ийг).",
    "  If the sentence needs a case on it, put a noun meaning 'the reagent' before it and inflect that",
    "  noun instead, with {reagent} standing uninflected as an apposition (e.g. 'ռեակտիվը՝ {reagent}').",
    '- Output ONLY a JSON object mapping each key to its translation. Every key must appear.',
    "",
    JSON.stringify(src),
  ].join("\n");
  const res = await fetch(`${baseUrl}/v1/messages`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model, max_tokens: 3000, messages: [{ role: "user", content: prompt }] }),
  });
  const json = await res.json();
  if (json.error) throw new Error(json.error.message ?? JSON.stringify(json.error));
  return extractJson(json.content?.[0]?.text ?? "");
}

/** 校验：键齐全；原句有 {reagent} 的译文也必须有，且不许出现其他占位符（尤其不能残留 {vessel}） */
function problems(src, out) {
  const bad = [];
  for (const [k, zh] of Object.entries(src)) {
    const v = out[k];
    if (typeof v !== "string" || !v.trim()) { bad.push(`缺 ${k}`); continue; }
    const want = (zh.match(/\{\w+\}/g) ?? []).sort().join();
    const have = (v.match(/\{\w+\}/g) ?? []).sort().join();
    if (want !== have) bad.push(`${k} 占位符 [${want}]→[${have}]`);
  }
  return bad;
}

const zh = JSON.parse(readFileSync(join(MESSAGES, `${SOURCE_LOCALE}.json`), "utf8"));
const src = sourceSentences(zh);
const only = process.argv[2];
const locales = only
  ? [only]
  : readdirSync(MESSAGES).map((f) => f.replace(/\.json$/, "")).filter((l) => l !== SOURCE_LOCALE).sort();

// 源语言也写回：buildLesson 统一按 narrTake_beaker 取词，中文也走这条路
Object.assign(zh.lesson, src);
writeFileSync(join(MESSAGES, `${SOURCE_LOCALE}.json`), `${JSON.stringify(zh, null, 2)}\n`, "utf8");

const failed = [];
for (const locale of locales) {
  const path = join(MESSAGES, `${locale}.json`);
  const data = JSON.parse(readFileSync(path, "utf8"));
  if (Object.keys(src).every((k) => data.lesson?.[k])) continue; // 已译过，断点续传
  let ok = false;
  for (let attempt = 1; attempt <= 3 && !ok; attempt++) {
    try {
      const out = await translate(src, locale);
      const bad = problems(src, out);
      if (bad.length) throw new Error(bad.slice(0, 2).join("；"));
      Object.assign(data.lesson, Object.fromEntries(Object.keys(src).map((k) => [k, out[k]])));
      writeFileSync(path, `${JSON.stringify(data, null, 2)}\n`, "utf8");
      ok = true;
    } catch (err) {
      if (attempt === 3) failed.push(`${locale}（${err instanceof Error ? err.message : err}）`);
    }
  }
  console.log(`${ok ? "✓" : "✗"} ${locale}`);
}
console.log(failed.length ? `\n失败：${failed.join("；")}` : "\n全部完成");
