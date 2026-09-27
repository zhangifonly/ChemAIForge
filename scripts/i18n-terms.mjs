// 抽取全库试剂名与仪器名，产出待翻译的术语清单。
//
// 为什么术语要单独成表、先于正文翻译：这 300 多个词是全部译文的质量地基。
// 中学化学里差一个字就是另一种物质 —— 铬酸钾 / 重铬酸钾（差一个氧、氧化性不同）、
// 硫酸亚铁 / 硫酸铁（Ferrous / Ferric）、亚硫酸钠 / 硫酸钠、小苏打 / 苏打。
// 让模型在译长句时顺手翻这些词，错了很难发现；先定死术语表再作为约束注入，
// 译文里这些词就只有一个写法，且可人工校对。
//
// 注意：reagents / apparatus 的中文名同时是引擎的匹配键
// （resolveSubstance 按 150+ 条中文关键词解析化学式，apparatus 被 13 处正则
// 匹配决定操作按钮与 3D 造型），故原文保持中文不动，术语表只供展示层取用。
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { allExperiments } from "../src/data/experiments/index.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "src/lib/i18n/glossary/terms.json");

/** 统计每个词的出现次数：高频词优先人工校对，收益最大 */
function collect() {
  const reagents = new Map();
  const apparatus = new Map();
  const bump = (m, k) => m.set(k, (m.get(k) ?? 0) + 1);
  for (const exp of allExperiments) {
    for (const r of exp.reagents) bump(reagents, r);
    for (const a of exp.apparatus) bump(apparatus, a);
  }
  return { reagents, apparatus };
}

// 按出现次数降序，同次数按字典序，保证输出稳定（便于 diff 审查）
function sorted(m) {
  return [...m.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "zh"))
    .map(([term, count]) => ({ term, count }));
}

const { reagents, apparatus } = collect();
const payload = {
  note: "试剂与仪器的中文术语清单。原文是引擎匹配键，不可改动；译文见 <locale>.json",
  experiments: allExperiments.length,
  reagents: sorted(reagents),
  apparatus: sorted(apparatus),
};
writeFileSync(OUT, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
console.log(
  `术语清单已写入 ${OUT}\n` +
    `  实验 ${allExperiments.length} 个\n` +
    `  试剂 ${reagents.size} 种、仪器 ${apparatus.size} 种，合计 ${reagents.size + apparatus.size} 条`,
);
