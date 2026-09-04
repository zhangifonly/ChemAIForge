// 溶解与稀释的热效应规则
//
// 这些过程严格说不是化学反应，但在教材里是独立的实验课题（溶解热、稀释放热、
// 溶解度曲线），观察量就是温度计读数的升降。引擎若一律判"未反应"，温度计
// 永远停在 25 ℃，这些实验在 3D 里就成了一杯静止的水。
//
// 放热典型：浓硫酸稀释（水合放热极大）、NaOH 溶解、CaO 遇水。
// 吸热典型：硝酸铵 / 硝酸钾 / 氯化铵溶解（破坏晶格吸热大于水合放热）。
import type { Reaction } from "./helpers";
import { hasAnyFormula, hasFormula } from "./helpers";

/** 溶解显著放热的物质：水合热大于晶格能，无水盐比结晶水合物更明显 */
// ⚠️ 不要把 CaO / Na2O 等碱性氧化物放进来：它们遇水是化合反应（CaO + H₂O →
// Ca(OH)₂），不是溶解，归 oxide.ts 的 basic-oxide-water 处理。
const EXOTHERMIC_SOLUTES = [
  "NaOH", "KOH", "H2SO4", "Na2CO3", "CaCl2", "MgSO4",
  // 无水硫酸铜溶解放热并由白变蓝，是检验乙醇中微量水的经典试剂
  "CuSO4", "AlCl3", "Al2(SO4)3", "MgCl2", "LiCl",
];

/**
 * 适合重结晶提纯的固体：溶解度随温度陡增，冷却时能大量析出。
 * 苯甲酸 / 水杨酸 / 乙酰苯胺是有机实验的经典对象。
 *
 * ⚠️ 不要放 KNO₃：它虽然也靠冷却析晶，但在本目录里承担的是「测溶解度曲线」
 * 实验（看点为温度-溶解度关系，非晶体），放进来会把那条实验的现象换掉。
 */
const RECRYSTALLIZABLE = ["C7H6O3", "C6H5COOH", "C8H9NO"];

/** 溶解显著吸热的物质：晶格能大于水合热，常用于速冷袋 */
const ENDOTHERMIC_SOLUTES = [
  "NH4NO3", "KNO3", "NH4Cl", "Ba(OH)2", "NaHCO3", "Na2S2O3",
  "(NH4)2SO4", "CH3COONa", "KCl", "NaNO3", "Na2SO4", "KBr", "KI",
];

export const dissolutionRules: Reaction[] = [
  {
    // 浓硫酸稀释单列：放热最剧烈（可达沸腾飞溅），也是"酸入水而非水入酸"这条
    // 安全规范的由来，教学上必须与普通溶解区分开
    id: "sulfuric-dilution",
    name: "浓硫酸稀释放热",
    match: (inputs) =>
      hasFormula(inputs, "H2SO4") && hasFormula(inputs, "H2O") && inputs.length === 2,
    build: () => ({
      products: [
        { formula: "H2SO4", name: "稀硫酸", category: "acid" as const },
      ],
      producesGas: false,
      producesPrecipitate: false,
      colorChange: false,
      thermal: "exothermic",
      phTrend: "decrease",
      equation: "H₂SO₄(浓) + H₂O → H₂SO₄(稀)  ΔH < 0",
      description:
        "浓硫酸溶于水强烈放热，温度显著升高。必须把浓硫酸沿器壁缓慢注入水中并不断搅拌，切不可反向操作。",
    }),
  },
  {
    id: "exothermic-dissolution",
    name: "溶解放热",
    match: (inputs) =>
      hasFormula(inputs, "H2O") &&
      hasAnyFormula(inputs, EXOTHERMIC_SOLUTES) &&
      inputs.length === 2,
    build: (inputs) => {
      const solute = inputs.find((s) => EXOTHERMIC_SOLUTES.includes(s.formula))!;
      return {
        products: [{ ...solute, name: `${solute.name}溶液` }],
        producesGas: false,
        producesPrecipitate: false,
        colorChange: false,
        thermal: "exothermic" as const,
        phTrend: "unknown" as const,
        equation: `${solute.formula}(s) --H₂O--> ${solute.formula}(aq)  ΔH < 0`,
        description: `${solute.name}溶于水时水合放出的热量大于破坏晶格吸收的热量，溶液温度升高。`,
      };
    },
  },
  {
    id: "recrystallization",
    name: "重结晶提纯",
    // 重结晶的看点不是温度计，而是「热水里溶清、冷下来析出晶体」这一往复：
    // 溶解度随温度陡增的固体才适用，杂质因量少始终不饱和而留在母液中。
    // 必须排在通用溶解吸热之前，否则只会报一句"温度下降"，看不到晶体
    match: (inputs) =>
      hasFormula(inputs, "H2O") &&
      hasAnyFormula(inputs, RECRYSTALLIZABLE) &&
      inputs.length === 2,
    build: (inputs) => {
      const solute = inputs.find((s) => RECRYSTALLIZABLE.includes(s.formula))!;
      return {
        products: [{ ...solute, name: `${solute.name}晶体` }],
        producesGas: false,
        // 冷却后析出的晶体在 3D 里就是容器底部的固相
        producesPrecipitate: true,
        colorChange: true,
        thermal: "endothermic" as const,
        phTrend: "unknown" as const,
        equation: `${solute.formula}(s) --热H₂O--> 饱和溶液 --冷却--> ${solute.formula}(晶体)↓`,
        description: `${solute.name}的溶解度随温度显著变化：热水中配成饱和溶液后趁热过滤除去不溶杂质，冷却时溶解度骤降而析出较大晶体，可溶杂质因浓度远未饱和留在母液中。这就是重结晶提纯的原理，晶体析出越慢越纯净。`,
      };
    },
  },
  {
    id: "endothermic-dissolution",
    name: "溶解吸热",
    match: (inputs) =>
      hasFormula(inputs, "H2O") &&
      hasAnyFormula(inputs, ENDOTHERMIC_SOLUTES) &&
      inputs.length === 2,
    build: (inputs) => {
      const solute = inputs.find((s) => ENDOTHERMIC_SOLUTES.includes(s.formula))!;
      return {
        products: [{ ...solute, name: `${solute.name}溶液` }],
        producesGas: false,
        producesPrecipitate: false,
        colorChange: false,
        thermal: "endothermic" as const,
        phTrend: "unknown" as const,
        equation: `${solute.formula}(s) --H₂O--> ${solute.formula}(aq)  ΔH > 0`,
        description: `${solute.name}溶于水时破坏晶格吸收的热量大于水合放热，溶液温度明显下降，可制简易冰袋。`,
      };
    },
  },
];
