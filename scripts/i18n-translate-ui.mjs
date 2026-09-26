// 翻译界面词条：messages/zh.json → messages/<locale>.json。
//
// 与术语表分两个脚本：术语是名词表、要逐条对齐；界面文案有 ICU 占位符
// （{count}、{value}）和语气要求，译坏了占位符会让整句渲染失败。
// 两者的校验规则不同，合在一起反而容易互相牵连。
//
// 术语表作为强约束注入：界面里出现的试剂名必须与实验内容用同一个译名，
// 否则同一个词在按钮上和表格里两种写法。
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { getClaudeApiConfig } from "../src/server/ai/config.ts";
import { FULL_LOCALES, LOCALE_CODES, localeMeta, SOURCE_LOCALE } from "../src/lib/i18n/locales.ts";
import { extractJson, sliceFirstObject } from "./lib/extractJson.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const MESSAGES = join(ROOT, "messages");
const MAX_ATTEMPTS = 3;

/** 把嵌套词条摊平成 "a.b.c" → 文本，便于按批切分与逐条校验 */
function flatten(obj, prefix = "") {
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === "object" && !Array.isArray(v)) {
      Object.assign(out, flatten(v, key));
    } else {
      out[key] = v;
    }
  }
  return out;
}

/** 摊平的键值还原成嵌套结构（next-intl 按命名空间取词条） */
function unflatten(flat) {
  const out = {};
  for (const [key, value] of Object.entries(flat)) {
    const parts = key.split(".");
    let node = out;
    for (const p of parts.slice(0, -1)) {
      node[p] ??= {};
      node = node[p];
    }
    node[parts.at(-1)] = value;
  }
  return out;
}

/**
 * 各语言的成对引号。未列出的语言用 “…”。
 *
 * 模型给出的往往是 ASCII 直引号，而直引号在德语等语言里本就不规范、
 * 在 JSON 里还会截断字符串（见 prompt 里的说明）。落盘前统一换成本地排版习惯。
 */
const QUOTES = {
  de: ["\u201e", "\u201c"], cs: ["\u201e", "\u201c"], sk: ["\u201e", "\u201c"],
  pl: ["\u201e", "\u201d"], ro: ["\u201e", "\u201d"], hu: ["\u201e", "\u201d"],
  bg: ["\u201e", "\u201c"], hr: ["\u201e", "\u201c"], sl: ["\u201e", "\u201c"],
  sr: ["\u201e", "\u201c"], bs: ["\u201e", "\u201c"], mk: ["\u201e", "\u201c"],
  lt: ["\u201e", "\u201c"], et: ["\u201e", "\u201c"], ka: ["\u201e", "\u201c"],
  is: ["\u201e", "\u201c"],
  fr: ["\u00ab\u202f", "\u202f\u00bb"],
  es: ["\u00ab", "\u00bb"], ru: ["\u00ab", "\u00bb"], uk: ["\u00ab", "\u00bb"],
  it: ["\u00ab", "\u00bb"], pt: ["\u00ab", "\u00bb"], ca: ["\u00ab", "\u00bb"],
  el: ["\u00ab", "\u00bb"], kk: ["\u00ab", "\u00bb"], mn: ["\u00ab", "\u00bb"],
  nb: ["\u00ab", "\u00bb"], fa: ["\u00ab", "\u00bb"], hy: ["\u00ab", "\u00bb"],
  lv: ["\u00ab", "\u00bb"], sq: ["\u00ab", "\u00bb"],
  ja: ["\u300c", "\u300d"],
};

/** 把直引号成对替换成该语言的引号；德语的 „ 先归一再配对，避免“开头对、结尾错” */
function normalizeQuotes(text, locale) {
  if (!text.includes('"')) return text;
  const [open, close] = QUOTES[locale] ?? ["\u201c", "\u201d"];
  let opening = true;
  return text.replace(/\u201e/g, '"').replace(/"/g, () => {
    const q = opening ? open : close;
    opening = !opening;
    return q;
  });
}

