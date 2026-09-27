// 扫出源码里所有面向用户的中文文案，供逐文件改造时对照。
//
// 只做"列清单"，不自动改写源码：中文文案里混着注释、化学式、正则里的关键词
// （REAGENT_RULES 的匹配键、operations 的仪器正则），自动替换会把逻辑键
// 一起换掉，501 个实验的反应引擎随即失效。清单交人工判断该不该提取。
import { readFileSync, writeFileSync } from "node:fs";
import { globSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CJK = /[一-鿿]/;

/** 去掉注释，避免把开发者注释当成待译文案 */
function stripComments(src) {
  let s = src.replace(/\/\*[\s\S]*?\*\//g, "");
  s = s.replace(/^\s*\/\/.*$/gm, "");
  return s.replace(/(?<=[\s;,)}])\/\/[^\n]*/g, "");
}

/**
 * 不该提取的中文：它们是逻辑键或数据，不是给人读的界面文案。
 * 判据写在这里而不是散落各处，便于审查漏判。
 */
const SKIP_FILES = [
  "src/components/lab/reagentRules.ts", // 试剂匹配关键词表
  "src/data/experiments", // 实验数据（另一条链路处理）
  "src/lib/i18n", // i18n 自身
];

function shouldSkip(rel) {
  return SKIP_FILES.some((p) => rel.startsWith(p)) || rel.includes(".test.");
}

function scanFile(abs, rel) {
  const code = stripComments(readFileSync(abs, "utf8"));
  const hits = [];
  const lines = code.split("\n");
  lines.forEach((line, i) => {
    if (!CJK.test(line)) return;
    // 字符串字面量
    for (const m of line.matchAll(
      /"([^"\n]*[一-鿿][^"\n]*)"|'([^'\n]*[一-鿿][^'\n]*)'|`([^`]*[一-鿿][^`]*)`/g,
    )) {
      hits.push({ line: i + 1, kind: "string", text: m[1] ?? m[2] ?? m[3] });
    }
    // JSX 文本节点（不在引号里的中文）
    for (const m of line.matchAll(/>([^<>{}\n]*[一-鿿][^<>{}\n]*)</g)) {
      const t = m[1].trim();
      if (t) hits.push({ line: i + 1, kind: "jsx", text: t });
    }
  });
  return hits.length ? { file: rel, hits } : null;
}

const files = globSync("src/**/*.{ts,tsx}", { cwd: ROOT });
const report = [];
for (const rel of files.sort()) {
  if (shouldSkip(rel)) continue;
  const r = scanFile(join(ROOT, rel), rel);
  if (r) report.push(r);
}

const total = report.reduce((n, r) => n + r.hits.length, 0);
const out = join(ROOT, "docs/i18n-scan.json");
writeFileSync(out, `${JSON.stringify({ total, files: report }, null, 2)}\n`, "utf8");
console.log(`扫出 ${total} 处中文文案，分布在 ${report.length} 个文件\n清单：${relative(ROOT, out)}`);
for (const r of report.slice(0, 12)) {
  console.log(`  ${r.hits.length.toString().padStart(3)}  ${r.file}`);
}
