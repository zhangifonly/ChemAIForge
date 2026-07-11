// 反应速率 / 钟反应规则
// 这两条的匹配条件比 h2o2-decompose（H₂O₂+KI 产气）与 thiosulfate-acid（浑浊）更严格，
// 必须整体排在 extendedReactions 最前面，否则特征现象会被通用规则提前吞掉：
//  - 碘钟含 H₂O₂+KI，会先命中 h2o2-decompose 而只报"产气"；
//  - 碘钟同时含 Na₂S₂O₃+H₂SO₄，也会先命中 thiosulfate-acid 而只报"浑浊"。
import type { Reaction } from "./helpers";
import { hasAllFormulas, hasAnyFormula, hasCategory } from "./helpers";

export const kineticsRules: Reaction[] = [
  {
    id: "iodine-clock",
    name: "碘钟反应",
    // H₂O₂ / KI / 硫代硫酸钠 / 淀粉 四者齐备才是钟反应：
    // 硫代硫酸钠持续把生成的 I₂ 还原掉，耗尽后 I₂ 骤增遇淀粉突然变蓝。
    match: (inputs) =>
      hasAllFormulas(inputs, ["H2O2", "Na2S2O3", "starch"]) &&
      hasAnyFormula(inputs, ["KI", "NaI"]),
    build: () => ({
      products: [
        { formula: "I2", name: "碘", category: "oxidizer" },
        { formula: "Na2S4O6", name: "连四硫酸钠", category: "salt" },
      ],
      producesGas: false,
      producesPrecipitate: false,
      colorChange: true,
      thermal: "none",
      phTrend: "neutral",
      equation: "H₂O₂ + 2I⁻ + 2H⁺ → I₂ + 2H₂O；I₂ + 2S₂O₃²⁻ → 2I⁻ + S₄O₆²⁻",
      description:
        "硫代硫酸钠不断消耗生成的碘，经一段诱导期后其耗尽，碘骤增遇淀粉使溶液突然变蓝。",
    }),
  },
  {
    id: "thiosulfate-acid",
    name: "硫代硫酸钠与酸反应",
    match: (inputs) =>
      hasAnyFormula(inputs, ["Na2S2O3"]) && hasCategory(inputs, "acid"),
    build: () => ({
      products: [
        { formula: "S", name: "硫", category: "other" },
        { formula: "SO2", name: "二氧化硫", category: "gas" },
      ],
      producesGas: true,
      producesPrecipitate: true,
      colorChange: false,
      thermal: "none",
      phTrend: "increase",
      equation: "Na₂S₂O₃ + H₂SO₄ → Na₂SO₄ + S↓ + SO₂↑ + H₂O",
      description:
        "硫代硫酸钠与稀酸反应析出淡黄色硫单质使溶液变浑浊，并放出刺激性二氧化硫；温度越高浑浊出现越快。",
    }),
  },
];
