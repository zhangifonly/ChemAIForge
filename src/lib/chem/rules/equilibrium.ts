// 化学平衡移动规则
//
// 可逆体系本身不"反应完"，观察量是外界条件（温度、压强、浓度）改变时颜色的深浅
// 往复变化。引擎若判"未反应"，密封球管与注射器在 3D 里就毫无内容 —— 而这恰是
// 勒夏特列原理唯一的直观证据。
//
// 判据是「体系里同时存在同一平衡的两侧物种」：这比"某物质在场"严格得多，
// 不会误伤单独使用 NO₂（如铜与浓硝酸产气）的场景。
import type { Reaction } from "./helpers";
import { hasAllFormulas, hasAnyFormula, hasCategory } from "./helpers";

/**
 * 会把铬(VI)真正还原到 Cr³⁺ 的物质：它们在场时是氧化还原（橙→绿，不可逆），
 * 不是黄橙互变，须让位于 redox.ts 的重铬酸钾规则。
 */
const REDUCERS = [
  "H2C2O4", "Na2SO3", "NaHSO3", "FeSO4", "FeCl2", "C2H5OH",
  "SO2", "KI", "NaI", "H2S", "Na2S", "H2O2",
];

/** 平衡体系：两侧物种齐备时才认定为"可逆平衡演示" */
type EquilibriumSpec = {
  id: string;
  name: string;
  /** 必须同时在场的两侧物种 */
  species: string[];
  equation: string;
  description: string;
};

const SPECS: EquilibriumSpec[] = [
  {
    id: "no2-n2o4-equilibrium",
    name: "二氧化氮与四氧化二氮的平衡",
    species: ["NO2", "N2O4"],
    equation: "2NO₂(红棕) ⇌ N₂O₄(无色)　ΔH < 0",
    description:
      "正反应放热且气体分子数减少，故升温使平衡左移、颜色变深，降温则变浅；加压体积缩小时瞬时颜色先变深（浓度增大），随后平衡右移又变浅，最终比原来深。同一支密封管在冷热水中来回浸泡即可看到红棕色反复深浅，这是勒夏特列原理最直观的证据。",
  },
  {
    id: "cobalt-chloride-equilibrium",
    name: "钴配离子的水合平衡",
    species: ["CoCl2", "HCl"],
    equation: "[Co(H₂O)₆]²⁺(粉红) + 4Cl⁻ ⇌ [CoCl₄]²⁻(蓝) + 6H₂O　ΔH > 0",
    description:
      "正反应吸热，升温或增大氯离子浓度使平衡右移变蓝，加水稀释或降温则回到粉红。因其颜色随湿度可逆变化，常用于变色硅胶指示剂。",
  },
];

/**
 * 铬(VI)的黄橙互变。
 *
 * 判据与上面两条不同：不要求两侧物种齐备，只要「铬(VI)盐 + 酸或碱」即成立
 * ——实验室做的正是往重铬酸钾里交替滴加碱和酸看颜色往复。若不单列，这个体系
 * 会落到通用「酸 + 碱 → 盐 + 水」规则，铬的颜色变化这个唯一看点就被吞掉。
 *
 * 注意与「重铬酸钾氧化还原剂」的区别：那里铬从 +6 降到 +3（橙变绿，不可逆），
 * 这里铬始终 +6 价（黄橙互变，可逆）。故本条必须让位于 redox 的还原剂判定，
 * 即体系含还原剂时不应命中——靠 index.ts 的排序保证 redoxRules 在前无法实现
 * （equilibrium 排在最前），因此在 match 里显式排除还原剂。
 */
const chromiumColorStates: Reaction = {
  id: "chromium-vi-color-states",
  name: "铬(VI)的黄橙互变",
  match: (inputs) =>
    hasAnyFormula(inputs, ["K2Cr2O7", "K2CrO4", "Na2Cr2O7", "Na2CrO4"]) &&
    (hasCategory(inputs, "acid") || hasCategory(inputs, "base")) &&
    !hasCategory(inputs, "reducer") &&
    !hasAnyFormula(inputs, REDUCERS),
  build: () => ({
    products: [
      { formula: "CrO4^2-", name: "铬酸根（黄）", category: "salt" as const },
      { formula: "Cr2O7^2-", name: "重铬酸根（橙）", category: "salt" as const },
    ],
    producesGas: false,
    producesPrecipitate: false,
    colorChange: true,
    thermal: "none" as const,
    phTrend: "unknown" as const,
    equation: "2CrO₄²⁻(黄) + 2H⁺ ⇌ Cr₂O₇²⁻(橙) + H₂O",
    description:
      "加酸使平衡右移显橙色，加碱则左移显黄色，反复滴加可看到颜色往复。铬在全过程始终是 +6 价，故这是平衡移动而非氧化还原 —— 与「重铬酸钾遇还原剂由橙变绿（Cr³⁺）」的不可逆变化必须区分开，这正是本实验要辨明的核心。",
  }),
};

export const equilibriumRules: Reaction[] = [chromiumColorStates].concat(SPECS.map((spec) => ({
  id: spec.id,
  name: spec.name,
  match: (inputs) => hasAllFormulas(inputs, spec.species),
  build: () => ({
    products: spec.species.map((f) => ({
      formula: f,
      name: "平衡体系组分",
      category: "other" as const,
    })),
    producesGas: false,
    producesPrecipitate: false,
    // 唯一看点就是颜色深浅的往复变化
    colorChange: true,
    // 平衡本身无净热效应（正逆抵消），受热是外界施加而非反应放出
    thermal: "none" as const,
    phTrend: "unknown" as const,
    equation: spec.equation,
    description: spec.description,
  }),
})));
