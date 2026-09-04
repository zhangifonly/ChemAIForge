// 氧化物专项规则
// 覆盖引擎原先缺失的：过氧化钠 / 氧化钠与水反应、两性氧化物溶于强碱、
// 铝热反应、氢氧化物与碳酸盐的受热分解。
// 与 metal.ts 的「金属氧化物 + 酸」互补——那条只处理酸，这里补齐碱、水与热分解。
import type { Reaction } from "./helpers";
import { hasAnyFormula, hasCategory } from "./helpers";

/**
 * 与水直接化合成碱的碱性氧化物。
 *
 * 只收「对应碱可溶」的：Ca(OH)₂ 微溶但足以使酚酞变红，也算。CuO / Fe₂O₃ 等
 * 对应碱难溶，与水不反应，不能放进来。
 */
const BASIC_OXIDE: Record<string, { product: string; name: string; equation: string }> = {
  Na2O: { product: "NaOH", name: "氢氧化钠", equation: "Na₂O + H₂O → 2NaOH" },
  K2O: { product: "KOH", name: "氢氧化钾", equation: "K₂O + H₂O → 2KOH" },
  BaO: { product: "Ba(OH)2", name: "氢氧化钡", equation: "BaO + H₂O → Ba(OH)₂" },
  CaO: { product: "Ca(OH)2", name: "氢氧化钙", equation: "CaO + H₂O → Ca(OH)₂" },
  Li2O: { product: "LiOH", name: "氢氧化锂", equation: "Li₂O + H₂O → 2LiOH" },
  SrO: { product: "Sr(OH)2", name: "氢氧化锶", equation: "SrO + H₂O → Sr(OH)₂" },
};

/** 两性氧化物 / 氢氧化物溶于强碱生成的偏酸盐 */
const AMPHOTERIC: Record<string, { product: string; name: string; equation: string }> = {
  Al2O3: { product: "NaAlO2", name: "偏铝酸钠", equation: "Al₂O₃ + 2NaOH → 2NaAlO₂ + H₂O" },
  ZnO: { product: "Na2ZnO2", name: "锌酸钠", equation: "ZnO + 2NaOH → Na₂ZnO₂ + H₂O" },
  "Zn(OH)2": { product: "Na2ZnO2", name: "锌酸钠", equation: "Zn(OH)₂ + 2NaOH → Na₂ZnO₂ + 2H₂O" },
};

/** 铝热反应可还原的氧化物：铝的还原性足以夺走其中的氧 */
const THERMITE: Record<string, { metal: string; name: string; equation: string }> = {
  Fe2O3: { metal: "Fe", name: "铁", equation: "2Al + Fe₂O₃ --高温--> 2Fe + Al₂O₃" },
  Fe3O4: { metal: "Fe", name: "铁", equation: "8Al + 3Fe₃O₄ --高温--> 9Fe + 4Al₂O₃" },
  CuO: { metal: "Cu", name: "铜", equation: "2Al + 3CuO --高温--> 3Cu + Al₂O₃" },
  Cr2O3: { metal: "Cr", name: "铬", equation: "2Al + Cr₂O₃ --高温--> 2Cr + Al₂O₃" },
  MnO2: { metal: "Mn", name: "锰", equation: "4Al + 3MnO₂ --高温--> 3Mn + 2Al₂O₃" },
};

