// 有机反应规则
// 覆盖中学/大学常见有机特征反应：银镜反应、酯化、醇与钠产氢、
// 苯酚与溴水取代生成沉淀。均按具体化学式匹配，特异性高。
import type { Substance } from "../engine";
import type { Reaction } from "./helpers";
import { hasAnyFormula } from "./helpers";

/** 常见酯类：水解规则共用，新增酯只需在此登记一次 */
const ESTER_FORMULAS = [
  "CH3COOC2H5",
  "CH3COOCH3",
  "HCOOCH3",
  "HCOOC2H5",
  "C6H5COOC2H5",
];

/** 酯化产物表：按 [羧酸, 醇] 组合给出真实的酯 */
const ESTER_MAP: Record<string, { formula: string; name: string; equation: string }> = {
  "CH3COOH+C2H5OH": {
    formula: "CH3COOC2H5",
    name: "乙酸乙酯",
    equation: "CH₃COOH + C₂H₅OH ⇌(浓硫酸,Δ) CH₃COOC₂H₅ + H₂O",
  },
  "CH3COOH+CH3OH": {
    formula: "CH3COOCH3",
    name: "乙酸甲酯",
    equation: "CH₃COOH + CH₃OH ⇌(浓硫酸,Δ) CH₃COOCH₃ + H₂O",
  },
  "HCOOH+CH3OH": {
    formula: "HCOOCH3",
    name: "甲酸甲酯",
    equation: "HCOOH + CH₃OH ⇌(浓硫酸,Δ) HCOOCH₃ + H₂O",
  },
  "HCOOH+C2H5OH": {
    formula: "HCOOC2H5",
    name: "甲酸乙酯",
    equation: "HCOOH + C₂H₅OH ⇌(浓硫酸,Δ) HCOOC₂H₅ + H₂O",
  },
  "C6H5COOH+C2H5OH": {
    formula: "C6H5COOC2H5",
    name: "苯甲酸乙酯",
    equation: "C₆H₅COOH + C₂H₅OH ⇌(浓硫酸,Δ) C₆H₅COOC₂H₅ + H₂O",
  },
  "C2H5COOH+C2H5OH": {
    formula: "C2H5COOC2H5",
    name: "丙酸乙酯",
    equation: "C₂H₅COOH + C₂H₅OH ⇌(浓硫酸,Δ) C₂H₅COOC₂H₅ + H₂O",
  },
  "CH3COOH+C3H7OH": {
    formula: "CH3COOC3H7",
    name: "乙酸丙酯",
    equation: "CH₃COOH + C₃H₇OH ⇌(浓硫酸,Δ) CH₃COOC₃H₇ + H₂O",
  },
  "CH3COOH+C4H9OH": {
    formula: "CH3COOC4H9",
    name: "乙酸丁酯",
    equation: "CH₃COOH + C₄H₉OH ⇌(浓硫酸,Δ) CH₃COOC₄H₉ + H₂O",
  },
};

/** 参与酯化的羧酸与醇（供 pickEster 与 esterification.match 共用） */
const ESTER_ACIDS = ["CH3COOH", "HCOOH", "C6H5COOH", "C2H5COOH"];
const ESTER_ALCOHOLS = ["C2H5OH", "CH3OH", "C3H7OH", "C4H9OH"];

/** 按输入的酸醇组合选出酯；组合不在表内时回退乙酸乙酯（最常见的教学酯） */
function pickEster(inputs: Substance[]) {
  const acid = inputs.find((s) => ESTER_ACIDS.includes(s.formula));
  const alcohol = inputs.find((s) => ESTER_ALCOHOLS.includes(s.formula));
  const key = `${acid?.formula ?? "CH3COOH"}+${alcohol?.formula ?? "C2H5OH"}`;
  return ESTER_MAP[key] ?? ESTER_MAP["CH3COOH+C2H5OH"];
}

