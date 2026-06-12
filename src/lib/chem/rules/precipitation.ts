// 沉淀 / 复分解反应规则
// 覆盖常见难溶物生成：BaSO4、CaCO3、Cu(OH)2、Fe(OH)3、AgBr/AgI、Mg(OH)2 等。
// 每条按特定离子组合（化学式）匹配，特异性高，需排在通用规则之前。
import type { Reaction } from "./helpers";
import { hasAnyFormula } from "./helpers";

// 构造一条「双指定组：A 组任一 + B 组任一 → 沉淀」的复分解规则
function precipitate(opts: {
  id: string;
  name: string;
  groupA: string[];
  groupB: string[];
  product: { formula: string; name: string };
  color?: boolean;
  equation: string;
  description: string;
}): Reaction {
  return {
    id: opts.id,
    name: opts.name,
    match: (inputs) =>
      hasAnyFormula(inputs, opts.groupA) && hasAnyFormula(inputs, opts.groupB),
    build: () => ({
      products: [{ ...opts.product, category: "salt" as const }],
      producesGas: false,
      producesPrecipitate: true,
      colorChange: opts.color ?? false,
      thermal: "none",
      phTrend: "neutral",
      equation: opts.equation,
      description: opts.description,
    }),
  };
}

export const precipitationRules: Reaction[] = [
  precipitate({
    id: "precip-baso4",
    name: "硫酸钡沉淀",
    groupA: ["BaCl2", "Ba(NO3)2", "Ba(OH)2"],
    groupB: ["H2SO4", "Na2SO4", "K2SO4", "CuSO4", "ZnSO4", "FeSO4"],
    product: { formula: "BaSO4", name: "硫酸钡" },
    equation: "Ba²⁺ + SO₄²⁻ → BaSO₄↓",
    description: "钡离子与硫酸根结合生成不溶于稀硝酸的白色硫酸钡沉淀。",
  }),
  precipitate({
    id: "precip-caco3",
    name: "碳酸钙沉淀",
    groupA: ["CaCl2", "Ca(OH)2", "Ca(NO3)2"],
    groupB: ["Na2CO3", "K2CO3", "(NH4)2CO3"],
    product: { formula: "CaCO3", name: "碳酸钙" },
    equation: "Ca²⁺ + CO₃²⁻ → CaCO₃↓",
    description: "钙离子与碳酸根结合生成白色碳酸钙沉淀，石灰水变浑浊。",
  }),
  precipitate({
    id: "precip-cuoh2",
    name: "氢氧化铜沉淀",
    groupA: ["CuSO4", "CuCl2", "Cu(NO3)2"],
    groupB: ["NaOH", "KOH", "Ca(OH)2"],
    product: { formula: "Cu(OH)2", name: "氢氧化铜" },
    color: true,
    equation: "Cu²⁺ + 2OH⁻ → Cu(OH)₂↓",
    description: "铜盐与碱反应生成蓝色絮状氢氧化铜沉淀。",
  }),
  precipitate({
    id: "precip-feoh3",
    name: "氢氧化铁沉淀",
    groupA: ["FeCl3", "Fe2(SO4)3", "Fe(NO3)3"],
    groupB: ["NaOH", "KOH"],
    product: { formula: "Fe(OH)3", name: "氢氧化铁" },
    color: true,
    equation: "Fe³⁺ + 3OH⁻ → Fe(OH)₃↓",
    description: "铁(III)盐与碱反应生成红褐色氢氧化铁沉淀。",
  }),
  precipitate({
    id: "precip-feoh2",
    name: "氢氧化亚铁沉淀",
    groupA: ["FeSO4", "FeCl2", "Fe(NO3)2"],
    groupB: ["NaOH", "KOH"],
    product: { formula: "Fe(OH)2", name: "氢氧化亚铁" },
    color: true,
    equation: "Fe²⁺ + 2OH⁻ → Fe(OH)₂↓",
    description: "亚铁盐与碱反应生成白色氢氧化亚铁沉淀，在空气中迅速变灰绿至红褐。",
  }),
  precipitate({
    id: "precip-mgoh2",
    name: "氢氧化镁沉淀",
    groupA: ["MgCl2", "MgSO4", "Mg(NO3)2"],
    groupB: ["NaOH", "KOH"],
    product: { formula: "Mg(OH)2", name: "氢氧化镁" },
    equation: "Mg²⁺ + 2OH⁻ → Mg(OH)₂↓",
    description: "镁盐与碱反应生成白色氢氧化镁沉淀。",
  }),
  precipitate({
    id: "precip-agbr",
    name: "卤化银沉淀",
    groupA: ["AgNO3"],
    groupB: ["KBr", "NaBr", "KI", "NaI"],
    product: { formula: "AgX", name: "卤化银" },
    color: true,
    equation: "Ag⁺ + X⁻ → AgX↓",
    description: "硝酸银与溴/碘化物生成浅黄至黄色卤化银沉淀。",
  }),
];
