// 修复译文里夹带的汉字：只把"没译干净"的条目重译一遍。
//
// 为什么需要：批量翻译时模型偶尔只译一半 —— 方程式里的「亚硫酸盐 + 酸 → 盐」、
// 「H₂SO₄(浓)」原样留下，或在索马里语句子中间夹一个「析氢腐蚀」。
// 整条比对的守卫抓不到这种；逐字扫描发现 50 多个语种各有几条到几十条。
// 全量重译代价太高，这里只挑出含汉字的条目，带上"一个汉字都不许留"的约束重译。
//
// 用法：npx tsx scripts/i18n-fix-cjk.mjs [locale]    不带参数则扫全部语种
import { readFileSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { getClaudeApiConfig } from "../src/server/ai/config.ts";
import { localeMeta } from "../src/lib/i18n/locales.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CONTENT = join(ROOT, "content");
const CJK = /[一-鿿]/;
// 日语本就用汉字，只看简体专有字（与 scripts/i18n-leak-check.mjs 同一张表）
const SIMPLIFIED_ONLY = /[实验这们为说对时过还发进开关现样应将么级经图两从问题错读选动气测试结话请击]/;
const leaks = (locale, s) => (locale === "ja" ? SIMPLIFIED_ONLY : CJK).test(s);

const BATCH = 20;

async function retranslate(items, locale, fresh = false) {
  const { baseUrl, apiKey, model } = getClaudeApiConfig();
  const lang = localeMeta(locale).englishName;
  const prompt = [
    fresh
      ? `Translate each Chinese chemistry text (zh) into ${lang}.`
      : `Each item is a Chinese chemistry text (zh) and an imperfect ${lang} translation (bad)`,
    fresh ? "" : "that still contains untranslated Chinese characters. Produce a corrected translation.",
    "",
    "Rules:",
    `- The result must contain NO Chinese characters at all${locale === "ja" ? " except standard Japanese kanji (use 験 not 验)" : ""}.`,
    "- Keep every chemical formula, ion, coefficient, arrow and condition marker exactly",
    "  (H₂SO₄, Fe³⁺, →, ⇌, --Δ-->). Translate only the words.",
    `- 浓 = concentrated, 稀 = dilute, 盐 = salt, 点燃 = ignite, 高温 = high temperature — in ${lang}.`,
    `- Use standard ${lang} chemistry terminology.`,
    '- Output ONLY JSON: {"0": "...", "1": "..."} keyed by item index.',
    "",
    // 第二轮起不再给出残译：残译里的「염基」「觸媒」「精通」「花火」本身就是污染源，
    // 模型看到它就会照着改一改、把汉字留下（实测同一批 30 条连续两轮原样返回）。
    // 只给中文原文，从零翻译。
    JSON.stringify(items.map(([zh, bad], i) => (fresh ? { i, zh } : { i, zh, bad }))),
  ].join("\n");
  const res = await fetch(`${baseUrl}/v1/messages`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model, max_tokens: 6000, messages: [{ role: "user", content: prompt }] }),
  });
  const json = await res.json();
  if (json.error) throw new Error(json.error.message ?? JSON.stringify(json.error));
  const text = json.content?.[0]?.text ?? "";
  // 按括号配对取第一个完整 JSON 对象（模型可能在后面追加说明）
  const start = text.indexOf("{");
  let depth = 0, end = -1, inStr = false, esc = false;
  for (let i = start; i < text.length; i++) {
    const c = text[i];
    if (inStr) { if (esc) esc = false; else if (c === "\\") esc = true; else if (c === '"') inStr = false; continue; }
    if (c === '"') inStr = true;
    else if (c === "{") depth++;
    else if (c === "}" && --depth === 0) { end = i; break; }
  }
  return JSON.parse(text.slice(start, end + 1).replace(/,\s*([\]}])/g, "$1"));
}

/**
 * 修一个语种的一个文件。
 * 现象文件是 {中文原文: 译文}；实验内容文件是 {slug: {title, description, objectives}}，
 * 要回到 content/zh.json 找对应的中文原文。
 */
async function fixFile(locale, kind) {
  const file = join(CONTENT, kind === "phenomena" ? `phenomena-${locale}.json` : `${locale}.json`);
  if (!existsSync(file)) return 0;
  const data = JSON.parse(readFileSync(file, "utf8"));
  const zh = kind === "content" ? JSON.parse(readFileSync(join(CONTENT, "zh.json"), "utf8")) : null;

  // 收集 [中文, 残译, 写回函数]
  const todo = [];
  if (kind === "phenomena") {
    for (const [src, tr] of Object.entries(data)) {
      if (leaks(locale, tr)) todo.push([src, tr, (v) => (data[src] = v)]);
    }
  } else {
    for (const [slug, e] of Object.entries(data)) {
      const z = zh[slug];
      if (!z) continue;
      if (leaks(locale, e.title)) todo.push([z.title, e.title, (v) => (e.title = v)]);
      if (leaks(locale, e.description)) todo.push([z.description, e.description, (v) => (e.description = v)]);
      e.objectives.forEach((o, i) => {
        if (leaks(locale, o) && z.objectives[i]) todo.push([z.objectives[i], o, (v) => (e.objectives[i] = v)]);
      });
    }
  }
  if (todo.length === 0) return 0;

  let fixed = 0;
  for (let i = 0; i < todo.length; i += BATCH) {
    const batch = todo.slice(i, i + BATCH);
    try {
      const out = await retranslate(batch.map(([z, b]) => [z, b]), locale, FRESH);
      batch.forEach(([, , set], j) => {
        const v = out[String(j)];
        // 重译结果仍夹汉字就不采纳，保留原样等下次
        if (typeof v === "string" && v.trim() && !leaks(locale, v)) {
          set(v);
          fixed++;
        }
      });
    } catch (err) {
      console.log(`  ✗ ${locale}/${kind} 批次失败：${err instanceof Error ? err.message : err}`);
    }
  }
  writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`, "utf8");
  return fixed === todo.length ? fixed : -(todo.length - fixed);
}

const FRESH = process.argv.includes("--fresh");
const only = process.argv.slice(2).find((a) => !a.startsWith("--"));
const locales = only
  ? [only]
  : [...new Set(readdirSync(CONTENT).map((f) => f.match(/^(?:phenomena-)?([a-z]{2})\.json$/)?.[1]).filter(Boolean))]
      .filter((l) => l !== "zh")
      .sort();

let totalFixed = 0;
let remaining = 0;
for (const locale of locales) {
  for (const kind of ["content", "phenomena"]) {
    const r = await fixFile(locale, kind);
    if (r > 0) { totalFixed += r; console.log(`✓ ${locale}/${kind} 修复 ${r} 条`); }
    if (r < 0) { remaining += -r; console.log(`△ ${locale}/${kind} 仍有 ${-r} 条未修好`); }
  }
}
console.log(`\n共修复 ${totalFixed} 条${remaining ? `，仍剩 ${remaining} 条（重跑本脚本再试）` : ""}`);
