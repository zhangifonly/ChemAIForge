// 抽取实验内容的可译字段，产出 content/zh.json。
//
// 只抽 title / description / objectives 三个字段：
//   - reagents / apparatus 是引擎的匹配键（resolveSubstance 按中文关键词解析化学式、
//     13 处正则按仪器名决定操作按钮与 3D 造型），翻译它们会让 501 个实验全部失效。
//     这两个字段的展示译名走术语表（glossary/<locale>.json），不进这里。
//   - category / difficulty 是枚举，走界面词条。
//   - probe 是测试用的探针数据，不面向用户。
//
// 按 slug 组织而不是按文件：实验数据分散在 38 个文件里，但 slug 是全局唯一的
// 稳定标识，加实验、挪文件都不影响已有译文。
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { allExperiments } from "../src/data/experiments/index.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "content");

const payload = {};
for (const exp of allExperiments) {
  payload[exp.slug] = {
    title: exp.title,
    description: exp.description,
    objectives: exp.objectives,
  };
}

mkdirSync(OUT, { recursive: true });
writeFileSync(join(OUT, "zh.json"), `${JSON.stringify(payload, null, 2)}\n`, "utf8");

const chars = Object.values(payload).reduce(
  (n, e) => n + e.title.length + e.description.length + e.objectives.join("").length,
  0,
);
console.log(
  `已抽取 ${Object.keys(payload).length} 个实验的可译字段 → content/zh.json\n` +
    `  合计约 ${chars.toLocaleString()} 字（title + description + objectives）`,
);
