// 过氧化氢的双重性规则
//
// H₂O₂ 中氧为 -1 价，居于 0 与 -2 之间，既能被夺电子（作还原剂，氧化为 O₂），
// 也能夺电子（作氧化剂，还原为 H₂O）。教材把这条"同一试剂两副面孔"当作理解
// 中间价态的样板，两个方向的现象完全不同：
//   还原剂：KMnO₄ 紫红褪去 **同时冒氧气泡** —— 通用「高锰酸钾褪色」规则不产气，
//           会漏掉气泡这个最醒目的观察点，故必须单列且排在它之前。
//   氧化剂：把低价金属推到高价，常与配位/沉淀现象耦合（Co²⁺→Co³⁺、Fe²⁺→Fe³⁺）。
import type { Reaction } from "./helpers";
import { hasAnyFormula, hasCategory } from "./helpers";

/** 被 H₂O₂ 氧化的低价金属离子源 → 氧化产物描述 */
const OXIDIZABLE: Record<string, { product: string; name: string; note: string }> = {
  CoCl2: { product: "Co3+", name: "钴(III)", note: "粉红的 Co²⁺ 被氧化为 Co³⁺" },
  CoSO4: { product: "Co3+", name: "钴(III)", note: "粉红的 Co²⁺ 被氧化为 Co³⁺" },
  "Co(NO3)2": { product: "Co3+", name: "钴(III)", note: "粉红的 Co²⁺ 被氧化为 Co³⁺" },
  FeSO4: { product: "Fe3+", name: "铁(III)", note: "浅绿的 Fe²⁺ 被氧化为棕黄的 Fe³⁺" },
  FeCl2: { product: "Fe3+", name: "铁(III)", note: "浅绿的 Fe²⁺ 被氧化为棕黄的 Fe³⁺" },
};

/** 氨性介质：Co³⁺ 只有被氨配位才稳定存在，否则会把水氧化 */
const AMMONIA = ["NH3", "NH3·H2O", "NH4OH"];

export const peroxideRules: Reaction[] = [
  {
    id: "kmno4-h2o2-oxygen",
    name: "高锰酸钾氧化过氧化氢放氧",
    // 酸性条件是定量前提（中性/碱性会析出 MnO₂ 棕色沉淀而非澄清 Mn²⁺），
    // 但不强制要求酸——无酸时同样褪色放气，只是终点浑浊
    match: (inputs) =>
      hasAnyFormula(inputs, ["KMnO4"]) && hasAnyFormula(inputs, ["H2O2"]),
    build: (inputs) => {
      const acid = hasCategory(inputs, "acid");
      return {
        products: [
          { formula: "O2", name: "氧气", category: "gas" as const },
          { formula: "MnSO4", name: "硫酸锰", category: "salt" as const },
          { formula: "H2O", name: "水", category: "water" as const },
        ],
        producesGas: true,
        producesPrecipitate: false,
        colorChange: true,
        thermal: "exothermic" as const,
        phTrend: "unknown" as const,
        equation: acid
          ? "2KMnO₄ + 5H₂O₂ + 3H₂SO₄ → 2MnSO₄ + K₂SO₄ + 5O₂↑ + 8H₂O"
          : "2MnO₄⁻ + 3H₂O₂ → 2MnO₂↓ + 3O₂↑ + 2OH⁻ + 2H₂O",
        description: acid
          ? "酸性条件下过氧化氢作还原剂，把紫红色高锰酸钾还原为近无色的 Mn²⁺，同时自身被氧化放出氧气 —— 褪色与气泡同时出现是这条反应的标志。"
          : "过氧化氢还原高锰酸钾并放出氧气，但非酸性条件下锰停在 +4 价，生成棕色二氧化锰沉淀使体系浑浊，故定量测定必须加酸。",
      };
    },
  },
  {
    id: "h2o2-oxidize-metal-ion",
    name: "过氧化氢氧化低价金属离子",
    match: (inputs) =>
      hasAnyFormula(inputs, ["H2O2"]) &&
      inputs.some((s) => s.formula in OXIDIZABLE),
    build: (inputs) => {
      const target = inputs.find((s) => s.formula in OXIDIZABLE)!;
      const spec = OXIDIZABLE[target.formula];
      const ammoniacal = hasAnyFormula(inputs, AMMONIA);
      return {
        products: [
          { formula: spec.product, name: spec.name, category: "salt" as const },
          { formula: "H2O", name: "水", category: "water" as const },
        ],
        producesGas: false,
        producesPrecipitate: false,
        colorChange: true,
        thermal: "exothermic" as const,
        phTrend: "unknown" as const,
        equation: ammoniacal
          ? "2[Co(NH₃)₆]²⁺ + H₂O₂ → 2[Co(NH₃)₆]³⁺ + 2OH⁻"
          : `2${target.formula} + H₂O₂ + 2H⁺ → 2${spec.product} + 2H₂O`,
        description: ammoniacal
          ? "氨先与钴(II)配位，过氧化氢再把它氧化为钴(III)：+3 价钴在水中本会分解水，一旦被六个氨牢牢锁住就异常稳定，溶液由粉红转为深棕黄色。"
          : `过氧化氢作氧化剂，${spec.note}，溶液颜色随之改变。`,
      };
    },
  },
];
