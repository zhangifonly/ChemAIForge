// 抽取化学引擎实际产出的现象描述，产出 content/phenomena-zh.json。
//
// 为什么按"引擎输出"抽而不按"源码字面量"抽：
//   - 23 个规则文件结构各不相同（规格表驱动、工厂函数、直接字面量都有），
//     逐个改造既易漏又会把化学规则与文案耦合得更紧；
//   - 有 21 处描述是运行时拼接的模板串（把物质名代进模板），源码里根本没有成句；
//   - 实测 472 个探针实验只产出 237 条唯一描述、约 1 万字 —— 因为多条规则共用
//     描述，且部分规则从未被任何实验触发。按输出抽取的量比按源码抽取小得多。
//
// 以描述原文本身作键（而非规则 id）：同一句描述可能来自多条规则，
// 运行时拿到的只有文本，用文本查表最直接，也天然去重。
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { allExperiments } from "../src/data/experiments/index.ts";
import { resolveSubstance } from "../src/components/lab/reagents.ts";
import { react } from "../src/lib/chem/engine.ts";
import { probeConditions } from "../src/data/experiments/probeInput.ts";
import { electrolyze, isElectrolyte } from "../src/lib/chem/electrolysis.ts";
import { galvanicCell, isGalvanicMetal } from "../src/lib/chem/galvanic.ts";
import { conductivity } from "../src/lib/chem/conductivity.ts";
import { safetyNotes, operationHint } from "../src/components/lab/safety.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "content");

const descriptions = new Set();
const observations = new Set();
let probed = 0;

for (const exp of allExperiments) {
  if (!exp.probe) continue;
  const subs = exp.probe.reagentKeys.map(resolveSubstance);
  const r = react(subs, probeConditions(exp));
  probed += 1;
  if (r.description) descriptions.add(r.description);
  // 方程式只收含汉字的那部分：244 条里有 101 条夹着「点燃」「高温」「盐」「不溶解」
  // 「乙炔」这类中文词，外语用户读不懂。纯化学式的那 143 条是国际通用记法，不译
  if (r.equation && /[\u4e00-\u9fff]/.test(r.equation)) descriptions.add(r.equation);
  // 电极现象另有一套文案（电解 / 原电池的两极观察），同样要译
  for (const key of ["cathode", "anode", "negative", "positive"]) {
    const obs = r[key]?.observation;
    if (typeof obs === "string" && obs) observations.add(obs);
  }
}

/**
 * 电化学现象要单独枚举。
 *
 * 探针实验走的是「混合反应」那条路，而电解与原电池靠通电驱动、不产生 ReactionResult，
 * 所以上面那轮一条电极现象也抽不到。这里按全库出现过的电解质与金属组合穷举
 * electrolyze / galvanicCell / conductivity 的输出。
 */
function collectElectro() {
  const elytes = new Set();
  const metals = new Set();
  const substances = new Map();
  for (const exp of allExperiments) {
    for (const label of exp.reagents) {
      const s = resolveSubstance(label);
      if (isElectrolyte(s.formula)) elytes.add(s.formula);
      if (isGalvanicMetal(s.formula)) metals.add(s.formula);
      substances.set(s.formula, s);
    }
  }
  // 惰性与活性阳极给出不同的阳极现象，两种都要覆盖
  for (const el of elytes) {
    for (const inertAnode of [true, false]) {
      const r = electrolyze(el, { inertAnode });
      if (r?.cathode?.observation) observations.add(r.cathode.observation);
      if (r?.anode?.observation) observations.add(r.anode.observation);
      if (r?.overall) descriptions.add(r.overall);
    }
  }
  // 两金属两两组合（含单金属的腐蚀情形），配酸性与中性两种电解液
  const list = [...metals];
  const liquids = [
    { formula: "H2SO4", name: "硫酸", category: "acid" },
    { formula: "NaCl", name: "食盐水", category: "salt" },
  ];
  for (const a of list) {
    for (const b of list) {
      for (const liquid of liquids) {
        const r = galvanicCell(a === b ? [a] : [a, b], liquid);
        if (r?.negative?.observation) observations.add(r.negative.observation);
        if (r?.positive?.observation) observations.add(r.positive.observation);
        if (r?.electronFlow) descriptions.add(r.electronFlow);
      }
    }
  }
  for (const s of substances.values()) {
    const c = conductivity(s);
    if (c?.note) descriptions.add(c.note);
  }
}

collectElectro();

/**
 * 安全提醒与操作提示。
 *
 * 和现象描述同属"引擎按试剂算出来的文本"，走同一条查表链路。
 * 它们尤其不能漏译：一个只读阿拉伯语的学生看不懂"须在通风橱中操作"，
 * 安全提醒就等于没有。
 */
function collectSafety() {
  for (const exp of allExperiments) {
    const subs = exp.reagents.map(resolveSubstance);
    for (const note of safetyNotes(subs)) descriptions.add(note);
    const hint = operationHint(subs, null);
    if (hint) descriptions.add(hint);
  }
}

collectSafety();

const payload = {
  note: "引擎产出的现象描述、安全提醒与含汉字的方程式，以中文原文为键。纯化学式方程式不在此列。",
  descriptions: [...descriptions].sort(),
  observations: [...observations].sort(),
};

mkdirSync(OUT, { recursive: true });
writeFileSync(
  join(OUT, "phenomena-zh.json"),
  `${JSON.stringify(payload, null, 2)}\n`,
  "utf8",
);

const chars = [...descriptions, ...observations].join("").length;
console.log(
  `探针实验 ${probed} 个\n` +
    `  现象描述 ${descriptions.size} 条、电极现象 ${observations.size} 条\n` +
    `  合计约 ${chars.toLocaleString()} 字 → content/phenomena-zh.json`,
);
