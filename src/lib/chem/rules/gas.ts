// 产气类反应规则
// 覆盖：碳酸盐/碳酸氢盐 + 酸 → CO₂↑；铵盐 + 碱 → NH₃↑；
// 过氧化氢分解 → O₂↑；活泼金属 + 水 → H₂↑（见 metal 模块）；
// 硫化物 + 酸 → H₂S↑；亚硫酸盐 + 酸 → SO₂↑。
import type { Reaction } from "./helpers";
import { hasAnyFormula, hasCategory, findByCategory } from "./helpers";

export const gasRules: Reaction[] = [
  {
    id: "carbonate-acid",
    name: "碳酸盐与酸反应",
    match: (inputs) =>
      hasCategory(inputs, "carbonate") && hasCategory(inputs, "acid"),
    build: (inputs) => {
      const carb = findByCategory(inputs, "carbonate")!;
      return {
        products: [
          { formula: "CO2", name: "二氧化碳", category: "gas" },
          { formula: "H2O", name: "水", category: "water" },
        ],
        producesGas: true,
        producesPrecipitate: false,
        colorChange: false,
        thermal: "exothermic",
        phTrend: "increase",
        equation: `${carb.formula} + 酸 → 盐 + H₂O + CO₂↑`,
        description: "碳酸盐与酸反应放出无色二氧化碳气体，能使澄清石灰水变浑浊。",
      };
    },
  },
  {
    id: "ammonium-base",
    name: "铵盐与碱反应",
    match: (inputs) =>
      hasAnyFormula(inputs, ["NH4Cl", "(NH4)2SO4", "NH4NO3", "(NH4)2CO3"]) &&
      hasCategory(inputs, "base"),
    build: () => ({
      products: [
        { formula: "NH3", name: "氨气", category: "gas" },
        { formula: "H2O", name: "水", category: "water" },
      ],
      producesGas: true,
      producesPrecipitate: false,
      colorChange: false,
      thermal: "endothermic",
      phTrend: "increase",
      equation: "铵盐 + 碱 → 盐 + H₂O + NH₃↑",
      description: "铵盐与碱共热放出有刺激性气味的氨气，使湿润红色石蕊试纸变蓝。",
    }),
  },
  {
    id: "h2o2-decompose",
    name: "过氧化氢分解",
    match: (inputs) =>
      hasAnyFormula(inputs, ["H2O2"]) &&
      hasAnyFormula(inputs, ["MnO2", "catalyst", "KI", "FeCl3"]),
    build: () => ({
      products: [
        { formula: "O2", name: "氧气", category: "gas" },
        { formula: "H2O", name: "水", category: "water" },
      ],
      producesGas: true,
      producesPrecipitate: false,
      colorChange: false,
      thermal: "exothermic",
      phTrend: "neutral",
      equation: "2H₂O₂ --催化--> 2H₂O + O₂↑",
      description: "过氧化氢在催化剂作用下迅速分解，放出能使带火星木条复燃的氧气。",
    }),
  },
  {
    id: "sulfite-acid",
    name: "亚硫酸盐与酸反应",
    match: (inputs) =>
      hasAnyFormula(inputs, ["Na2SO3", "K2SO3", "NaHSO3"]) &&
      hasCategory(inputs, "acid"),
    build: () => ({
      products: [
        { formula: "SO2", name: "二氧化硫", category: "gas" },
        { formula: "H2O", name: "水", category: "water" },
      ],
      producesGas: true,
      producesPrecipitate: false,
      colorChange: false,
      thermal: "exothermic",
      phTrend: "increase",
      equation: "亚硫酸盐 + 酸 → 盐 + H₂O + SO₂↑",
      description: "亚硫酸盐与酸反应放出有刺激性气味的二氧化硫气体。",
    }),
  },
  {
    id: "sulfide-acid",
    name: "硫化物与酸反应",
    match: (inputs) =>
      hasAnyFormula(inputs, ["FeS", "Na2S", "ZnS"]) &&
      hasCategory(inputs, "acid"),
    build: () => ({
      products: [{ formula: "H2S", name: "硫化氢", category: "gas" }],
      producesGas: true,
      producesPrecipitate: false,
      colorChange: false,
      thermal: "none",
      phTrend: "increase",
      equation: "硫化物 + 酸 → 盐 + H₂S↑",
      description: "硫化物与酸反应放出有臭鸡蛋气味的硫化氢气体。",
    }),
  },
  {
    id: "acidic-oxide-base",
    name: "酸性氧化物与碱反应",
    // CO₂ / SO₂ 等酸性氧化物通入碱液：与石灰水生成沉淀（变浑浊），与可溶强碱被吸收。
    match: (inputs) =>
      hasAnyFormula(inputs, ["CO2", "SO2"]) && hasCategory(inputs, "base"),
    build: (inputs) => {
      const oxide = inputs.find((s) => ["CO2", "SO2"].includes(s.formula))!;
      const lime = hasAnyFormula(inputs, ["Ca(OH)2", "Ba(OH)2"]);
      const isCO2 = oxide.formula === "CO2";
      // 石灰水 / 钡碱：生成难溶的碳酸钙(钡) / 亚硫酸钙(钡) → 变浑浊
      if (lime) {
        const base = inputs.find((s) =>
          ["Ca(OH)2", "Ba(OH)2"].includes(s.formula),
        )!;
        const metal = base.formula.startsWith("Ca") ? "Ca" : "Ba";
        const salt = isCO2 ? `${metal}CO₃` : `${metal}SO₃`;
        return {
          products: [
            { formula: salt, name: isCO2 ? "碳酸盐沉淀" : "亚硫酸盐沉淀", category: "salt" },
            { formula: "H2O", name: "水", category: "water" },
          ],
          producesGas: false,
          producesPrecipitate: true,
          colorChange: false,
          thermal: "none",
          phTrend: "decrease",
          equation: `${oxide.formula} + ${base.formula} → ${salt}↓ + H₂O`,
          description: isCO2
            ? "二氧化碳通入澄清石灰水生成白色碳酸钙沉淀，石灰水变浑浊（CO₂ 的检验）。"
            : "二氧化硫通入石灰水 / 钡碱生成白色亚硫酸盐沉淀，溶液变浑浊。",
        };
      }
      // 可溶强碱（NaOH/KOH）：酸性氧化物被吸收生成盐和水，无明显沉淀
      return {
        products: [
          { formula: isCO2 ? "CO₃²⁻盐" : "SO₃²⁻盐", name: "盐", category: "salt" },
          { formula: "H2O", name: "水", category: "water" },
        ],
        producesGas: false,
        producesPrecipitate: false,
        colorChange: false,
        thermal: "none",
        phTrend: "decrease",
        equation: `${oxide.formula} + 2NaOH → 盐 + H₂O`,
        description: "酸性氧化物被可溶强碱吸收，生成相应的盐和水。",
      };
    },
  },
];
