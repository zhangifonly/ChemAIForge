// 沉淀规则（第二组）：过渡金属氢氧化物、铬酸盐、锶/钡的碳酸盐与硫酸盐。
// 这里补齐定性分析里常用的「特征色沉淀」——铬酸银砖红、铬酸铅铬黄、
// 氢氧化镍苹果绿、氢氧化锰白色转褐，都是靠颜色而非白色沉淀来判读离子。
import type { Reaction } from "./helpers";
import { hasAnyFormula } from "./helpers";

/** 表驱动：A 组任一阳离子源 + B 组任一阴离子源 → 特征色沉淀 */
interface PrecipSpec {
  id: string;
  name: string;
  groupA: string[];
  groupB: string[];
  product: { formula: string; name: string };
  color: boolean;
  equation: string;
  description: string;
}

const HYDROXIDE_BASES = ["NaOH", "KOH"];

const SPECS: PrecipSpec[] = [
  {
    id: "precip-nioh2",
    name: "氢氧化镍沉淀",
    groupA: ["NiSO4", "NiCl2"],
    groupB: HYDROXIDE_BASES,
    product: { formula: "Ni(OH)2", name: "氢氧化镍" },
    color: true,
    equation: "Ni²⁺ + 2OH⁻ → Ni(OH)₂↓",
    description: "镍盐与碱生成苹果绿色氢氧化镍沉淀，是镍离子的特征鉴别现象。",
  },
  {
    id: "precip-cooh2",
    name: "氢氧化钴沉淀",
    groupA: ["CoCl2", "CoSO4"],
    groupB: HYDROXIDE_BASES,
    product: { formula: "Co(OH)2", name: "氢氧化钴" },
    color: true,
    equation: "Co²⁺ + 2OH⁻ → Co(OH)₂↓",
    description: "钴盐与碱生成粉红色氢氧化钴沉淀，久置被空气氧化转为褐色。",
  },
  {
    id: "precip-mnoh2",
    name: "氢氧化锰沉淀",
    groupA: ["MnSO4", "MnCl2"],
    groupB: HYDROXIDE_BASES,
    product: { formula: "Mn(OH)2", name: "氢氧化锰" },
    color: true,
    equation: "Mn²⁺ + 2OH⁻ → Mn(OH)₂↓",
    description: "锰盐与碱生成白色氢氧化锰沉淀，接触空气迅速变棕褐，可据此判断锰离子。",
  },
  {
    id: "precip-ag2cro4",
    name: "铬酸银沉淀",
    groupA: ["AgNO3"],
    groupB: ["K2CrO4"],
    product: { formula: "Ag2CrO4", name: "铬酸银" },
    color: true,
    equation: "2Ag⁺ + CrO₄²⁻ → Ag₂CrO₄↓",
    description: "银离子与铬酸根生成砖红色铬酸银沉淀，是莫尔法测氯化物的终点指示。",
  },
  {
    id: "precip-pbcro4",
    name: "铬酸铅沉淀",
    groupA: ["Pb(NO3)2"],
    groupB: ["K2CrO4"],
    product: { formula: "PbCrO4", name: "铬酸铅" },
    color: true,
    equation: "Pb²⁺ + CrO₄²⁻ → PbCrO₄↓",
    description: "铅离子与铬酸根生成亮黄色铬酸铅沉淀，即传统颜料铬黄。",
  },
  {
    id: "precip-bacro4",
    name: "铬酸钡沉淀",
    groupA: ["BaCl2", "Ba(NO3)2"],
    groupB: ["K2CrO4"],
    product: { formula: "BaCrO4", name: "铬酸钡" },
    color: true,
    equation: "Ba²⁺ + CrO₄²⁻ → BaCrO₄↓",
    description: "钡离子与铬酸根生成淡黄色铬酸钡沉淀，可与白色硫酸钡区分。",
  },
  {
    id: "precip-srso4",
    name: "硫酸锶沉淀",
    groupA: ["SrCl2", "Sr(NO3)2"],
    groupB: ["H2SO4", "Na2SO4", "K2SO4"],
    product: { formula: "SrSO4", name: "硫酸锶" },
    color: false,
    equation: "Sr²⁺ + SO₄²⁻ → SrSO₄↓",
    description: "锶离子与硫酸根生成白色硫酸锶沉淀，溶解度介于硫酸钙与硫酸钡之间。",
  },
  {
    id: "precip-srco3",
    name: "碳酸锶沉淀",
    groupA: ["SrCl2", "Sr(NO3)2"],
    groupB: ["Na2CO3", "K2CO3"],
    product: { formula: "SrCO3", name: "碳酸锶" },
    color: false,
    equation: "Sr²⁺ + CO₃²⁻ → SrCO₃↓",
    description: "锶离子与碳酸根生成白色碳酸锶沉淀，可溶于稀酸放出二氧化碳。",
  },
  {
    id: "precip-znoh2",
    name: "氢氧化锌沉淀",
    groupA: ["ZnSO4", "ZnCl2", "Zn(NO3)2"],
    groupB: HYDROXIDE_BASES,
    product: { formula: "Zn(OH)2", name: "氢氧化锌" },
    color: false,
    equation: "Zn²⁺ + 2OH⁻ → Zn(OH)₂↓",
    description: "锌盐与适量碱生成白色氢氧化锌沉淀，碱过量时会两性溶解。",
  },
];

export const precipitation2Rules: Reaction[] = SPECS.map((spec) => ({
  id: spec.id,
  name: spec.name,
  match: (inputs) =>
    hasAnyFormula(inputs, spec.groupA) && hasAnyFormula(inputs, spec.groupB),
  build: () => ({
    products: [{ ...spec.product, name: spec.product.name, category: "base" as const }],
    producesGas: false,
    producesPrecipitate: true,
    colorChange: spec.color,
    thermal: "none" as const,
    phTrend: "neutral" as const,
    equation: spec.equation,
    description: spec.description,
  }),
}));