export const organicRules: Reaction[] = [
  {
    id: "saponification",
    name: "皂化反应",
    match: (inputs) =>
      hasAnyFormula(inputs, ["fat"]) && hasAnyFormula(inputs, ["NaOH", "KOH"]),
    build: () => ({
      products: [
        { formula: "RCOONa", name: "高级脂肪酸钠（肥皂）", category: "salt" },
        { formula: "C3H8O3", name: "甘油", category: "organic" },
      ],
      producesGas: false,
      producesPrecipitate: false,
      colorChange: false,
      thermal: "none",
      phTrend: "decrease",
      equation: "油脂 + 3NaOH →(加热) 3RCOONa + 甘油",
      description:
        "油脂在碱性条件下加热水解为高级脂肪酸钠与甘油，加食盐盐析后上层析出肥皂。",
    }),
  },
  {
    id: "silver-mirror",
    name: "银镜反应",
    // 直接含醛基的物质可直接银镜；淀粉 / 蔗糖本身不能，须先在酸催化下水解出
    // 葡萄糖（教材做法：水解后用碱中和再加银氨），故这两者额外要求有酸参与
    match: (inputs) => {
      const hasSilverAmmonia =
        hasAnyFormula(inputs, ["AgNO3"]) && hasAnyFormula(inputs, ["NH3·H2O", "NH3"]);
      if (!hasSilverAmmonia) return false;
      if (hasAnyFormula(inputs, ["CH3CHO", "HCHO", "C6H12O6", "HCOOH"])) return true;
      return (
        hasAnyFormula(inputs, ["starch", "C12H22O11"]) &&
        hasAnyFormula(inputs, ["H2SO4", "HCl"])
      );
    },
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
      hasAnyFormula(inputs, ESTER_ACIDS) &&
      hasAnyFormula(inputs, ESTER_ALCOHOLS) &&
      hasAnyFormula(inputs, ["H2SO4"]),
    // 产物必须按实际的酸 / 醇组合推出：甲酸+甲醇是甲酸甲酯，不能一律写成乙酸乙酯，
    // 否则 3D 层拿到错误化学式，油状分层与折射率等外观也就跟着错
    build: (inputs) => {
      const ester = pickEster(inputs);
      return {
        products: [
          { formula: ester.formula, name: ester.name, category: "organic" as const },
          { formula: "H2O", name: "水", category: "water" as const },
        ],
        producesGas: false,
        producesPrecipitate: false,
        // 生成的酯不溶于水，在液面上形成一层无色油状物：这是酯化最直观的证据
        colorChange: true,
        thermal: "none",
        phTrend: "neutral",
        equation: ester.equation,
        description: `羧酸与醇在浓硫酸催化、加热下酯化生成${ester.name}，不溶于水而在液面形成油状层，有果香味。`,
      };
    },
  },
  {
    // 碱性水解（皂化型）：不可逆、更彻底，酯层消失得快，所以与酸性水解分开两条规则
    id: "ester-hydrolysis-base",
    name: "酯的碱性水解",
    match: (inputs) =>
      hasAnyFormula(inputs, ESTER_FORMULAS) && hasAnyFormula(inputs, ["NaOH", "KOH"]),
    build: () => ({
      products: [
        { formula: "CH3COONa", name: "羧酸钠", category: "salt" },
        { formula: "C2H5OH", name: "醇", category: "organic" },
      ],
      producesGas: false,
      producesPrecipitate: false,
      // 上层油状酯层逐渐消失、体系由分层变均一，属于肉眼可见的外观变化
      colorChange: true,
      thermal: "exothermic",
      phTrend: "decrease",
      equation: "CH₃COOC₂H₅ + NaOH --Δ--> CH₃COONa + C₂H₅OH",
      description: "酯在碱性条件下水浴加热水解，反应彻底不可逆，上层酯层迅速消失。",
    }),
  },
  {
    id: "ester-hydrolysis-acid",
    name: "酯的酸性水解",
    match: (inputs) =>
      hasAnyFormula(inputs, ESTER_FORMULAS) && hasAnyFormula(inputs, ["H2SO4", "HCl"]),
    build: () => ({
      products: [
        { formula: "CH3COOH", name: "羧酸", category: "acid" },
        { formula: "C2H5OH", name: "醇", category: "organic" },
      ],
      producesGas: false,
      producesPrecipitate: false,
      colorChange: true,
      thermal: "none",
      phTrend: "decrease",
      equation: "CH₃COOC₂H₅ + H₂O ⇌(稀硫酸,Δ) CH₃COOH + C₂H₅OH",
      description: "酯在稀酸催化下水浴加热水解，反应可逆不彻底，上层酯层逐渐变薄。",
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
  {
    id: "phenol-base",
    name: "苯酚与强碱中和",
    // 排在溴代之后：苯酚 + 溴水 + 碱同时存在时，取代现象更显著，应优先命中
    match: (inputs) =>
      hasAnyFormula(inputs, ["C6H5OH"]) && hasAnyFormula(inputs, ["NaOH", "KOH"]),
    build: () => ({
      products: [
        { formula: "C6H5ONa", name: "苯酚钠", category: "salt" as const },
        { formula: "H2O", name: "水", category: "water" as const },
      ],
      producesGas: false,
      producesPrecipitate: false,
      // 苯酚在水中呈乳浊，生成可溶的苯酚钠后体系变澄清，这是酚羟基弱酸性最直观的证据
      colorChange: true,
      thermal: "exothermic",
      phTrend: "decrease",
      equation: "C₆H₅OH + NaOH → C₆H₅ONa + H₂O",
      description:
        "苯酚具弱酸性，与强碱中和生成可溶的苯酚钠，浑浊的苯酚乳浊液随之变澄清。",
    }),
  },
];
