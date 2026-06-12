// 内置反应规则集
// 规则按 reactions 数组顺序匹配，命中第一条即返回 —— 特异性强的规则需排在前面。
// 类型 Reaction 与匹配工具函数集中在 ./rules/helpers，扩展规则见 ./rules/*。

import {
  type Reaction,
  findByCategory,
  hasCategories,
  hasFormula,
} from "./rules/helpers";
import { extendedReactions } from "./rules";

export type { Reaction } from "./rules/helpers";

/** 基础规则 1：酸碱中和反应（酸 + 碱 → 盐 + 水，放热） */
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
    colorChange: true,
    thermal: "exothermic",
    phTrend: "neutral",
    equation: "酸 + 碱 → 盐 + 水",
    description: "酸与碱发生中和反应，放出热量，溶液趋于中性。",
  }),
};

/** 基础规则 2：金属与酸反应（活泼金属 + 酸 → 盐 + 氢气，放热产气） */
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
      phTrend: "increase",
      equation: `${metal.formula} + 酸 → 盐 + H2↑`,
      description: "活泼金属与酸反应生成盐并放出氢气，伴有气泡。",
    };
  },
};

/** 基础规则 3：氯化银沉淀反应（AgNO3 + 可溶氯化物 → AgCl↓） */
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
    colorChange: true,
    thermal: "none",
    phTrend: "neutral",
    equation: "AgNO3 + NaCl → AgCl↓ + NaNO3",
    description: "可溶性氯化物与硝酸银反应，生成白色氯化银沉淀。",
  }),
};

/**
 * 内置反应规则集（按优先级排序）。
 * 扩展规则中特异性最强的优先；基础三条作为通用兜底排在其后。
 */
export const reactions: Reaction[] = [
  precipitation,
  ...extendedReactions,
  metalAcid,
  acidBaseNeutralization,
];
