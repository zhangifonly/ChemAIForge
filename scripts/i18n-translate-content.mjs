// 翻译 501 个实验的内容：content/zh.json → content/<locale>.json。
//
// 与界面词条分开：这里是化学知识内容，每条都可能提到试剂与仪器，
// 必须用术语表约束译名 —— 同一种物质在实验标题、描述、目标里只能有一个译法，
// 且要与试剂架上显示的译名一致。
//
// 按实验分批（而非按字段）：一个实验的 title/description/objectives 是一体的，
// 拆开翻译会丢上下文（描述里的"该反应"指的是标题里的反应）。
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { getClaudeApiConfig } from "../src/server/ai/config.ts";
import { FULL_LOCALES, localeMeta, SOURCE_LOCALE } from "../src/lib/i18n/locales.ts";
import { voicedLocaleCodes } from "../src/components/lab/lesson/audioKey.ts";
import { extractJson, sliceFirstObject } from "./lib/extractJson.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CONTENT = join(ROOT, "content");
const GLOSSARY = join(ROOT, "src/lib/i18n/glossary");

/**
 * 每批实验数。
 *
 * 8 个实验约 600 中文字，译文加上 JSON 结构约 2000 token 输出 —— 远低于上限，
 * 留足余量给术语表注入。批次太大时模型容易在末尾丢实验或截断 JSON；
 * 太小则固定开销（该 provider 的系统提示很长）占比过高。
 */
const BATCH = 8;
const MAX_ATTEMPTS = 3;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** 术语表：中文术语 → 该语种译名，供 prompt 约束 */
function loadGlossary(locale) {
  const p = join(GLOSSARY, `${locale}.json`);
  if (!existsSync(p)) return {};
  const g = JSON.parse(readFileSync(p, "utf8"));
  return { ...g.reagents, ...g.apparatus };
}

/** 只注入本批文本里真正出现的术语，避免整张 321 条表挤占上下文 */
function relevantTerms(glossary, batch) {
  const blob = batch
    .map(([, e]) => `${e.title}${e.description}${e.objectives.join("")}`)
    .join("");
  return Object.fromEntries(
    Object.entries(glossary).filter(([zh]) => blob.includes(zh)),
  );
}

async function translateBatch(batch, locale, glossary, depth = 0) {
  const { baseUrl, apiKey, model } = getClaudeApiConfig();
  const target = localeMeta(locale).englishName;
  const terms = relevantTerms(glossary, batch);
  const input = Object.fromEntries(batch);

  const prompt = [
    `Translate this secondary-school chemistry experiment content from Chinese into ${target}.`,
    "",
    "Each entry has: title (short name), description (one or two sentences),",
    "objectives (array of learning goals).",
    "",
    "Rules:",
    "- Keep the JSON shape identical: same keys, objectives stays an array of the same length.",
    "- Use the register of a chemistry textbook, not marketing copy.",
    `- Write natural ${target}; do not translate word by word.`,
    "- Keep formulas, numbers and units verbatim (H2SO4, 0.1 mol/L, 25 ℃, pH).",
    Object.keys(terms).length
      ? `- Use exactly these established chemistry terms: ${JSON.stringify(terms)}`
      : null,
    // 与界面词条脚本同一个坑：德语的上引号与 JSON 定界符同形，会截断输出
    "- For quotation marks use “…” or «…», never the straight ASCII quote.",
    "- Output ONLY the JSON object, no code fence, no commentary.",
    "",
    JSON.stringify(input),
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
      const map = extractJson(text);

      // 结构校验：缺实验、缺字段、objectives 数量不符都要重试。
      // objectives 长度必须一致 —— 页面按索引渲染，少一条就少显示一个学习目标。
      const problems = [];
      for (const [slug, src] of batch) {
        const got = map[slug];
        if (!got) {
          problems.push(`缺 ${slug}`);
          continue;
        }
        if (!got.title || !got.description) problems.push(`${slug} 缺标题或描述`);
        if (!Array.isArray(got.objectives) || got.objectives.length !== src.objectives.length) {
          problems.push(
            `${slug} objectives ${src.objectives.length} → ${got.objectives?.length ?? "无"}`,
          );
        }
      }
      // 只有部分实验出问题时补译那几个，不丢整批（8 个里漏 1 个就作废
      // 等于扔掉另外 7 个已译好的结果）。depth 上限防止反复漏同一条时无限递归。
      if (problems.length) {
        const badSlugs = new Set(problems.map((p) => p.split(/[\s：]/)[0].replace(/^缺/, "")));
        const retry = batch.filter(([slug]) => badSlugs.has(slug));
        if (retry.length === 0 || retry.length === batch.length || depth >= 2) {
          throw new Error(problems.slice(0, 3).join("；"));
        }
        console.log(`    补译 ${retry.length} 个实验`);
        const fixed = await translateBatch(retry, locale, glossary, depth + 1);
        Object.assign(map, fixed);
      }
      // 只收本批要求的 slug：模型偶尔会顺手"补"一个不存在的实验
      // （实测俄语多出过一条 calcium-oxide-water-reaction），照收会污染译文库
      const wanted = new Set(batch.map(([slug]) => slug));
      return Object.fromEntries(Object.entries(map).filter(([slug]) => wanted.has(slug)));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (attempt === MAX_ATTEMPTS) throw new Error(`${locale} 批次失败：${msg}`);
      await sleep(attempt * 2000);
    }
  }
  throw new Error("unreachable");
}

