// 盐类水解规则：强碱弱酸盐显碱性、强酸弱碱盐显酸性，靠指示剂读出。
//
// 这类实验的全部现象就是「加指示剂后变色」——纯碱溶液滴酚酞变红、氯化铵滴石蕊
// 变红。引擎此前没有「盐 + 指示剂」这条路径，用户点混合毫无反应。
// 水解方向决定 phTrend，3D 层据此给液体染指示剂的对应色。
import { hasAnyFormula, type Reaction } from "./helpers";

/** 指示剂化学式（reagents.ts 里以英文名登记） */
const INDICATORS = ["phenolphthalein", "litmus", "methyl-orange"];

/** 水解显碱性的盐：强碱 + 弱酸根 */
const BASIC_SALTS = [
  "Na2CO3",
  "K2CO3",
  "NaHCO3",
  "CH3COONa",
  "Na2S",
  "Na3PO4",
  "Na2SO3",
  "Na2SiO3",
];

/** 水解显酸性的盐：强酸 + 弱碱阳离子 */
const ACIDIC_SALTS = [
  "NH4Cl",
  "(NH4)2SO4",
  "NH4NO3",
  "AlCl3",
  "Al2(SO4)3",
  "FeCl3",
  "Fe2(SO4)3",
  "CuSO4",
  "ZnCl2",
  "ZnSO4",
];

export const hydrolysisRules: Reaction[] = [
  {
    id: "hydrolysis-basic-salt",
    name: "强碱弱酸盐水解显碱性",
    match: (inputs) =>
      hasAnyFormula(inputs, BASIC_SALTS) && hasAnyFormula(inputs, INDICATORS),
    build: () => ({
      products: [{ formula: "OH-", name: "水解生成的氢氧根", category: "base" }],
      producesGas: false,
      producesPrecipitate: false,
      colorChange: true,
      thermal: "none",
      // PhTrend 只有 increase/decrease/neutral/unknown 四个值，
      // 原先写的 "basic" 不在其中：TS 报错，运行时下游按未知值处理，
      // AI 讲解与 pH 曲线都拿不到"显碱性"这个结论
      phTrend: "increase",
      equation: "CO₃²⁻ + H₂O ⇌ HCO₃⁻ + OH⁻",
      description:
        "弱酸根结合水电离出的氢离子，剩余氢氧根使溶液显碱性，酚酞变红、石蕊变蓝——盐溶液并非都中性。",
    }),
  },
  {
    id: "hydrolysis-acidic-salt",
    name: "强酸弱碱盐水解显酸性",
    match: (inputs) =>
      hasAnyFormula(inputs, ACIDIC_SALTS) && hasAnyFormula(inputs, INDICATORS),
    build: () => ({
      products: [{ formula: "H+", name: "水解生成的氢离子", category: "acid" }],
      producesGas: false,
      producesPrecipitate: false,
      colorChange: true,
      thermal: "none",
      // 同上：原写 "acidic" 不是合法 PhTrend
      phTrend: "decrease",
      equation: "NH₄⁺ + H₂O ⇌ NH₃·H₂O + H⁺",
      description:
        "弱碱阳离子结合水电离出的氢氧根，剩余氢离子使溶液显酸性，石蕊变红、酚酞不变色。",
    }),
  },
];
