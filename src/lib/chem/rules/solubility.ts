// 溶解度表驱动的通用复分解规则
// precipitation.ts 里每条沉淀都要手写一条规则，组合数一多就写不完（阳离子×阴离子）。
// 这里改为"阳离子表 × 阴离子表 × 难溶产物表"三张表相乘，新增一种离子只需登记一次，
// 所有与它相关的沉淀组合自动成立。故本规则排在具体沉淀规则之后作为通用兜底。
import type { Reaction, } from "./helpers";
import type { Substance } from "../engine";

/** 阳离子来源：可溶盐 / 可溶碱的化学式 → 阳离子符号 */
const CATION_SOURCE: Record<string, string> = {
  AgNO3: "Ag+",
  "Ba(NO3)2": "Ba2+", BaCl2: "Ba2+", "Ba(OH)2": "Ba2+",
  CaCl2: "Ca2+", "Ca(NO3)2": "Ca2+", "Ca(OH)2": "Ca2+",
  MgCl2: "Mg2+", MgSO4: "Mg2+", "Mg(NO3)2": "Mg2+",
  CuSO4: "Cu2+", CuCl2: "Cu2+", "Cu(NO3)2": "Cu2+",
  FeCl3: "Fe3+", "Fe2(SO4)3": "Fe3+", "Fe(NO3)3": "Fe3+",
  FeSO4: "Fe2+", FeCl2: "Fe2+", "Fe(NO3)2": "Fe2+",
  ZnSO4: "Zn2+", CoCl2: "Co2+", NiCl2: "Ni2+", "Pb(NO3)2": "Pb2+",
};

/** 阴离子来源：可溶盐 / 强碱的化学式 → 阴离子符号 */
const ANION_SOURCE: Record<string, string> = {
  NaCl: "Cl-", KCl: "Cl-", NH4Cl: "Cl-",
  Na2SO4: "SO42-", K2SO4: "SO42-", "(NH4)2SO4": "SO42-",
  Na2CO3: "CO32-", K2CO3: "CO32-", "(NH4)2CO3": "CO32-", NaHCO3: "CO32-",
  Na2SO3: "SO32-", NaHSO3: "SO32-",
  NaOH: "OH-", KOH: "OH-",
  // 石灰乳 / 氢氧钡也是 OH⁻ 来源（工业上正是用石灰乳从海水沉镁）。
  // 它们同时登记在 CATION_SOURCE 里，规则内已排除「同一物质既当阳离子又当阴离子」
  "Ca(OH)2": "OH-", "Ba(OH)2": "OH-",
  Na2S: "S2-", NaF: "F-",
  KBr: "Br-", NaBr: "Br-", KI: "I-", NaI: "I-",
  Na3PO4: "PO43-",
};

