// 氧化还原反应规则
// 覆盖：高锰酸钾褪色、溴水/碘水褪色、卤素置换、碘遇淀粉变蓝、
// 铁离子与硫氰酸盐显红（归入配位但氧化态相关时也可触发）、电池/置换见 metal。
import type { Reaction } from "./helpers";
import type { Substance } from "../engine";
import { hasAnyFormula, hasCategory } from "./helpers";

/** 卤素单质氧化性由强到弱，下标越小越强 */
const HALOGEN_ORDER = ["F2", "Cl2", "Br2", "I2"];

/** 卤化物盐 → 其卤素单质 + 阳离子，用于推出置换产物 */
const HALIDE_SALT: Record<string, { halogen: "Cl2" | "Br2" | "I2"; cation: string }> = {
  NaCl: { halogen: "Cl2", cation: "Na" },
  KCl: { halogen: "Cl2", cation: "K" },
  NaBr: { halogen: "Br2", cation: "Na" },
  KBr: { halogen: "Br2", cation: "K" },
  NaI: { halogen: "I2", cation: "Na" },
  KI: { halogen: "I2", cation: "K" },
};

const HALOGEN_NAME: Record<string, string> = { Cl2: "氯", Br2: "溴", I2: "碘" };
/** 被置换出的卤素单质进入水相后的可见颜色变化 */
const FREED_LOOK: Record<string, string> = {
  Cl2: "呈黄绿色",
  Br2: "由无色变为橙黄色",
  I2: "由无色变为棕黄色（加淀粉显蓝）",
};

/**
 * 找出「强卤素 + 弱卤素的盐」这一对，返回实际产物与方程。
 * 找不到（如碘水加氯化钠，氧化性反了）时返回 null，表示不反应。
 */
function findHalogenPair(inputs: Substance[]) {
  for (const ox of inputs) {
    const oxRank = HALOGEN_ORDER.indexOf(ox.formula);
    if (oxRank < 0) continue;
    for (const salt of inputs) {
      const spec = HALIDE_SALT[salt.formula];
      if (!spec) continue;
      // 弱者才能被置换：单质排在盐对应卤素之前（氧化性更强）
      if (oxRank >= HALOGEN_ORDER.indexOf(spec.halogen)) continue;
      const newSalt = `${spec.cation}${ox.formula.replace("2", "")}`;
      return {
        freed: spec.halogen,
        freedName: `${HALOGEN_NAME[spec.halogen]}单质`,
        oxidantName: `${HALOGEN_NAME[ox.formula]}单质`,
        newSalt,
        look: FREED_LOOK[spec.halogen],
        equation: `${ox.formula} + 2${salt.formula} → 2${newSalt} + ${spec.halogen}`,
      };
    }
  }
  return null;
}

