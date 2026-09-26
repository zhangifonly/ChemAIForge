// 翻译化学现象描述：content/phenomena-zh.json → content/phenomena-<locale>.json。
//
// 以中文原文为键：运行时引擎给出的只有描述文本本身（很多是模板拼出来的，
// 没有稳定 id），用文本查表最直接。见 i18n-extract-phenomena.mjs 的说明。
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { getClaudeApiConfig } from "../src/server/ai/config.ts";
import { FULL_LOCALES, localeMeta, SOURCE_LOCALE } from "../src/lib/i18n/locales.ts";
import { voicedLocaleCodes } from "../src/components/lab/lesson/audioKey.ts";
import { extractJson, sliceFirstObject } from "./lib/extractJson.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CONTENT = join(ROOT, "content");
const GLOSSARY = join(ROOT, "src/lib/i18n/glossary");
const BATCH = 20;
const MAX_ATTEMPTS = 3;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function loadGlossary(locale) {
  const p = join(GLOSSARY, `${locale}.json`);
  if (!existsSync(p)) return {};
  const g = JSON.parse(readFileSync(p, "utf8"));
  return { ...g.reagents, ...g.apparatus };
}

/** 容错解析：译文里的裸引号会截断 JSON，见 i18n-translate-ui.mjs 的同名函数 */
function parseLoose(body) {
  try {
    return JSON.parse(body);
  } catch {
    const out = {};
    for (const line of body.split("\n")) {
      const m = line.match(/^\s*"(.+?)"\s*:\s*"(.*?)"\s*,?\s*$/);
      if (m) out[m[1]] = m[2];
    }
    if (Object.keys(out).length === 0) throw new Error("无法解析模型返回的 JSON");
    return out;
  }
}

async function translateBatch(texts, locale, glossary, depth = 0) {
  const { baseUrl, apiKey, model } = getClaudeApiConfig();
  const target = localeMeta(locale).englishName;
  const blob = texts.join("");
  const terms = Object.fromEntries(
    Object.entries(glossary).filter(([zh]) => blob.includes(zh)),
  );

  const prompt = [
    `Translate these Chinese descriptions of chemical phenomena into ${target}.`,
    "",
    "They are shown to students right after a reaction happens, and are also read aloud.",
    "",
    "Rules:",
    "- Keep the explanatory tone of a chemistry teacher describing what is observed.",
    "- Keep formulas, ions and units verbatim (Fe³⁺, SO₄²⁻, CO₂, pH, ℃).",
    "- Preserve the colour words precisely: they are the observable evidence.",
    "- Some entries are chemical equations mixing formulas with Chinese words (点燃 ignite, 高温 high temperature, 盐 salt, 不溶解 does not dissolve, 乙炔 acetylene).",
    "  Translate only the Chinese words; keep every formula, coefficient, arrow (→ ⇌ --Δ-->) and charge exactly as written.",
    Object.keys(terms).length
      ? `- Use exactly these established chemistry terms: ${JSON.stringify(terms)}`
      : null,
    "- For quotation marks use “…”, never the straight ASCII quote (it breaks the JSON).",
    // 用序号作键而不是让模型回显中文原文：原文含“弯引号”时（如「务必“酸入水”」），
    // 模型回显键名会顺手改成 ASCII 直引号，JSON 在键名处断开，整批 20 条全部作废。
    // 实测 20 条安全提醒在八个语种里无一幸免，全是这个原因。序号不会被改写。
    "- Input is a JSON array. Output ONLY a JSON object mapping each array index (as a string: \"0\", \"1\", …) to its translation.",
    "- Every index must appear exactly once.",
    "",
    JSON.stringify(texts),
  ]
    .filter(Boolean)
    .join("\n");

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const res = await fetch(`${baseUrl}/v1/messages`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model,
          max_tokens: 8000,
          messages: [{ role: "user", content: prompt }],
        }),
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error.message ?? JSON.stringify(json.error));
      const text = json.content?.[0]?.text ?? "";
      const byIndex = parseLoose(sliceFirstObject(text));
      // 序号还原回原文键：落盘格式仍以中文原文为键，运行时查表不变
      const map = {};
      texts.forEach((t, i) => {
        const v = byIndex[String(i)];
        if (typeof v === "string" && v.trim()) map[t] = v;
      });
      const missing = texts.filter((t) => !map[t]);
      // 只重试缺的那几条，而不是丢掉整批。
      // 20 条里漏 1 条就整批作废，等于把另外 19 条已经译好的结果连同
      // 那次调用的成本一起扔掉 —— 实测这个失败模式在长批次里相当常见。
      if (missing.length) {
        if (missing.length === texts.length) throw new Error("整批未返回");
        // depth 上限防止同一条反复漏译时无限递归：补两轮仍缺就让它进失败清单，
        // 重跑脚本时会再试一次（那时批次组成不同，往往就过了）
        if (depth >= 2) throw new Error(`缺 ${missing.length} 条（补译已达上限）`);
        console.log(`    补译缺失的 ${missing.length} 条`);
        Object.assign(map, await translateBatch(missing, locale, glossary, depth + 1));
      }
      return map;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (attempt === MAX_ATTEMPTS) throw new Error(`${locale} 批次失败：${msg}`);
      await sleep(attempt * 2000);
    }
  }
  throw new Error("unreachable");
}

async function translateLocale(locale, all) {
  const out = join(CONTENT, `phenomena-${locale}.json`);
  const done = existsSync(out) ? JSON.parse(readFileSync(out, "utf8")) : {};
  const glossary = loadGlossary(locale);
  const todo = all.filter((t) => !done[t]);
  if (todo.length === 0) {
    console.log(`  已全部译好（${all.length} 条），跳过`);
    return;
  }
  console.log(`  待译 ${todo.length}/${all.length} 条`);
  let failed = 0;
  for (let i = 0; i < todo.length; i += BATCH) {
    const batch = todo.slice(i, i + BATCH);
    try {
      Object.assign(done, await translateBatch(batch, locale, glossary));
    } catch (err) {
      failed += batch.length;
      console.log(`    ✗ 跳过 ${batch.length} 条：${err instanceof Error ? err.message : err}`);
    }
    writeFileSync(out, `${JSON.stringify(done, null, 2)}\n`, "utf8");
    const at = Math.min(i + BATCH, todo.length);
    if (at % 100 === 0 || at === todo.length) console.log(`    ${at}/${todo.length}`);
  }
  if (failed) console.log(`  ${failed} 条未译成，重跑会续传`);
}

async function main() {
  const src = JSON.parse(readFileSync(join(CONTENT, "phenomena-zh.json"), "utf8"));
  const all = [...src.descriptions, ...src.observations];
  // --voiced：覆盖全部有 edge-tts 音色的语种。只给界面译文而内容回退英文，
  // 讲解就成了"泰语音色念英文"—— 学生听不懂，TTS 形同虚设
  const arg = process.argv[2];
  const targets =
    arg === "--voiced"
      ? voicedLocaleCodes().filter((l) => l !== SOURCE_LOCALE)
      : arg
        ? [arg]
        : FULL_LOCALES.filter((l) => l !== SOURCE_LOCALE);
  console.log(`现象 ${all.length} 条，目标语种（${targets.length}）：${targets.join(" ")}\n`);
  for (const locale of targets) {
    console.log(`[${localeMeta(locale).englishName}] ${locale}`);
    await translateLocale(locale, all);
  }
  console.log("\n完成");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
