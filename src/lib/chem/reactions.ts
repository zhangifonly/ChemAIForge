// 内置示例反应规则集
// 每条规则通过 match 判断输入物质是否满足，satisfied 时返回反应结果

import type { ReactionConditions, ReactionResult, Substance } from "./engine";

/** 一条反应规则 */
export interface Reaction {
  /** 规则唯一标识 */
  id: string;
  /** 反应名称 */
  name: string;
  /** 判断给定输入是否触发该反应 */
  match: (inputs: Substance[]) => boolean;
  /** 生成反应结果（不含 reacted 字段，由引擎补全） */
  build: (
    inputs: Substance[],
    conditions: ReactionConditions
  ) => Omit<ReactionResult, "reacted">;
}

/** 工具：在输入中查找指定类别的物质 */
function findByCategory(
  inputs: Substance[],
  category: Substance["category"]
): Substance | undefined {
  return inputs.find((s) => s.category === category);
}

/** 工具：判断输入是否同时包含两个指定类别 */
function hasCategories(
  inputs: Substance[],
  a: Substance["category"],
  b: Substance["category"]
): boolean {
  return Boolean(findByCategory(inputs, a)) && Boolean(findByCategory(inputs, b));
}

/** 工具：判断是否包含指定化学式 */
function hasFormula(inputs: Substance[], formula: string): boolean {
  return inputs.some((s) => s.formula === formula);
}

/** 规则 1：酸碱中和反应（酸 + 碱 → 盐 + 水，放热） */
const acidBaseNeutralization: Reaction = {
  id: "acid-base-neutralization",
  name: "酸碱中和反应",
  match: (inputs) => hasCategories(inputs, "acid", "base"),
  build: () => ({
    products: [
      { formula: "salt", name: "盐", category: "salt" },
      { formula: "H2O", name: "水", category: "water" },
    ],
    producesGas: false,
    producesPrecipitate: false,
    colorChange: true, // 指示剂/酸碱变化
    thermal: "exothermic",
    phTrend: "neutral",
    equation: "酸 + 碱 → 盐 + 水",
    description: "酸与碱发生中和反应，放出热量，溶液趋于中性。",
  }),
};

/** 规则 2：金属与酸反应（活泼金属 + 酸 → 盐 + 氢气，放热产气） */
const metalAcid: Reaction = {
  id: "metal-acid",
  name: "金属与酸反应",
  match: (inputs) => hasCategories(inputs, "metal", "acid"),
  build: (inputs) => {
    const metal = findByCategory(inputs, "metal")!;
    return {
      products: [
        { formula: `${metal.formula}-salt`, name: "盐", category: "salt" },
        { formula: "H2", name: "氢气", category: "gas" },
      ],
      producesGas: true,
      producesPrecipitate: false,
      colorChange: false,
      thermal: "exothermic",
      phTrend: "increase", // 酸被消耗，pH 上升
      equation: `${metal.formula} + 酸 → 盐 + H2↑`,
      description: "活泼金属与酸反应生成盐并放出氢气，伴有气泡。",
    };
  },
};

/** 规则 3：沉淀反应（如 NaCl + AgNO3 → AgCl↓ + NaNO3） */
const precipitation: Reaction = {
  id: "precipitation-agcl",
  name: "氯化银沉淀反应",
  match: (inputs) =>
    hasFormula(inputs, "AgNO3") &&
    inputs.some((s) => s.formula === "NaCl" || s.formula === "HCl"),
  build: () => ({
    products: [
      { formula: "AgCl", name: "氯化银", category: "salt" },
      { formula: "NaNO3", name: "硝酸钠", category: "salt" },
    ],
    producesGas: false,
    producesPrecipitate: true,
    colorChange: true, // 出现白色沉淀
    thermal: "none",
    phTrend: "neutral",
    equation: "AgNO3 + NaCl → AgCl↓ + NaNO3",
    description: "可溶性氯化物与硝酸银反应，生成白色氯化银沉淀。",
  }),
};

/** 内置反应规则集（按优先级排序） */
export const reactions: Reaction[] = [
  precipitation,
  metalAcid,
  acidBaseNeutralization,
];