export const redoxRules: Reaction[] = [
  {
    id: "kmno4-decolor",
    name: "高锰酸钾氧化褪色",
    match: (inputs) =>
      hasAnyFormula(inputs, ["KMnO4"]) &&
      (hasCategory(inputs, "reducer") ||
        hasAnyFormula(inputs, [
          "H2C2O4", "Na2SO3", "NaHSO3", "FeSO4", "FeCl2",
          "C2H5OH", "C2H4", "CH3CHO", "SO2", "KI", "NaI",
        ])),
    build: () => ({
      products: [{ formula: "Mn2+", name: "锰(II)离子", category: "salt" }],
      producesGas: false,
      producesPrecipitate: false,
      colorChange: true,
      thermal: "exothermic",
      phTrend: "unknown",
      equation: "MnO₄⁻ + 还原剂 → Mn²⁺ + …（紫红褪去）",
      description: "高锰酸钾被还原，紫红色逐渐褪去，体现其强氧化性。",
    }),
  },
  {
    id: "bromine-water-decolor",
    name: "溴水 / 碘水褪色",
    match: (inputs) =>
      hasAnyFormula(inputs, ["Br2", "I2"]) &&
      (hasCategory(inputs, "reducer") ||
        hasAnyFormula(inputs, ["SO2", "Na2SO3", "C2H4", "NaOH", "Fe"])),
    build: () => ({
      products: [{ formula: "X-", name: "卤离子", category: "salt" }],
      producesGas: false,
      producesPrecipitate: false,
      colorChange: true,
      thermal: "none",
      phTrend: "unknown",
      equation: "Br₂ / I₂ + 还原剂 → 无色卤离子",
      description: "溴水或碘水被还原剂还原，橙黄 / 棕黄色褪去。",
    }),
  },
  {
    id: "halogen-displacement",
    name: "卤素置换反应",
    // 氧化性 Cl₂ > Br₂ > I₂：只有强者才能置换弱者，故须按实际组合判断，
    // 不能一律套 Cl₂ + KBr——溴水加碘化钾、氯水加溴化钠的产物与颜色都不同
    match: (inputs) => findHalogenPair(inputs) !== null,
    build: (inputs) => {
      const pair = findHalogenPair(inputs)!;
      return {
        products: [
          { formula: pair.freed, name: pair.freedName, category: "other" as const },
          { formula: pair.newSalt, name: "新卤化物", category: "salt" as const },
        ],
        producesGas: false,
        producesPrecipitate: false,
        colorChange: true,
        thermal: "exothermic",
        phTrend: "neutral",
        equation: pair.equation,
        description: `氧化性较强的${pair.oxidantName}把${pair.freedName}从其盐溶液中置换出来，溶液${pair.look}。`,
      };
    },
  },
  {
    id: "iodine-starch",
    name: "碘遇淀粉变蓝",
    match: (inputs) =>
      hasAnyFormula(inputs, ["I2"]) && hasAnyFormula(inputs, ["starch"]),
    build: () => ({
      products: [{ formula: "I2-starch", name: "碘-淀粉络合物", category: "other" }],
      producesGas: false,
      producesPrecipitate: false,
      colorChange: true,
      thermal: "none",
      phTrend: "neutral",
      equation: "I₂ + 淀粉 → 蓝色络合物",
      description: "碘单质遇淀粉显特征蓝色，常用于碘的检验与碘量法终点判断。",
    }),
  },
  {
    id: "dichromate-reduction",
    name: "重铬酸钾氧化还原剂",
    // 酸性重铬酸钾把还原剂氧化，自身由橙黄的 Cr₂O₇²⁻ 变为绿色的 Cr³⁺，
    // 这一橙→绿的变色正是酒精检测仪（查酒驾）的原理
    match: (inputs) =>
      hasAnyFormula(inputs, ["K2Cr2O7"]) &&
      (hasCategory(inputs, "reducer") ||
        hasAnyFormula(inputs, [
          "H2C2O4", "Na2SO3", "NaHSO3", "FeSO4", "FeCl2",
          "C2H5OH", "CH3CHO", "SO2", "KI", "NaI", "Na2S", "H2S",
        ])),
    build: () => ({
      products: [{ formula: "Cr3+", name: "铬(III)离子", category: "salt" }],
      producesGas: false,
      producesPrecipitate: false,
      colorChange: true,
      thermal: "exothermic",
      phTrend: "unknown",
      equation: "Cr₂O₇²⁻ + 还原剂 + H⁺ → Cr³⁺ + …（橙黄变绿）",
      description:
        "重铬酸钾在酸性条件下被还原，溶液由橙黄色变为铬(III)的绿色，是检测酒精等还原性物质的经典显色。",
    }),
  },
  {
    id: "fe3-etch-copper",
    name: "铁(III)蚀刻铜",
    // 2Fe³⁺ + Cu → 2Fe²⁺ + Cu²⁺：氯化铁溶液能溶解铜箔，是印制电路板蚀刻的
    // 工业反应。须先于 metalRules——铜排在氢之后，通用「金属 + 盐」置换条
    // 不会命中，若落到兜底就完全丢掉这个现象
    match: (inputs) =>
      hasAnyFormula(inputs, ["FeCl3", "Fe2(SO4)3", "Fe(NO3)3"]) &&
      hasAnyFormula(inputs, ["Cu"]),
    build: () => ({
      products: [
        { formula: "CuCl2", name: "铜盐", category: "salt" },
        { formula: "FeCl2", name: "亚铁盐", category: "salt" },
      ],
      producesGas: false,
      producesPrecipitate: false,
      colorChange: true,
      thermal: "exothermic",
      phTrend: "neutral",
      equation: "2Fe³⁺ + Cu → 2Fe²⁺ + Cu²⁺",
      description:
        "铁(III)离子的氧化性强于铜离子，能把铜箔氧化溶解，棕黄溶液转为蓝绿并伴放热，是电路板蚀刻的原理。",
    }),
  },
  {
    id: "fe3-oxidize-iodide",
    name: "铁(III)氧化碘离子",
    // Fe³⁺ 氧化性强于 I₂，能把 I⁻ 氧化为 I₂：溶液变棕黄，加淀粉显蓝，
    // 是"氧化性强弱可比较"的定量证据，也是可逆反应的经典例子
    match: (inputs) =>
      hasAnyFormula(inputs, ["FeCl3", "Fe2(SO4)3", "Fe(NO3)3"]) &&
      hasAnyFormula(inputs, ["KI", "NaI"]),
    build: () => ({
      products: [
        { formula: "I2", name: "碘", category: "other" },
        { formula: "FeCl2", name: "亚铁盐", category: "salt" },
      ],
      producesGas: false,
      producesPrecipitate: false,
      colorChange: true,
      thermal: "none",
      phTrend: "unknown",
      equation: "2Fe³⁺ + 2I⁻ → 2Fe²⁺ + I₂",
      description:
        "铁(III)把碘离子氧化为碘单质，溶液由棕黄转为深棕，加淀粉立即显蓝，证明 Fe³⁺ 氧化性强于 I₂。",
    }),
  },
  {
    id: "fe3-reduce-by-so2",
    name: "二氧化硫还原铁(III)",
    match: (inputs) =>
      hasAnyFormula(inputs, ["FeCl3", "Fe2(SO4)3", "Fe(NO3)3"]) &&
      hasAnyFormula(inputs, ["SO2", "Na2SO3", "NaHSO3"]),
    build: () => ({
      products: [
        { formula: "FeSO4", name: "硫酸亚铁", category: "salt" },
        { formula: "H2SO4", name: "硫酸", category: "acid" },
      ],
      producesGas: false,
      producesPrecipitate: false,
      colorChange: true,
      thermal: "exothermic",
      phTrend: "decrease",
      equation: "2Fe³⁺ + SO₂ + 2H₂O → 2Fe²⁺ + SO₄²⁻ + 4H⁺",
      description:
        "二氧化硫作还原剂把铁(III)还原为铁(II)，棕黄色褪为浅绿色，同时生成硫酸使酸性增强。",
    }),
  },
  {
    id: "fe2-oxidized",
    name: "亚铁离子被氧化",
    // 氯水/溴水/过氧化氢等氧化剂把 Fe²⁺ 氧化为 Fe³⁺（浅绿→棕黄）
    match: (inputs) =>
      hasAnyFormula(inputs, ["FeSO4", "FeCl2"]) &&
      hasAnyFormula(inputs, ["Cl2", "Br2", "H2O2", "HNO3"]),
    build: () => ({
      products: [{ formula: "Fe³⁺", name: "铁(III)离子", category: "salt" }],
      producesGas: false,
      producesPrecipitate: false,
      colorChange: true,
      thermal: "none",
      phTrend: "unknown",
      equation: "2Fe²⁺ + Cl₂ → 2Fe³⁺ + 2Cl⁻",
      description: "氯水等氧化剂把亚铁离子氧化为铁(III)离子，溶液由浅绿变为棕黄色。",
    }),
  },
];
