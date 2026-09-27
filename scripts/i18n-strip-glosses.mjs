// 去掉术语译名里的冗余括号注释。
//
// 术语表翻译时模型常附一个括号解释：「金属钾 → potassium (metal)」「水浴 → baño de agua (baño maría)」。
// 这些译名会原样印在试剂瓶签上、念进语音讲解里，括号内容被一字不落地读出来，
// 既啰嗦又常常只是同义词重复。全库 60 语种约 480 条。
//
// 但不是所有括号都该删：
//   - 氧化态「(II)」是物质身份的一部分，硫酸铁(II) 与硫酸铁(III) 是两种东西 —— 保留
//   - 化学式「(FeSO₄)」起消歧作用，多数时候保留无害 —— 保留
//   - 「待测氢氧化钠溶液 → … (to be titrated)」这类括号承载原文里的限定语（"待测"），删了丢义 —— 保留
// 所以不用规则一刀切，而是逐条交给模型判断「删掉括号后是否丢失原文信息」，只删纯冗余的。
//
// 用法：npx tsx scripts/i18n-strip-glosses.mjs [locale]
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { getClaudeApiConfig } from "../src/server/ai/config.ts";
import { localeMeta } from "../src/lib/i18n/locales.ts";
import { extractJson } from "./lib/extractJson.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const GLOSSARY = join(ROOT, "src/lib/i18n/glossary");

/** 带「文字注释」括号的条目：排除氧化态 (II)、纯化学式 (FeSO₄) */
function hasTextGloss(v) {
  return [...v.matchAll(/[（(]([^）)]+)[）)]/g)].some(([, m]) => {
    if (/^[IVX]+$/.test(m)) return false;
    if (/^[A-Za-z₀-₉0-9·⁺⁻²³]+$/.test(m) && /[A-Z]/.test(m)) return false;
    return true;
  });
}

async function judge(items, locale) {
  const { baseUrl, apiKey, model } = getClaudeApiConfig();
  const lang = localeMeta(locale).englishName;
  const prompt = [
    `Each item is a Chinese chemistry term (zh) and its ${lang} name (tr) that ends with a parenthetical gloss.`,
    "These names are printed on reagent bottle labels and read aloud by text-to-speech.",
    "",
    "Decide for each: can the parenthetical be removed WITHOUT losing information present in the Chinese?",
    "- Remove it if it is only a synonym, an alternative name, or a generic category the base name already implies",
    "  (e.g. 'potassium (metal)' when zh is 金属钾 → 'potassium metal' or just keep meaning in the base).",
    "- If the Chinese contains a qualifier that only the parenthetical carries (待测 = to be titrated, 引燃 = for ignition),",
    "  fold that meaning into the base name naturally instead of keeping brackets.",
    "- Keep oxidation states like (II) and chemical formulas untouched.",
    "- The result must read naturally as a label, with no brackets unless they are an oxidation state or formula.",
    'Output ONLY JSON: {"0": "<new name>", ...} keyed by item index, one entry per item.',
    "",
    JSON.stringify(items.map(([zh, tr], i) => ({ i, zh, tr }))),
  ].join("\n");
  const res = await fetch(`${baseUrl}/v1/messages`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model, max_tokens: 4000, messages: [{ role: "user", content: prompt }] }),
  });
  const json = await res.json();
  if (json.error) throw new Error(json.error.message ?? JSON.stringify(json.error));
  return extractJson(json.content?.[0]?.text ?? "");
}

const only = process.argv[2];
const files = readdirSync(GLOSSARY).filter((f) => /^[a-z]{2}\.json$/.test(f) && (!only || f === `${only}.json`));
let changed = 0;
for (const f of files.sort()) {
  const locale = f.slice(0, 2);
  const path = join(GLOSSARY, f);
  const g = JSON.parse(readFileSync(path, "utf8"));
  const todo = [];
  for (const sec of ["reagents", "apparatus"]) {
    for (const [zh, tr] of Object.entries(g[sec])) if (hasTextGloss(tr)) todo.push([sec, zh, tr]);
  }
  if (!todo.length) continue;
  try {
    const out = await judge(todo.map(([, zh, tr]) => [zh, tr]), locale);
    let n = 0;
    todo.forEach(([sec, zh, tr], i) => {
      const v = out[String(i)];
      // 结果仍含文字注释、为空、或与原文完全不相干（长度骤减一半以上）都不采纳
      if (typeof v !== "string" || !v.trim() || hasTextGloss(v) || v.length < tr.length * 0.3) return;
      if (v !== tr) { g[sec][zh] = v.trim(); n++; }
    });
    writeFileSync(path, `${JSON.stringify(g, null, 2)}\n`, "utf8");
    changed += n;
    console.log(`✓ ${locale} 精简 ${n}/${todo.length}`);
  } catch (err) {
    console.log(`✗ ${locale}：${err instanceof Error ? err.message : err}`);
  }
}
console.log(`\n共精简 ${changed} 条`);