/** 取出文本里的 ICU 占位符，用于校验译文没把它们弄丢或改名 */
function placeholders(text) {
  return [...text.matchAll(/\{(\w+)[^}]*\}/g)].map((m) => m[1]).sort();
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * 容错解析模型返回的 JSON。
 *
 * 光靠 prompt 约束引号不够：译文里出现未转义的 ASCII 双引号时（德语 „…“
 * 的上引号、英文的 "…"），JSON 会在那里截断。此时退一步按行抽取
 * "key": "value" —— 值里的裸引号不影响行首的键名与行尾的定界符判断。
 */
function parseLoose(body) {
  try {
    return JSON.parse(body);
  } catch {
    const out = {};
    // 键名不含引号（是我们自己给的），只需在行内定位首个冒号后的值区间
    for (const line of body.split("\n")) {
      const m = line.match(/^\s*"([^"]+)"\s*:\s*"(.*?)"\s*,?\s*$/);
      if (m) out[m[1]] = m[2];
    }
    if (Object.keys(out).length === 0) throw new Error("无法解析模型返回的 JSON");
    return out;
  }
}

/** 载入该语种的术语表，作为翻译约束 */
function loadGlossary(locale) {
  const p = join(ROOT, "src/lib/i18n/glossary", `${locale}.json`);
  if (!existsSync(p)) return null;
  const g = JSON.parse(readFileSync(p, "utf8"));
  return { ...g.reagents, ...g.apparatus };
}

async function translateBatch(entries, locale) {
  const { baseUrl, apiKey, model } = getClaudeApiConfig();
  const target = localeMeta(locale).englishName;
  const glossary = loadGlossary(locale);
  // 只注入本批文案里真正出现的术语，不是整张 321 条的表 —— 整表注入既浪费
  // token，又让模型在无关词上分心
  const relevant = glossary
    ? Object.fromEntries(
        Object.entries(glossary).filter(([zh]) =>
          entries.some(([, text]) => text.includes(zh)),
        ),
      )
    : {};

  const prompt = [
    `Translate these UI strings of a virtual chemistry lab app from Chinese into ${target}.`,
    "",
    "Rules:",
    "- Keep every ICU placeholder EXACTLY as-is: {count}, {value}. Never translate or rename them.",
    // 相邻词条常只差一个占位符（narrMix 有 {vessel}、narrMixHeated 没有），
    // 模型会照着上一条把占位符也补进来，导致渲染时报缺变量
    "- NEVER add a placeholder that is not in the source string. If the source has none, the translation must have none.",
    "- These are UI labels and hints. Keep them short; match the register of lab software.",
    "- Keep Latin/number/unit tokens unchanged (pH, mL, ℃, %, s).",
    // 不能笼统说"用目标语言自己的引号"：德语的 „…“ 里那个上引号与 JSON 的
    // 字符串定界符同形，模型一用就把 JSON 截断（实测德语连续三次失败于此）。
    // 指定成对的弯引号，既符合各语言排版习惯，又不会与 JSON 语法冲突。
    "- Chinese corner brackets 「」 are quotes. Render them with the curly quotes “…” (U+201C/U+201D) or the target language's guillemets «…» — never the straight ASCII quote, which would break the JSON.",
    Object.keys(relevant).length
      ? `- Use these established chemistry terms: ${JSON.stringify(relevant)}`
      : null,
    "- Output ONLY a JSON object mapping each input key to its translation.",
    "- Every input key must appear, spelled exactly as given.",
    "",
    JSON.stringify(Object.fromEntries(entries)),
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
      const map = parseLoose(sliceFirstObject(text));

      // 逐条校验：缺键、占位符丢失或改名都要重试。
      // 占位符错了不是"译得不好"，而是 next-intl 渲染时直接抛错、整页白屏。
      const problems = [];
      for (const [key, zh] of entries) {
        const got = map[key];
        if (!got) {
          problems.push(`缺 ${key}`);
          continue;
        }
        const want = placeholders(zh).join(",");
        const have = placeholders(got).join(",");
        if (want !== have) problems.push(`${key} 占位符 [${want}] → [${have}]`);
      }
      if (problems.length) throw new Error(problems.slice(0, 3).join("；"));
      return map;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (attempt === MAX_ATTEMPTS) throw new Error(`${locale} 批次失败：${msg}`);
      console.log(`    第 ${attempt} 次失败（${msg}），退避重试`);
      await sleep(attempt * 2000);
    }
  }
  throw new Error("unreachable");
}

