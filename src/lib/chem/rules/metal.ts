// 金属相关反应规则
// 覆盖：活泼金属 + 水 → 碱 + H₂↑；金属置换（铁置换铜等）；
// 金属 + 盐溶液置换。注意：金属 + 酸 已由 reactions.ts 基础规则处理。
import type { Reaction } from "./helpers";
import { hasAnyFormula, hasCategory, findByCategory } from "./helpers";

export const metalRules: Reaction[] = [
  {
    id: "iron-fe3-comproportionation",
    name: "铁与铁(III)盐归中反应",
    match: (inputs) =>
      hasAnyFormula(inputs, ["Fe"]) &&
      hasAnyFormula(inputs, ["FeCl3", "Fe2(SO4)3", "Fe(NO3)3"]),
    build: () => ({
      products: [{ formula: "FeCl2", name: "亚铁盐", category: "salt" }],
      producesGas: false,
      producesPrecipitate: false,
      colorChange: true,
      thermal: "exothermic",
      phTrend: "neutral",
      equation: "Fe + 2Fe³⁺ → 3Fe²⁺",
      description: "铁单质把铁(III)还原为铁(II)，棕黄色溶液逐渐变浅绿色。",
    }),
  },
  {
    id: "active-metal-water",
    name: "活泼金属与水反应",
    match: (inputs) =>
      hasAnyFormula(inputs, ["Na", "K", "Ca"]) && hasCategory(inputs, "water"),
    build: (inputs) => {
      const metal = inputs.find((s) => ["Na", "K", "Ca"].includes(s.formula))!;
      return {
        products: [
          { formula: `${metal.formula}OH`, name: "可溶性碱", category: "base" },
          { formula: "H2", name: "氢气", category: "gas" },
        ],
        producesGas: true,
        producesPrecipitate: false,
        colorChange: false,
        thermal: "exothermic",
        phTrend: "increase",
        equation: `2${metal.formula} + 2H₂O → 2${metal.formula}OH + H₂↑`,
        description: "活泼金属与水剧烈反应，放出氢气并生成对应的可溶性强碱。",
      };
    },
  },
  {
    id: "metal-salt-displacement",
    name: "金属置换盐溶液",
    match: (inputs) =>
      hasCategory(inputs, "metal") &&
      hasAnyFormula(inputs, ["CuSO4", "CuCl2", "AgNO3", "Cu(NO3)2", "FeSO4"]),
    build: (inputs) => {
      const metal = findByCategory(inputs, "metal")!;
      return {
        products: [
          { formula: "Cu/Ag", name: "被置换金属", category: "metal" },
          { formula: `${metal.formula}-salt`, name: "新盐", category: "salt" },
        ],
        producesGas: false,
        producesPrecipitate: false,
        colorChange: true,
        thermal: "exothermic",
        phTrend: "neutral",
        equation: `${metal.formula} + 盐 → 新盐 + 金属`,
        description:
          "较活泼金属把较不活泼金属从其盐溶液中置换出来，金属表面附着析出物且溶液颜色变化。",
      };
    },
  },
  {
    id: "metal-oxide-acid",
    name: "金属氧化物与酸反应",
    match: (inputs) => hasCategory(inputs, "oxide") && hasCategory(inputs, "acid"),
    build: () => ({
      products: [
        { formula: "salt", name: "盐", category: "salt" },
        { formula: "H2O", name: "水", category: "water" },
      ],
      producesGas: false,
      producesPrecipitate: false,
      colorChange: true,
      thermal: "exothermic",
      phTrend: "increase",
      equation: "金属氧化物 + 酸 → 盐 + 水",
      description: "金属氧化物与酸反应生成盐和水，如铁锈溶于盐酸使溶液变黄。",
    }),
  },
];
