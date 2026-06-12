// 配位 / 显色反应规则
// 覆盖：Fe³⁺ + SCN⁻ 血红、Cu²⁺ + 过量氨水深蓝、苯酚 + FeCl₃ 紫色、
// 蛋白质遇浓硝酸变黄、酸碱指示剂变色。
import type { Reaction } from "./helpers";
import { hasAnyFormula, hasCategory } from "./helpers";

export const coordinationRules: Reaction[] = [
  {
    id: "fe-scn",
    name: "铁(III)与硫氰酸根显色",
    match: (inputs) =>
      hasAnyFormula(inputs, ["FeCl3", "Fe2(SO4)3", "Fe(NO3)3"]) &&
      hasAnyFormula(inputs, ["KSCN", "NaSCN", "NH4SCN"]),
    build: () => ({
      products: [{ formula: "Fe(SCN)3", name: "硫氰化铁", category: "salt" }],
      producesGas: false,
      producesPrecipitate: false,
      colorChange: true,
      thermal: "none",
      phTrend: "neutral",
      equation: "Fe³⁺ + 3SCN⁻ → Fe(SCN)₃（血红色）",
      description: "铁(III)离子与硫氰酸根生成血红色配合物，常用于 Fe³⁺ 的灵敏检验。",
    }),
  },
  {
    id: "cu-ammonia",
    name: "铜氨配离子显色",
    match: (inputs) =>
      hasAnyFormula(inputs, ["CuSO4", "CuCl2", "Cu(NO3)2"]) &&
      hasAnyFormula(inputs, ["NH3·H2O", "NH3"]),
    build: () => ({
      products: [
        { formula: "[Cu(NH3)4]2+", name: "铜氨配离子", category: "salt" },
      ],
      producesGas: false,
      producesPrecipitate: false,
      colorChange: true,
      thermal: "none",
      phTrend: "increase",
      equation: "Cu²⁺ + 4NH₃ → [Cu(NH₃)₄]²⁺（深蓝）",
      description: "铜盐中加入过量氨水，先生成蓝色沉淀后溶解为深蓝色铜氨配离子。",
    }),
  },
  {
    id: "phenol-fecl3",
    name: "苯酚与氯化铁显色",
    match: (inputs) =>
      hasAnyFormula(inputs, ["C6H5OH"]) && hasAnyFormula(inputs, ["FeCl3"]),
    build: () => ({
      products: [{ formula: "complex", name: "铁酚配合物", category: "other" }],
      producesGas: false,
      producesPrecipitate: false,
      colorChange: true,
      thermal: "none",
      phTrend: "neutral",
      equation: "苯酚 + FeCl₃ → 紫色配合物",
      description: "苯酚遇氯化铁溶液显特征紫色，可用于酚羟基的检验。",
    }),
  },
  {
    id: "indicator-acid-base",
    name: "指示剂酸碱变色",
    match: (inputs) =>
      hasCategory(inputs, "indicator") &&
      (hasCategory(inputs, "acid") || hasCategory(inputs, "base")),
    build: (inputs) => {
      const acidic = hasCategory(inputs, "acid");
      return {
        products: inputs,
        producesGas: false,
        producesPrecipitate: false,
        colorChange: true,
        thermal: "none",
        phTrend: acidic ? "decrease" : "increase",
        equation: "指示剂 + 酸/碱 → 变色",
        description: acidic
          ? "指示剂在酸性环境中显特征颜色（如石蕊变红、酚酞无色）。"
          : "指示剂在碱性环境中显特征颜色（如石蕊变蓝、酚酞变红）。",
      };
    },
  },
];
