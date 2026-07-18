// 批次审计工具：读取一个 JSON 文件（实验数组），对每个实验做全套闸门预检，
// 并用引擎实测回填建议的 probe.expect。输出问题清单 + 可用的 probe 建议。
// 用法：npx tsx scripts/audit-batch.ts <batch.json>
import { readFileSync } from "node:fs";
import { resolveSubstance } from "../src/components/lab/reagents";
import { react } from "../src/lib/chem/engine";

interface Draft {
  slug: string;
  title: string;
  description: string;
  reagents: string[];
  apparatus: string[];
  objectives: string[];
}

const path = process.argv[2];
if (!path) {
  console.error("用法: npx tsx scripts/audit-batch.ts <batch.json>");
  process.exit(1);
}

const drafts: Draft[] = JSON.parse(readFileSync(path, "utf8"));
const REAGENT_ONLY = ["溶液", "试剂", "缓冲", "指示剂", "标准液"];

let problems = 0;
for (const d of drafts) {
  const issues: string[] = [];

  // 1) 试剂能否解析
  for (const r of d.reagents) {
    if (resolveSubstance(r).formula === r && !r.includes("水")) {
      issues.push(`未登记试剂「${r}」`);
    }
  }
  // 2) apparatus 不得含试剂词
  for (const a of d.apparatus) {
    if (REAGENT_ONLY.some((w) => a.includes(w))) issues.push(`apparatus 含试剂「${a}」`);
  }

  // 3) 引擎实测 → 建议 probe
  const inputs = d.reagents.map(resolveSubstance);
  const r = react(inputs);
  let probeSuggestion = "（无反应，不挂 probe）";
  if (r.reacted) {
    const exp: Record<string, unknown> = { reacted: true };
    if (r.producesGas) exp.gas = true;
    if (r.producesPrecipitate) exp.precipitate = true;
    if (r.colorChange) exp.colorChange = true;
    if (r.thermal !== "none") exp.thermal = r.thermal;
    probeSuggestion = JSON.stringify(exp);
  }

  if (issues.length) {
    problems++;
    console.log(`❌ ${d.slug}: ${issues.join("; ")}`);
  }
  console.log(`   ${d.slug} probe: ${probeSuggestion}`);
}

console.log(`\n共 ${drafts.length} 条，${problems} 条有问题。`);
