// 内置反应规则集
// 规则按 reactions 数组顺序匹配，命中第一条即返回 —— 特异性强的规则需排在前面。
// 类型 Reaction 与匹配工具函数集中在 ./rules/helpers，扩展规则见 ./rules/*。

import type { Substance } from "./engine";
import { type Reaction, hasCategories, hasFormula } from "./rules/helpers";
import { extendedReactions, indicatorRules } from "./rules";

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
/**
 * 氢后金属：活动性弱于氢，不能置换酸中的氢，与盐酸 / 稀硫酸完全不反应。
 * （它们溶于硝酸 / 热浓硫酸靠的是这些酸的氧化性，已由 metal.ts 专条处理。）
 */
const AFTER_HYDROGEN = ["Cu", "Ag", "Au", "Pt", "Hg"];

/** 体系里是否存在能置换出氢的金属（须穷举，不能只看第一个） */
function findActiveMetal(inputs: Substance[]) {
  return inputs.find(
    (s) => s.category === "metal" && !AFTER_HYDROGEN.includes(s.formula),
  );
}

const metalAcid: Reaction = {
  id: "metal-acid",
  name: "金属与酸反应",
  // 必须排除氢后金属：原先只判"有金属且有酸"，会把「铜 + 稀硫酸」错报为放氢气
  // ——这是金属活动性顺序最基本的结论，也是电解精炼、阳极氧化等实验里
  // 铜/铝与硫酸共存时被错判的根源。
  match: (inputs) =>
    hasCategories(inputs, "metal", "acid") && findActiveMetal(inputs) !== undefined,
  build: (inputs) => {
    const metal = findActiveMetal(inputs)!;
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
  // 指示剂变色必须是全引擎最后一条：判据只是「指示剂 + 酸或碱」，几乎任何
  // 含酸碱的体系都满足。它曾排在 extendedReactions 末尾，看似"最后"，
  // 实则仍在下面两条基础兜底之前 —— 于是「盐酸 + 氢氧化钠 + 酚酞」被判成
  // 纯变色：中和放热没了、pH 趋势从"趋于中性"反转成"变碱"、产物退回反应物；
  // 「锌 + 盐酸 + 石蕊」则连氢气都不产了。加指示剂本是为了观察反应，
  // 反而把反应本身观察没了。指示剂不参与反应，只把酸碱性可视化，
  // 颜色由引擎出口的 withIndicatorColor 统一补，故这里只当"确实没有别的
  // 反应可发生"时的最终兜底。
  ...indicatorRules,
];
