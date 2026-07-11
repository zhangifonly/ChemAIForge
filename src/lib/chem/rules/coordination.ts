// 配位 / 显色反应规则
// 覆盖：Fe³⁺ + SCN⁻ 血红、Cu²⁺ + 过量氨水深蓝、苯酚 + FeCl₃ 紫色、
// 蛋白质遇浓硝酸变黄、酸碱指示剂变色。
import type { Reaction } from "./helpers";
import { hasAnyFormula, hasCategory } from "./helpers";

export const coordinationRules: Reaction[] = [
  {
    id: "prussian-blue",
    name: "普鲁士蓝（滕氏蓝）生成",
    // Fe²⁺ + 铁氰化钾，或 Fe³⁺ + 亚铁氰化钾，均得同一蓝色沉淀
    match: (inputs) =>
      (hasAnyFormula(inputs, ["FeSO4", "FeCl2"]) &&
        hasAnyFormula(inputs, ["K3[Fe(CN)6]"])) ||
      (hasAnyFormula(inputs, ["FeCl3", "Fe2(SO4)3", "Fe(NO3)3"]) &&
        hasAnyFormula(inputs, ["K4[Fe(CN)6]"])),
    build: () => ({
      products: [
        { formula: "KFe[Fe(CN)6]", name: "普鲁士蓝", category: "salt" },
      ],
      producesGas: false,
      producesPrecipitate: true,
      colorChange: true,
      thermal: "none",
      phTrend: "neutral",
      equation: "Fe²⁺ + [Fe(CN)₆]³⁻ + K⁺ → KFe[Fe(CN)₆]↓（深蓝）",
      description:
        "亚铁离子与铁氰化钾生成深蓝色沉淀普鲁士蓝，可用于铁离子检验，亦是经典颜料。",
    }),
  },
  {
    id: "edta-hardness-titration",
    name: "EDTA 配位滴定（水硬度）",
    // 铬黑T 先与 Ca²⁺/Mg²⁺ 显酒红，EDTA 夺取金属离子后指示剂游离显纯蓝 → 终点
    match: (inputs) =>
      hasAnyFormula(inputs, ["Na2EDTA"]) &&
      hasAnyFormula(inputs, ["CaCl2", "MgCl2", "MgSO4"]) &&
      hasAnyFormula(inputs, ["EBT"]),
    build: () => ({
      products: [
        { formula: "[Ca-EDTA]2-", name: "钙-EDTA 配离子", category: "salt" },
      ],
      producesGas: false,
      producesPrecipitate: false,
      colorChange: true,
      thermal: "none",
      phTrend: "neutral",
      equation: "Ca²⁺ + H₂Y²⁻ → CaY²⁻ + 2H⁺（pH≈10 氨性缓冲）",
      description:
        "EDTA 夺取被铬黑T 络合的钙镁离子，指示剂游离，溶液由酒红色变为纯蓝色，即为滴定终点。",
    }),
  },
  {
    id: "cocl2-equilibrium",
    name: "氯化钴配位平衡",
    match: (inputs) =>
      hasAnyFormula(inputs, ["CoCl2"]) &&
      (hasAnyFormula(inputs, ["HCl"]) || hasCategory(inputs, "water")),
    build: (inputs) => {
      const toBlue = hasAnyFormula(inputs, ["HCl"]);
      return {
        products: [
          toBlue
            ? { formula: "[CoCl4]2-", name: "四氯合钴配离子", category: "salt" as const }
            : { formula: "[Co(H2O)6]2+", name: "六水合钴配离子", category: "salt" as const },
        ],
        producesGas: false,
        producesPrecipitate: false,
        colorChange: true,
        thermal: "none",
        phTrend: "neutral",
        equation: "[Co(H₂O)₆]²⁺ + 4Cl⁻ ⇌ [CoCl₄]²⁻ + 6H₂O",
        description: toBlue
          ? "增大氯离子浓度使平衡右移，溶液由粉红色转为蓝色。"
          : "加水稀释使平衡左移，溶液由蓝色转回粉红色。",
      };
    },
  },
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
        thermal: "none",
        phTrend: basic ? "increase" : "decrease",
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