const BATCH = 30;

async function translateLocale(locale, sourceFlat) {
  const out = join(MESSAGES, `${locale}.json`);
  const existing = existsSync(out) ? flatten(JSON.parse(readFileSync(out, "utf8"))) : {};

  // 先清掉源语言已删除的键。源词条改名或改结构后（如 lesson.phaseTheory
  // 重组为 lesson.phase.theory），旧键会一直留在各语种译文里越积越多，
  // 而词条守卫测试正会因此报错。放在这里清，不必每次手工处理八个文件。
  const stale = Object.keys(existing).filter((k) => !(k in sourceFlat));
  for (const k of stale) delete existing[k];
  if (stale.length) console.log(`  清掉 ${stale.length} 个已废弃的键`);

  // 源语言里本就是空串的键（如 lesson.sentenceJoin：中文句子之间不加分隔）
  // 不是"待翻译的文案"而是按语言不同的排版值，送去翻译只会得到空串、被判失败、
  // 无限重试。这类键直接按文字系统给默认值：拉丁等用空格分隔句子，汉字/假名不用。
  for (const [k, v] of Object.entries(sourceFlat)) {
    if (v === "" && existing[k] === undefined) {
      existing[k] = ["ja", "zh"].includes(locale) ? "" : " ";
    }
  }
  const todo = Object.entries(sourceFlat).filter(([k, v]) => v !== "" && !existing[k]);
  if (todo.length === 0) {
    // 没有待译条目时也要落盘：可能只做了上面的废弃键清理
    if (stale.length) {
      writeFileSync(out, `${JSON.stringify(unflatten(existing), null, 2)}\n`, "utf8");
    }
    console.log(`  已全部译好（${Object.keys(sourceFlat).length} 条），跳过`);
    return;
  }
  console.log(`  待译 ${todo.length}/${Object.keys(sourceFlat).length} 条`);
  for (let i = 0; i < todo.length; i += BATCH) {
    const batch = todo.slice(i, i + BATCH);
    const got = await translateBatch(batch, locale);
    for (const [k, v] of Object.entries(got)) existing[k] = normalizeQuotes(v, locale);
    // 每批落盘，中断可续
    writeFileSync(
      out,
      `${JSON.stringify(unflatten(existing), null, 2)}\n`,
      "utf8",
    );
    console.log(`    ${Math.min(i + BATCH, todo.length)}/${todo.length}`);
  }
}

async function main() {
  mkdirSync(MESSAGES, { recursive: true });
  const source = JSON.parse(readFileSync(join(MESSAGES, `${SOURCE_LOCALE}.json`), "utf8"));
  const flat = flatten(source);
  // 界面词条覆盖全部 59 个目标语种（只有 280 条左右，成本很低）；
  // 实验内容等大块内容才按 FULL_LOCALES 分层。--all 显式要求全量，默认仍是主力语种
  const arg = process.argv[2];
  const targets =
    arg === "--all"
      ? LOCALE_CODES.filter((l) => l !== SOURCE_LOCALE)
      : arg
        ? [arg]
        : FULL_LOCALES.filter((l) => l !== SOURCE_LOCALE);
  console.log(`源词条 ${Object.keys(flat).length} 条\n目标语种（${targets.length}）：${targets.join(" ")}\n`);
  const failed = [];
  for (const locale of targets) {
    console.log(`[${localeMeta(locale).englishName}] ${locale}`);
    try {
      await translateLocale(locale, flat);
    } catch (err) {
      console.log(`  ✗ ${err instanceof Error ? err.message : err}`);
      failed.push(locale);
    }
  }
  console.log(failed.length ? `\n有失败：${failed.join(" ")}（重跑可续传）` : "\n全部语种界面词条已生成");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