/** 难溶产物表：`阳离子|阴离子` → 产物式、名称、颜色描述（无记录即可溶，不反应） */
const INSOLUBLE: Record<string, { formula: string; name: string; look: string }> = {
  "Ag+|Cl-": { formula: "AgCl", name: "氯化银", look: "白色凝乳状" },
  "Ag+|Br-": { formula: "AgBr", name: "溴化银", look: "浅黄色" },
  "Ag+|I-": { formula: "AgI", name: "碘化银", look: "黄色" },
  "Ag+|CO32-": { formula: "Ag2CO3", name: "碳酸银", look: "白色" },
  "Ag+|SO42-": { formula: "Ag2SO4", name: "硫酸银", look: "白色微溶" },
  "Ag+|S2-": { formula: "Ag2S", name: "硫化银", look: "黑色" },
  "Ag+|PO43-": { formula: "Ag3PO4", name: "磷酸银", look: "黄色" },
  "Ba2+|SO42-": { formula: "BaSO4", name: "硫酸钡", look: "白色不溶于酸" },
  "Ba2+|CO32-": { formula: "BaCO3", name: "碳酸钡", look: "白色可溶于酸" },
  "Ba2+|SO32-": { formula: "BaSO3", name: "亚硫酸钡", look: "白色" },
  "Ba2+|PO43-": { formula: "Ba3(PO4)2", name: "磷酸钡", look: "白色" },
  "Ca2+|CO32-": { formula: "CaCO3", name: "碳酸钙", look: "白色" },
  "Ca2+|SO32-": { formula: "CaSO3", name: "亚硫酸钙", look: "白色" },
  "Ca2+|F-": { formula: "CaF2", name: "氟化钙", look: "白色" },
  "Ca2+|PO43-": { formula: "Ca3(PO4)2", name: "磷酸钙", look: "白色" },
  "Mg2+|OH-": { formula: "Mg(OH)2", name: "氢氧化镁", look: "白色" },
  "Mg2+|CO32-": { formula: "MgCO3", name: "碳酸镁", look: "白色" },
  "Cu2+|OH-": { formula: "Cu(OH)2", name: "氢氧化铜", look: "蓝色絮状" },
  "Cu2+|CO32-": { formula: "Cu2(OH)2CO3", name: "碱式碳酸铜", look: "绿色" },
  "Cu2+|S2-": { formula: "CuS", name: "硫化铜", look: "黑色" },
  "Fe3+|OH-": { formula: "Fe(OH)3", name: "氢氧化铁", look: "红褐色" },
  "Fe2+|OH-": { formula: "Fe(OH)2", name: "氢氧化亚铁", look: "白色（迅速变灰绿）" },
  "Fe2+|S2-": { formula: "FeS", name: "硫化亚铁", look: "黑色" },
  "Fe2+|CO32-": { formula: "FeCO3", name: "碳酸亚铁", look: "白色" },
  "Zn2+|OH-": { formula: "Zn(OH)2", name: "氢氧化锌", look: "白色（溶于过量碱）" },
  "Zn2+|S2-": { formula: "ZnS", name: "硫化锌", look: "白色" },
  "Zn2+|CO32-": { formula: "ZnCO3", name: "碳酸锌", look: "白色" },
  "Co2+|OH-": { formula: "Co(OH)2", name: "氢氧化钴", look: "粉红色" },
  "Ni2+|OH-": { formula: "Ni(OH)2", name: "氢氧化镍", look: "苹果绿色" },
  "Pb2+|I-": { formula: "PbI2", name: "碘化铅", look: "亮黄色（黄金雨）" },
  "Pb2+|Cl-": { formula: "PbCl2", name: "氯化铅", look: "白色（热水中溶解）" },
  "Pb2+|SO42-": { formula: "PbSO4", name: "硫酸铅", look: "白色" },
  "Pb2+|S2-": { formula: "PbS", name: "硫化铅", look: "黑色" },
};

/**
 * 定位一对能生成难溶物的离子组合（同一物质不能同时充当两方）。
 *
 * 必须穷举所有 (阳离子源, 阴离子源) 配对，不能「先取第一个阳离子源、再在余下里找
 * 阴离子源」——像 Ca(OH)₂ / Ba(OH)₂ 这类既在阳离子表又在阴离子表的物质，会把自己
 * 占成阳离子源导致配对失败，使反应判定依赖试剂的添加顺序（氯化镁 + 石灰乳能沉镁，
 * 顺序颠倒却不反应）。反应是否发生与投料顺序无关，这里必须对称。
 *
 * accept 用于在含酸体系里只接受「不溶于稀酸」的那一对：多组离子并存时首个命中
 * 可能是个溶于酸的组合（如碳酸钡），不筛选就会漏掉真正会析出的那对（如硫酸钡），
 * 结果随投料顺序变化。
 */
function findPair(
  inputs: Substance[],
  accept?: (formula: string) => boolean,
) {
  for (const c of inputs) {
    const cationIon = CATION_SOURCE[c.formula];
    if (!cationIon) continue;
    for (const a of inputs) {
      if (a === c) continue;
      const anionIon = ANION_SOURCE[a.formula];
      if (!anionIon) continue;
      const spec = INSOLUBLE[`${cationIon}|${anionIon}`];
      if (spec && (!accept || accept(spec.formula))) {
        return {
          cation: { substance: c, ion: cationIon },
          anion: { substance: a, ion: anionIon },
          spec,
        };
      }
    }
  }
  return null;
}