export const oxideRules: Reaction[] = [
  {
    id: "sodium-peroxide-water",
    name: "过氧化钠与水反应",
    // 过氧化钠中氧为 -1 价，自身歧化放出氧气（不是氢气！），故必须与
    // 「活泼金属 + 水放 H₂」严格分开——这是供氧剂与潜水面具的原理
    match: (inputs) => hasAnyFormula(inputs, ["Na2O2"]) && hasCategory(inputs, "water"),
    build: () => ({
      products: [
        { formula: "NaOH", name: "氢氧化钠", category: "base" },
        { formula: "O2", name: "氧气", category: "gas" },
      ],
      producesGas: true,
      producesPrecipitate: false,
      colorChange: false,
      thermal: "exothermic",
      phTrend: "increase",
      equation: "2Na₂O₂ + 2H₂O → 4NaOH + O₂↑",
      description:
        "过氧化钠与水剧烈反应放出氧气并放热，溶液呈强碱性；因能供氧，常用于潜水与航天的供氧剂。",
    }),
  },
  {
    id: "sodium-peroxide-co2",
    name: "过氧化钠吸收二氧化碳",
    // 吸收 CO₂ 同时放出 O₂，且体积比 2:1，正好匹配人呼吸的消耗——
    // 这才是它用于密闭舱供氧的关键，比与水反应更实用
    match: (inputs) => hasAnyFormula(inputs, ["Na2O2"]) && hasAnyFormula(inputs, ["CO2"]),
    build: () => ({
      products: [
        { formula: "Na2CO3", name: "碳酸钠", category: "carbonate" },
        { formula: "O2", name: "氧气", category: "gas" },
      ],
      producesGas: true,
      producesPrecipitate: false,
      // 淡黄色的过氧化钠转为白色碳酸钠
      colorChange: true,
      thermal: "exothermic",
      phTrend: "increase",
      equation: "2Na₂O₂ + 2CO₂ → 2Na₂CO₃ + O₂↑",
      description:
        "过氧化钠吸收二氧化碳放出氧气，淡黄色固体变白；吸收与放出的气体体积比 2∶1，恰好用于密闭空间的空气再生。",
    }),
  },
  {
    id: "basic-oxide-water",
    name: "碱性氧化物与水化合",
    // 必须涵盖 CaO：生石灰消化（CaO + H₂O → Ca(OH)₂）放热到能点燃纸张，是最经典的
    // 化合放热实验。漏掉它会落到「溶解放热」规则，打印出化学上不存在的 CaO(aq)。
    match: (inputs) =>
      inputs.some((s) => s.formula in BASIC_OXIDE) && hasCategory(inputs, "water"),
    build: (inputs) => {
      const oxide = inputs.find((s) => s.formula in BASIC_OXIDE)!;
      const spec = BASIC_OXIDE[oxide.formula];
      return {
        products: [
          { formula: spec.product, name: spec.name, category: "base" as const },
        ],
        producesGas: false,
        producesPrecipitate: false,
        colorChange: false,
        thermal: "exothermic" as const,
        phTrend: "increase" as const,
        equation: spec.equation,
        description: `${oxide.name}与水直接化合生成${spec.name}并放出大量热，滴入酚酞立即变红。注意它不放气体。`,
      };
    },
  },
  {
    id: "amphoteric-oxide-base",
    name: "两性氧化物溶于强碱",
    // 氧化铝既溶于酸又溶于碱，是「两性」的定义性证据；引擎原先只有
    // 「金属氧化物 + 酸」，导致氧化铝加氢氧化钠被判为不反应
    match: (inputs) =>
      inputs.some((s) => s.formula in AMPHOTERIC) && hasAnyFormula(inputs, ["NaOH", "KOH"]),
    build: (inputs) => {
      const target = inputs.find((s) => s.formula in AMPHOTERIC)!;
      const spec = AMPHOTERIC[target.formula];
      return {
        products: [
          { formula: spec.product, name: spec.name, category: "salt" as const },
          { formula: "H2O", name: "水", category: "water" as const },
        ],
        producesGas: false,
        producesPrecipitate: false,
        // 白色固体在碱液中逐渐消失、体系由浑浊变澄清，是唯一可见证据
        colorChange: true,
        thermal: "exothermic" as const,
        phTrend: "decrease" as const,
        equation: spec.equation,
        description: `${target.name}兼具酸性氧化物的性质，能溶于强碱生成${spec.name}，白色固体逐渐消失、体系变澄清。`,
      };
    },
  },
  {
    id: "thermite-reaction",
    name: "铝热反应",
    requiresHeat: true,
    // 铝的还原性强且放热极多，能把氧化物中的金属还原为熔融态流出，
    // 用于野外焊接钢轨；引擎原先完全没有固-固高温反应
    match: (inputs) =>
      hasAnyFormula(inputs, ["Al"]) && inputs.some((s) => s.formula in THERMITE),
    build: (inputs) => {
      const oxide = inputs.find((s) => s.formula in THERMITE)!;
      const spec = THERMITE[oxide.formula];
      return {
        products: [
          { formula: spec.metal, name: spec.name, category: "metal" as const },
          { formula: "Al2O3", name: "氧化铝", category: "oxide" as const },
        ],
        producesGas: false,
        producesPrecipitate: false,
        colorChange: true,
        thermal: "exothermic" as const,
        phTrend: "neutral" as const,
        equation: spec.equation,
        description: `铝夺取${oxide.name}中的氧，放出大量热使温度超过 2000 ℃，可见耀眼白光与熔融的${spec.name}流下，冷却得到金属珠。`,
      };
    },
  },
];
