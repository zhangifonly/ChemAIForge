// 翻译化学术语表：中文术语 → 各语种译名。
//
// 单独于正文之外先翻这一步，见 i18n-terms.mjs 头部的理由（术语是质量地基）。
// 产出 src/lib/i18n/glossary/<locale>.json，之后翻译正文时作为强约束注入，
// 保证同一种物质在 501 个实验里只有一个译名。
//
// API 配置一律走 getClaudeApiConfig()（CC Switch 优先、环境变量兜底），
// 严禁硬编码 Key。
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { getClaudeApiConfig } from "../src/server/ai/config.ts";
import { FULL_LOCALES, localeMeta, SOURCE_LOCALE } from "../src/lib/i18n/locales.ts";
import { voicedLocaleCodes } from "../src/components/lab/lesson/audioKey.ts";
import { extractJson, sliceFirstObject } from "./lib/extractJson.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const GLOSSARY = join(ROOT, "src/lib/i18n/glossary");

/**
 * 每批术语数。
 *
 * 不逐条调用：实测该 provider 会注入大量系统提示，10 个词条的请求
 * input_tokens 就有 4700 —— 逐条翻 321 个词，光固定开销就上百万 token。
 * 也不整批一次发：输出过长时模型容易在末尾丢条目或截断 JSON。
 */
const BATCH = 40;
const MAX_ATTEMPTS = 3;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function translateBatch(terms, locale, kind) {
  const { baseUrl, apiKey, model } = getClaudeApiConfig();
  const target = localeMeta(locale).englishName;
  const noun = kind === "reagents" ? "chemical reagents" : "laboratory apparatus";
  const prompt = [
    `Translate these Chinese ${noun} names used in secondary-school chemistry into ${target}.`,
    "",
    "Rules:",
    `- Use the standard ${target} term a chemistry textbook would use, not a literal gloss.`,
    "- Distinguish oxidation states precisely (e.g. 亚铁 = iron(II)/ferrous, not iron(III)).",
    "- 亚 prefix marks the lower oxidation state; 重 in 重铬酸 marks dichromate, not chromate.",
    "- Keep concentration/state qualifiers (稀 dilute, 浓 concentrated, 饱和 saturated).",
    "- Output ONLY a JSON object mapping each Chinese term to its translation.",
    "- Every input term must appear as a key, spelled exactly as given.",
    "",
    JSON.stringify(terms),
  ].join("\n");

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
      // 缺条目就重试：宁可多花一次调用，也不要静默产出不完整的术语表
      const missing = terms.filter((t) => !map[t]);
      if (missing.length) {
        throw new Error(`缺少 ${missing.length} 条译名：${missing.slice(0, 3).join("、")}…`);
      }
      return map;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (attempt === MAX_ATTEMPTS) throw new Error(`${locale}/${kind} 批次失败：${msg}`);
      console.log(`    第 ${attempt} 次失败（${msg}），退避后重试`);
      await sleep(attempt * 2000);
    }
  }
  throw new Error("unreachable");
}

/** 读已有译文，实现断点续传：中断后重跑只补缺的，不重复付费 */
function loadExisting(locale) {
  const p = join(GLOSSARY, `${locale}.json`);
  if (!existsSync(p)) return { reagents: {}, apparatus: {} };
  try {
    const j = JSON.parse(readFileSync(p, "utf8"));
    return { reagents: j.reagents ?? {}, apparatus: j.apparatus ?? {} };
  } catch {
    // 文件损坏（上次写入中断）当作空的重来，而不是让整个流程崩在这里
    return { reagents: {}, apparatus: {} };
  }
}

async function translateLocale(locale, source) {
  const out = loadExisting(locale);
  for (const kind of ["reagents", "apparatus"]) {
    const all = source[kind].map((x) => x.term);
    const todo = all.filter((t) => !out[kind][t]);
    if (todo.length === 0) {
      console.log(`  ${kind}: 已全部译好（${all.length} 条），跳过`);
      continue;
    }
    console.log(`  ${kind}: 待译 ${todo.length}/${all.length} 条`);
    for (let i = 0; i < todo.length; i += BATCH) {
      const batch = todo.slice(i, i + BATCH);
      const map = await translateBatch(batch, locale, kind);
      Object.assign(out[kind], map);
      // 每批落盘：跑到一半被打断也不丢已完成的部分
      writeFileSync(
        join(GLOSSARY, `${locale}.json`),
        `${JSON.stringify({ locale, ...out }, null, 2)}\n`,
        "utf8",
      );
      console.log(`    ${Math.min(i + BATCH, todo.length)}/${todo.length}`);
    }
  }
}

async function main() {
  const source = JSON.parse(readFileSync(join(GLOSSARY, "terms.json"), "utf8"));
  // 只译 FULL_LOCALES 且跳过源语言：中文术语原文就是译文
  // --voiced：覆盖全部有 edge-tts 音色的语种。只给界面译文而内容回退英文，
  // 讲解就成了"泰语音色念英文"—— 学生听不懂，TTS 形同虚设
  const arg = process.argv[2];
  const targets =
    arg === "--voiced"
      ? voicedLocaleCodes().filter((l) => l !== SOURCE_LOCALE)
      : arg
        ? [arg]
        : FULL_LOCALES.filter((l) => l !== SOURCE_LOCALE);
  console.log(
    `术语表：试剂 ${source.reagents.length} + 仪器 ${source.apparatus.length} 条\n` +
      `目标语种（${targets.length}）：${targets.join(" ")}\n`,
  );
  const failed = [];
  for (const locale of targets) {
    console.log(`[${localeMeta(locale).englishName}] ${locale}`);
    try {
      await translateLocale(locale, source);
    } catch (err) {
      // 单个语种失败不拖垮其余语种，末尾汇总便于重跑
      console.log(`  ✗ ${err instanceof Error ? err.message : err}`);
      failed.push(locale);
    }
  }
  console.log(
    failed.length
      ? `\n完成，但以下语种有失败：${failed.join(" ")}（重跑本脚本会续传）`
      : "\n全部语种术语表已生成",
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