/** 有色沉淀（生成时肉眼可见颜色变化，而非单纯白色浑浊） */
const COLORED = new Set([
  "Cu(OH)2", "Fe(OH)3", "Fe(OH)2", "CuS", "Ag2S", "FeS", "PbS", "PbI2",
  "AgBr", "AgI", "Ag3PO4", "Co(OH)2", "Ni(OH)2", "Cu2(OH)2CO3",
]);

/**
 * 不溶于稀酸的沉淀：即使体系里有强酸，它们照样析出且不被酸溶解。
 *
 * 「加酸不溶」正是这些沉淀的鉴定价值所在 —— 检验 SO₄²⁻ 要先加盐酸排除碳酸根干扰，
 * 靠的就是 BaSO₄ 不溶于酸；用 Na₂S 沉淀废水里的 Cu²⁺/Pb²⁺ 之所以彻底，
 * 也是因为 CuS/PbS 的 Ksp 小到酸都夺不走 S²⁻。
 *
 * 反过来，碳酸盐、氢氧化物、磷酸盐、亚硫酸盐这类溶于强酸的沉淀不在此表：
 * 含酸时它们不该析出，该让位给产气/中和规则。
 */
const ACID_RESISTANT = new Set([
  "BaSO4", "PbSO4",
  "AgCl", "AgBr", "AgI",
  "CuS", "PbS", "Ag2S", "HgS",
]);

/**
 * match 与 build 共用的配对入口：含酸体系只认不溶于稀酸的沉淀。
 *
 * 两处若各写一份判断，早晚会出现 match 通过而 build 拿到另一对的错位
 * （build 里的 `findPair(inputs)!` 一旦为 null 就直接崩）。
 */
function pickPair(inputs: Substance[]) {
  const acidic = inputs.some((s) => s.category === "acid");
  return findPair(inputs, acidic ? (f) => ACID_RESISTANT.has(f) : undefined);
}

export const solubilityRules: Reaction[] = [
  {
    id: "generic-precipitation",
    name: "复分解生成难溶物",
    // 含酸的体系原则上交给产气/中和规则（碳酸盐 + 酸放气优先），
    // 否则 Na₂CO₃ + HCl 会被误判成沉淀反应。
    //
    // 但「不溶于稀酸」的沉淀是例外：CuS/PbS/BaSO₄ 在酸中照样析出，
    // 原先一律排除含酸体系，导致「硫酸铜 + 硫化钠 + 盐酸」判成完全不反应 ——
    // 而这个实验的核心看点恰恰是黑色 CuS 生成后加酸也不溶
    match: (inputs) => pickPair(inputs) !== null,
    build: (inputs) => {
      const { cation, anion, spec } = pickPair(inputs)!;
      return {
        products: [{ formula: spec.formula, name: spec.name, category: "salt" as const }],
        producesGas: false,
        producesPrecipitate: true,
        colorChange: COLORED.has(spec.formula),
        thermal: "none" as const,
        phTrend: "neutral" as const,
        equation: `${cation.substance.formula} + ${anion.substance.formula} → ${spec.formula}↓`,
        description:
          `${cation.substance.name}与${anion.substance.name}发生复分解，生成${spec.look}的${spec.name}沉淀。` +
          // 含酸时补一句"加酸不溶"：这是抗酸沉淀被用作定性检验的全部理由，
          // 少了它文案与不含酸的情形一字不差，学生看不出这一步在验证什么
          (inputs.some((s) => s.category === "acid")
            ? `加入酸后沉淀不溶解，说明${spec.name}的溶解度极小，这正是它可用于定性检验的依据。`
            : ""),
      };
    },
  },
];
