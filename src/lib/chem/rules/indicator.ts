// 指示剂酸碱变色规则 —— 全引擎最后一条兜底。
//
// 为什么必须排在所有规则之后：判据只是「有指示剂 + 有酸或碱」，几乎任何含酸的
// 体系都满足。它原先住在 coordination.ts 里（注册于中段），于是把一批真实反应
// 截了下来 —— 「二氧化锰 + 浓盐酸 + 石蕊」只报一句"石蕊变红"，制氯气的整个
// 反应没了；凡是加了石蕊/酚酞观察的实验都有同样风险。
//
// 指示剂本身不参与反应，它只是把酸碱性可视化。所以正确的语义是：
// 当体系里确实没有别的反应可发生时，才把"变色"作为唯一现象报出来。
// 排在末位就自然实现了这一点，无须在 match 里枚举所有可能的干扰物。
import type { Reaction } from "./helpers";
import { hasAnyFormula, hasCategory } from "./helpers";

export const indicatorRules: Reaction[] = [
  {
    id: "indicator-acid-base",
    name: "指示剂酸碱变色",
    // 指示剂遇酸/碱，或遇溶于水显酸性的气体(CO₂/SO₂)、氯水(含 HClO)时变色
    match: (inputs) =>
      hasCategory(inputs, "indicator") &&
      (hasCategory(inputs, "acid") ||
        hasCategory(inputs, "base") ||
        hasAnyFormula(inputs, ["CO2", "SO2", "Cl2"])),
    build: (inputs) => {
      const basic = hasCategory(inputs, "base");
      const acidic = !basic; // 酸 / 酸性氧化物 / 氯水 均显酸性
      const bleach = hasAnyFormula(inputs, ["Cl2"]);
      return {
        products: inputs,
        producesGas: false,
        producesPrecipitate: false,
        colorChange: true,
        thermal: "none" as const,
        phTrend: basic ? ("increase" as const) : ("decrease" as const),
        equation: "指示剂 + 酸/碱 → 变色",
        description: bleach
          ? "氯水中的次氯酸先使石蕊变红，随后将其氧化褪色（漂白性）。"
          : acidic
            ? "指示剂在酸性环境中显特征颜色（如石蕊变红、酚酞无色）。"
            : "指示剂在碱性环境中显特征颜色（如石蕊变蓝、酚酞变红）。",
      };
    },
  },
];
