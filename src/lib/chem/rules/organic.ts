// 有机反应规则
// 覆盖中学/大学常见有机特征反应：银镜反应、酯化、醇与钠产氢、
// 苯酚与溴水取代生成沉淀。均按具体化学式匹配，特异性高。
import type { Reaction } from "./helpers";
import { hasAnyFormula } from "./helpers";

export const organicRules: Reaction[] = [
  {
    id: "silver-mirror",
    name: "银镜反应",
    match: (inputs) =>
      hasAnyFormula(inputs, ["CH3CHO", "HCHO", "C6H12O6", "HCOOH"]) &&
      hasAnyFormula(inputs, ["AgNO3"]) &&
      hasAnyFormula(inputs, ["NH3·H2O", "NH3"]),
    build: () => ({
      products: [{ formula: "Ag", name: "银", category: "metal" }],
      producesGas: false,
      producesPrecipitate: true,
      colorChange: true,
      thermal: "none",
      phTrend: "neutral",
      equation: "RCHO + 2Ag(NH₃)₂OH --Δ--> RCOONH₄ + 2Ag↓ + …",
      description:
        "含醛基物质与银氨溶液水浴加热，银析出附着在管壁形成光亮银镜。",
    }),
  },
  {
    id: "esterification",
    name: "酯化反应",
    match: (inputs) =>
      hasAnyFormula(inputs, ["CH3COOH", "HCOOH"]) &&
      hasAnyFormula(inputs, ["C2H5OH", "CH3OH"]) &&
      hasAnyFormula(inputs, ["H2SO4"]),
    build: () => ({
      products: [
        { formula: "CH3COOC2H5", name: "酯", category: "organic" },
        { formula: "H2O", name: "水", category: "water" },
      ],
      producesGas: false,
      producesPrecipitate: false,
      colorChange: false,
      thermal: "none",
      phTrend: "neutral",
      equation: "CH₃COOH + C₂H₅OH ⇌(浓硫酸,Δ) CH₃COOC₂H₅ + H₂O",
      description: "羧酸与醇在浓硫酸催化、加热下酯化，生成有果香味的酯。",
    }),
  },
  {
    id: "alcohol-sodium",
    name: "醇与钠反应",
    match: (inputs) =>
      hasAnyFormula(inputs, ["C2H5OH", "CH3OH"]) &&
      hasAnyFormula(inputs, ["Na", "K"]),
    build: () => ({
      products: [
        { formula: "C2H5ONa", name: "醇钠", category: "salt" },
        { formula: "H2", name: "氢气", category: "gas" },
      ],
      producesGas: true,
      producesPrecipitate: false,
      colorChange: false,
      thermal: "none",
      phTrend: "neutral",
      equation: "2C₂H₅OH + 2Na → 2C₂H₅ONa + H₂↑",
      description: "钠与乙醇反应放出氢气，比与水反应平缓，体现羟基氢的活泼性。",
    }),
  },
  {
    id: "phenol-bromine",
    name: "苯酚与溴水取代",
    match: (inputs) =>
      hasAnyFormula(inputs, ["C6H5OH"]) && hasAnyFormula(inputs, ["Br2"]),
    build: () => ({
      products: [
        { formula: "C6H2Br3OH", name: "三溴苯酚", category: "organic" },
      ],
      producesGas: false,
      producesPrecipitate: true,
      colorChange: true,
      thermal: "none",
      phTrend: "neutral",
      equation: "C₆H₅OH + 3Br₂ → C₆H₂Br₃OH↓ + 3HBr",
      description: "苯酚与溴水发生取代反应，生成白色三溴苯酚沉淀，溴水褪色。",
    }),
  },
];
