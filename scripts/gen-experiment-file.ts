// 代码生成器：把审计通过的草案 JSON 转成 ExperimentSeed 数据文件。
// 对每条用反应引擎实测回填 probe（引擎是事实来源），并补 category / 时长。
// 用法：npx tsx scripts/gen-experiment-file.ts <batch.json> <CATEGORY> <exportName> <outFile>
import { readFileSync, writeFileSync } from "node:fs";
import { resolveSubstance } from "../src/components/lab/reagents";
import { react } from "../src/lib/chem/engine";

interface Draft {
  slug: string; title: string; description: string;
  difficulty: string; reagents: string[]; apparatus: string[]; objectives: string[];
}

const [jsonPath, category, exportName, outFile] = process.argv.slice(2);
const drafts: Draft[] = JSON.parse(readFileSync(jsonPath, "utf8"));

// 估算时长：按难度给基准分钟
const MIN: Record<string, number> = { EASY: 20, MEDIUM: 30, HARD: 40 };

function probeLiteral(d: Draft): string {
  const inputs = d.reagents.map(resolveSubstance);
  const r = react(inputs);
  if (!r.reacted) return ""; // 无反应不挂 probe
  const exp: string[] = ["reacted: true"];
  if (r.producesGas) exp.push("gas: true");
  if (r.producesPrecipitate) exp.push("precipitate: true");
  if (r.colorChange) exp.push("colorChange: true");
  if (r.thermal !== "none") exp.push(`thermal: "${r.thermal}"`);
  // 选能反应的试剂作为 reagentKeys：全部试剂里挑非仪器的（这里直接用全部 reagents）
  const keys = d.reagents.map((x) => `"${x}"`).join(", ");
  return `\n    probe: { reagentKeys: [${keys}], expect: { ${exp.join(", ")} } },`;
}

const arr = (s: string[]) => s.map((x) => `"${x}"`).join(", ");

let body = "";
for (const d of drafts) {
  body += `  {
    slug: "${d.slug}",
    title: "${d.title}",
    description: "${d.description}",
    category: C.${category},
    difficulty: D.${d.difficulty},
    reagents: [${arr(d.reagents)}],
    apparatus: [${arr(d.apparatus)}],
    objectives: [${arr(d.objectives)}],
    estimatedMinutes: ${MIN[d.difficulty] ?? 30},${probeLiteral(d)}
  },\n`;
}

const file = `// ${category} 类实验（扩充批次，数据由草案审计+引擎实测 probe 生成）
import {
  ExperimentCategory as C,
  ExperimentDifficulty as D,
} from "@/server/experiment/types";
import type { ExperimentSeed } from "./types";

export const ${exportName}: ExperimentSeed[] = [
${body}];
`;

writeFileSync(outFile, file);
console.log(`已生成 ${outFile}（${drafts.length} 条）`);
