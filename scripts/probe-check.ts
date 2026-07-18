// 探针实测工具：输入若干试剂中文名，用反应引擎实测现象，打印可直接粘贴的 expect。
// 用法：npx tsx scripts/probe-check.ts "硫酸铜" "氢氧化钠"
// 引擎是事实来源——先跑此脚本确认现象，再据此写 probe.expect，杜绝手写猜错。
import { resolveSubstance } from "../src/components/lab/reagents";
import { react } from "../src/lib/chem/engine";

const keys = process.argv.slice(2);
if (keys.length === 0) {
  console.error("用法: npx tsx scripts/probe-check.ts <试剂1> <试剂2> ...");
  process.exit(1);
}

const inputs = keys.map(resolveSubstance);
console.log("解析结果:");
for (const s of inputs) {
  const bad = s.category === "other" && s.formula === s.name;
  console.log(`  ${s.name} -> ${s.formula} [${s.category}]${bad ? "  ⚠️未登记" : ""}`);
}

const r = react(inputs);
const expect: Record<string, unknown> = { reacted: r.reacted };
if (r.producesGas) expect.gas = true;
if (r.producesPrecipitate) expect.precipitate = true;
if (r.colorChange) expect.colorChange = true;
if (r.thermal !== "none") expect.thermal = r.thermal;

console.log("\n反应:", r.reacted ? r.equation : "（无反应）");
if (r.reacted) console.log("现象:", r.description);
console.log("\nprobe.expect =", JSON.stringify(expect));
