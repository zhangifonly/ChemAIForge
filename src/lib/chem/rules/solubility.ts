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

/** 在输入中找出第一个能提供阳离子 / 阴离子的物质及其离子符号 */
function findIon(inputs: Substance[], table: Record<string, string>) {
  for (const s of inputs) {
    const ion = table[s.formula];
    if (ion) return { substance: s, ion };
  }
  return null;
}

/** 定位一对能生成难溶物的离子组合（同一物质不能同时充当两方） */
function findPair(inputs: Substance[]) {
  const cation = findIon(inputs, CATION_SOURCE);
  if (!cation) return null;
  const rest = inputs.filter((s) => s !== cation.substance);
  const anion = findIon(rest, ANION_SOURCE);
  if (!anion) return null;
  const spec = INSOLUBLE[`${cation.ion}|${anion.ion}`];
  return spec ? { cation, anion, spec } : null;
}

/** 有色沉淀（生成时肉眼可见颜色变化，而非单纯白色浑浊） */
const COLORED = new Set([
  "Cu(OH)2", "Fe(OH)3", "Fe(OH)2", "CuS", "Ag2S", "FeS", "PbS", "PbI2",
  "AgBr", "AgI", "Ag3PO4", "Co(OH)2", "Ni(OH)2", "Cu2(OH)2CO3",
]);

export const solubilityRules: Reaction[] = [
  {
    id: "generic-precipitation",
    name: "复分解生成难溶物",
    // 只处理"可溶盐 + 可溶盐/碱"这一路。含酸的体系交给产气规则（碳酸盐+酸放气优先），
    // 否则 Na₂CO₃ + HCl 会被误判成沉淀反应
    match: (inputs) =>
      !inputs.some((s) => s.category === "acid") && findPair(inputs) !== null,
    build: (inputs) => {
      const { cation, anion, spec } = findPair(inputs)!;
      return {
        products: [{ formula: spec.formula, name: spec.name, category: "salt" as const }],
        producesGas: false,
        producesPrecipitate: true,
        colorChange: COLORED.has(spec.formula),
        thermal: "none" as const,
        phTrend: "neutral" as const,
        equation: `${cation.substance.formula} + ${anion.substance.formula} → ${spec.formula}↓`,
        description: `${cation.substance.name}与${anion.substance.name}发生复分解，生成${spec.look}的${spec.name}沉淀。`,
      };
    },
  },
];