async function translateLocale(locale, source) {
  const out = join(CONTENT, `${locale}.json`);
  const done = existsSync(out) ? JSON.parse(readFileSync(out, "utf8")) : {};
  const glossary = loadGlossary(locale);
  const todo = Object.entries(source).filter(([slug]) => !done[slug]);
  if (todo.length === 0) {
    console.log(`  已全部译好（${Object.keys(source).length} 个实验），跳过`);
    return;
  }
  console.log(`  待译 ${todo.length}/${Object.keys(source).length} 个实验`);
  let failed = 0;
  for (let i = 0; i < todo.length; i += BATCH) {
    const batch = todo.slice(i, i + BATCH);
    try {
      Object.assign(done, await translateBatch(batch, locale, glossary));
    } catch (err) {
      // 单批失败就跳过、继续后面的：501 个实验不该因为一批卡住全停，
      // 重跑脚本会自动补上缺的
      failed += batch.length;
      console.log(`    ✗ 跳过 ${batch.length} 个：${err instanceof Error ? err.message : err}`);
    }
    // 每批落盘，支持断点续传
    writeFileSync(out, `${JSON.stringify(done, null, 2)}\n`, "utf8");
    const at = Math.min(i + BATCH, todo.length);
    if (at % 80 === 0 || at === todo.length) console.log(`    ${at}/${todo.length}`);
  }
  if (failed) console.log(`  ${failed} 个实验未译成，重跑本脚本会续传`);
}

async function main() {
  const source = JSON.parse(readFileSync(join(CONTENT, `${SOURCE_LOCALE}.json`), "utf8"));
  // --voiced：覆盖全部有 edge-tts 音色的语种。只给界面译文而内容回退英文，
  // 讲解就成了"泰语音色念英文"—— 学生听不懂，TTS 形同虚设
  const arg = process.argv[2];
  const targets =
    arg === "--voiced"
      ? voicedLocaleCodes().filter((l) => l !== SOURCE_LOCALE)
      : arg
        ? [arg]
        : FULL_LOCALES.filter((l) => l !== SOURCE_LOCALE);
  console.log(`实验 ${Object.keys(source).length} 个，目标语种（${targets.length}）：${targets.join(" ")}\n`);
  for (const locale of targets) {
    console.log(`[${localeMeta(locale).englishName}] ${locale}`);
    await translateLocale(locale, source);
  }
  console.log("\n完成");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
