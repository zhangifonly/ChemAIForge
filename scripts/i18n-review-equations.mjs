// 复核方程式译文里的化学命名。
//
// 为什么单独复核：方程式翻译是"只译中文词、保留化学式"，模型在这一步最容易
// 把物质名译错而不自知。抽查一条「乙炔 + Br₂ → 1,1,2,2-四溴乙烷」就发现 4 个语种出错，
// 其中法语译成了 tétrabromométhane（四溴甲烷 CBr₄）—— 换了一种物质。
// 这种错误读起来通顺，人工抽查几条根本发现不了。
//
// 复核方式：把中文原式与译文成对交给模型，只问"物质是否一致"，不重译。
// 输出可疑条目清单，由人决定是否采纳修正。
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { getClaudeApiConfig } from "../src/server/ai/config.ts";
import { FULL_LOCALES, localeMeta, SOURCE_LOCALE } from "../src/lib/i18n/locales.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CONTENT = join(ROOT, "content");
const BATCH = 25;

async function review(pairs, locale) {
  const { baseUrl, apiKey, model } = getClaudeApiConfig();
  const lang = localeMeta(locale).englishName;
  const prompt = [
    `You are checking ${lang} translations of Chinese chemical equations for NAMING errors only.`,
    "Each item: the Chinese source equation and its translation. Formulas are kept verbatim;",
    "only the Chinese words were translated.",
    "",
    "Flag an item ONLY if a translated substance name denotes a DIFFERENT substance than the Chinese",
    "(e.g. tetrabromoMETHANE for 四溴乙烷 = tetrabromoETHANE), or is malformed/non-standard in",
    `${lang} chemistry nomenclature, or a formula/arrow/coefficient was altered.`,
    "Do NOT flag stylistic choices.",
    "",
    'Output ONLY JSON: {"issues":[{"i":<index>,"problem":"<short>","fix":"<corrected full translation>"}]}',
    'If all correct, output {"issues":[]}.',
    "",
    JSON.stringify(pairs.map(([zh, tr], i) => ({ i, zh, tr }))),
  ].join("\n");
  const res = await fetch(`${baseUrl}/v1/messages`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model, max_tokens: 4000, messages: [{ role: "user", content: prompt }] }),
  });
  const json = await res.json();
  if (json.error) throw new Error(json.error.message ?? JSON.stringify(json.error));
  const text = json.content?.[0]?.text ?? "";
  // 模型有时在 JSON 后追加解释，lastIndexOf("}") 会越过 JSON 本体取到说明里的括号。
  // 改为从第一个 { 起按括号配对截取第一个完整对象。
  const start = text.indexOf("{");
  let depth = 0, end = -1, inStr = false, esc = false;
  for (let i = start; i < text.length; i++) {
    const c = text[i];
    if (inStr) { if (esc) esc = false; else if (c === "\\") esc = true; else if (c === '"') inStr = false; continue; }
    if (c === '"') inStr = true;
    else if (c === "{") depth++;
    else if (c === "}" && --depth === 0) { end = i; break; }
  }
  const out = JSON.parse(text.slice(start, end + 1).replace(/,\s*([\]}])/g, "$1"));
  return (out.issues ?? []).map((x) => ({ ...x, zh: pairs[x.i]?.[0], tr: pairs[x.i]?.[1] }));
}

const src = JSON.parse(readFileSync(join(CONTENT, "phenomena-zh.json"), "utf8"));
// 方程式特征：含化学式箭头
const equations = src.descriptions.filter((t) => /→|⇌|-->/.test(t));
const targets = process.argv[2] ? [process.argv[2]] : FULL_LOCALES.filter((l) => l !== SOURCE_LOCALE);
console.log(`方程式 ${equations.length} 条，复核语种：${targets.join(" ")}\n`);

const report = {};
for (const locale of targets) {
  const map = JSON.parse(readFileSync(join(CONTENT, `phenomena-${locale}.json`), "utf8"));
  const pairs = equations.filter((e) => map[e]).map((e) => [e, map[e]]);
  const issues = [];
  for (let i = 0; i < pairs.length; i += BATCH) {
    try {
      issues.push(...(await review(pairs.slice(i, i + BATCH), locale)));
    } catch (err) {
      console.log(`  ✗ ${locale} 批次 ${i}：${err instanceof Error ? err.message : err}`);
    }
  }
  report[locale] = issues;
  console.log(`${locale}: 可疑 ${issues.length} 条`);
  for (const x of issues.slice(0, 4)) console.log(`    ${x.problem}\n      ${x.tr}\n    → ${x.fix}`);
}
writeFileSync(join(ROOT, "docs/i18n-equation-review.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
console.log("\n完整清单：docs/i18n-equation-review.json");
