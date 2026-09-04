// 金属相关反应规则
// 覆盖：活泼金属 + 水 → 碱 + H₂↑；金属置换（铁置换铜等）；
// 金属 + 盐溶液置换。注意：金属 + 酸 已由 reactions.ts 基础规则处理。
import type { Substance } from "../engine";
import type { Reaction } from "./helpers";
import { hasAnyFormula, hasCategory, findByCategory, isConcentrated } from "./helpers";
import { isMoreActive } from "../galvanic";

/** 可被置换的盐 → 其中金属元素符号。判定交给活动性顺序，不再写死组合 */
const DISPLACEABLE_SALT: Record<string, string> = {
  CuSO4: "Cu", CuCl2: "Cu", "Cu(NO3)2": "Cu",
  AgNO3: "Ag",
  FeSO4: "Fe", FeCl2: "Fe",
  NiSO4: "Ni", NiCl2: "Ni",
  CoCl2: "Co", CoSO4: "Co",
  SnCl2: "Sn",
  "Pb(NO3)2": "Pb",
  ZnSO4: "Zn", ZnCl2: "Zn",
};

/**
 * 盐 → 阴离子部分，用于拼出置换后真实的新盐化学式。
 *
 * 原先 build 直接返回占位产物 `${metal.formula}-salt`，占位符查不到色表，
 * productTint 便回退到 cationTint(反应物) —— 取的是**反应物**里第一个有色阳离子，
 * 于是「铁片 + 硫酸铜」反应前后液色都是 Cu²⁺ 蓝，31 个置换实验声明了
 * colorChange 却在 3D 里一动不动，而蓝色褪成浅绿正是这类实验的核心观察点。
 *
 * 拼真化学式还能顺带修好另一处：新盐化学式规范后，被置换金属也能给出
 * 真实符号（原先一律写死 "Cu/Ag"，锌置换钴时显示的是铜）。
 */
const SALT_ANION: Record<string, { suffix: string; charge: number }> = {
  SO4: { suffix: "SO4", charge: 2 },
  Cl: { suffix: "Cl", charge: 1 },
  NO3: { suffix: "NO3", charge: 1 },
};

/** 常见金属在盐中的化合价，用于配平新盐的下标 */
const METAL_VALENCE: Record<string, number> = {
  K: 1, Na: 1, Ag: 1,
  Mg: 2, Ca: 2, Zn: 2, Fe: 2, Ni: 2, Co: 2, Sn: 2, Pb: 2, Cu: 2, Cd: 2, Mn: 2,
  Al: 3,
};

/** 从盐的化学式里识别阴离子（按后缀，长的优先以免 Cl 抢先匹配） */
function anionOf(saltFormula: string) {
  if (saltFormula.includes("SO4")) return SALT_ANION.SO4;
  if (saltFormula.includes("NO3")) return SALT_ANION.NO3;
  if (saltFormula.includes("Cl")) return SALT_ANION.Cl;
  return null;
}

/**
 * 拼出置换生成的新盐化学式，如 Fe + CuSO4 → FeSO4，Zn + AgNO3 → Zn(NO3)2。
 * 遇到没登记的金属或阴离子时返回 null，交由调用方回退到占位产物，
 * 避免拼出 "XyzSO4" 这种查不到也读不懂的假化学式。
 */
function newSaltFormula(metal: string, salt: string): string | null {
  const anion = anionOf(salt);
  const v = METAL_VALENCE[metal];
  if (!anion || !v) return null;
  // 化合价交叉配平：金属价 v、阴离子电荷 charge，取最简整数比
  const g = gcd(v, anion.charge);
  const nMetal = anion.charge / g;
  const nAnion = v / g;
  // 多原子阴离子下标大于 1 时必须加括号：Zn(NO3)2 而非 ZnNO32
  const poly = anion.suffix.length > 2;
  const anionPart =
    nAnion === 1
      ? anion.suffix
      : poly
        ? `(${anion.suffix})${nAnion}`
        : `${anion.suffix}${nAnion}`;
  return `${metal}${nMetal === 1 ? "" : nMetal}${anionPart}`;
}

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

/**
 * 穷举出一对能发生置换的（金属单质，可置换盐）。
 *
 * 不能「先取第一个金属、再看它能不能置换」——对照实验常同时放入活泼与不活泼金属
 * （铁片 + 铜片 + 硫酸铜），若恰好先取到铜片就会判定不反应，使结论依赖投料顺序。
 * 只要体系里存在任一更活泼的金属，置换就会发生。
 */
function findDisplacement(inputs: Substance[]) {
  for (const metal of inputs) {
    if (metal.category !== "metal") continue;
    for (const salt of inputs) {
      const saltMetal = DISPLACEABLE_SALT[salt.formula];
      if (!saltMetal) continue;
      if (isMoreActive(metal.formula, saltMetal)) return { metal, salt, saltMetal };
    }
  }
  return null;
}

export const metalRules: Reaction[] = [
  {
    id: "copper-nitric-acid",
    // 铜不活泼，与盐酸/稀硫酸不反应，但硝酸的强氧化性使其溶解：
    // 必须排在通用「金属+酸」之前，否则只会报产气而漏掉溶液变蓝这一特征现象。
    name: "铜与硝酸反应",
    match: (inputs) =>
      hasAnyFormula(inputs, ["Cu"]) && hasAnyFormula(inputs, ["HNO3"]),
    build: (inputs) => {
      // 浓硝酸放红棕色 NO₂ 且反应剧烈，稀硝酸放无色 NO 后在瓶口变红棕，
      // 两者的气体颜色是该实验最核心的观察点，必须分开
      const dense = isConcentrated(inputs, "HNO3");
      return {
        products: [
          { formula: "Cu(NO3)2", name: "硝酸铜", category: "salt" as const },
          dense
            ? { formula: "NO2", name: "二氧化氮", category: "gas" as const }
            : { formula: "NO", name: "一氧化氮", category: "gas" as const },
        ],
        producesGas: true,
        producesPrecipitate: false,
        colorChange: true,
        thermal: "exothermic",
        phTrend: "increase",
        equation: dense
          ? "Cu + 4HNO₃(浓) → Cu(NO₃)₂ + 2NO₂↑ + 2H₂O"
          : "3Cu + 8HNO₃(稀) → 3Cu(NO₃)₂ + 2NO↑ + 4H₂O",
        description: dense
          ? "铜与浓硝酸剧烈反应，迅速放出红棕色二氧化氮，溶液变蓝绿色（须在通风橱内进行）。"
          : "铜溶于稀硝酸生成蓝色硝酸铜溶液，放出无色一氧化氮，遇空气变红棕色（须通风）。",
      };
    },
  },
  {
    id: "active-metal-oxidizing-acid",
    name: "活泼金属与氧化性酸反应",
    // 浓硫酸 / 硝酸靠 S(+6)、N(+5) 得电子，放出的是 SO₂ / NO₂ / NO 而不是 H₂。
    // 「锌 + 稀硫酸放氢气、锌 + 浓硫酸放二氧化硫」是氧化性酸的核心考点，
    // 必须排在通用「金属 + 酸」之前，否则一律错报氢气
    match: (inputs) =>
      hasCategory(inputs, "metal") &&
      !hasAnyFormula(inputs, ["Cu"]) &&
      (isConcentrated(inputs, "H2SO4") || hasAnyFormula(inputs, ["HNO3"])),
    build: (inputs) => {
      const metal = findByCategory(inputs, "metal")!;
      const denseSulfuric = isConcentrated(inputs, "H2SO4");
      const denseNitric = isConcentrated(inputs, "HNO3");
      const gas = denseSulfuric
        ? { formula: "SO2", name: "二氧化硫", category: "gas" as const }
        : denseNitric
          ? { formula: "NO2", name: "二氧化氮", category: "gas" as const }
          : { formula: "NO", name: "一氧化氮", category: "gas" as const };
      return {
        products: [
          { formula: `${metal.formula}-salt`, name: "盐", category: "salt" as const },
          gas,
          { formula: "H2O", name: "水", category: "water" as const },
        ],
        producesGas: true,
        producesPrecipitate: false,
        // 红棕色 NO₂ 是浓硝酸最醒目的标志；SO₂/NO 无色，靠溶液与气味判断
        colorChange: denseNitric,
        thermal: "exothermic",
        phTrend: "increase",
        equation: denseSulfuric
          ? `${metal.formula} + 2H₂SO₄(浓) --Δ--> 盐 + SO₂↑ + 2H₂O`
          : denseNitric
            ? `${metal.formula} + 浓HNO₃ → 盐 + NO₂↑ + H₂O`
            : `${metal.formula} + 稀HNO₃ → 盐 + NO↑ + H₂O`,
        description: denseSulfuric
          ? "浓硫酸表现强氧化性，被金属还原为二氧化硫而非放出氢气，须做尾气吸收。"
          : denseNitric
            ? "浓硝酸与金属剧烈反应，放出红棕色二氧化氮，反应速率远快于稀硝酸（须通风橱）。"
            : "稀硝酸的氧化性来自 N(+5)，与金属反应放出无色一氧化氮，出瓶口遇氧变红棕色。",
      };
    },
  },
  {
    id: "copper-hot-concentrated-sulfuric",
    name: "铜与热浓硫酸反应",
    requiresHeat: true,
    // 铜与稀硫酸完全不反应，只有热浓硫酸的强氧化性能溶解它，且放的是
    // SO₂ 而非 H₂；若落到通用「金属+酸」规则就会错报氢气
    match: (inputs) =>
      hasAnyFormula(inputs, ["Cu"]) && isConcentrated(inputs, "H2SO4"),
    build: () => ({
      products: [
        { formula: "CuSO4", name: "硫酸铜", category: "salt" },
        { formula: "SO2", name: "二氧化硫", category: "gas" },
        { formula: "H2O", name: "水", category: "water" },
      ],
      producesGas: true,
      producesPrecipitate: false,
      colorChange: true,
      thermal: "exothermic",
      phTrend: "increase",
      equation: "Cu + 2H₂SO₄(浓) --Δ--> CuSO₄ + SO₂↑ + 2H₂O",
      description:
        "加热时浓硫酸表现强氧化性，把铜氧化为硫酸铜，放出有刺激性气味的二氧化硫（须尾气吸收）。",
    }),
  },
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
      // 按金属价态生成对应碱与配平：Na/K 为 +1 价，Ca 为 +2 价
      const isDivalent = metal.formula === "Ca";
      // 产物化学式用半角下标：它是查色表 / 被下游规则再匹配的键，
      // 全角 `Ca(OH)₂` 与各表里的 `Ca(OH)2` 不是同一个键。方程式文字才用全角
      const hydroxide = isDivalent
        ? `${metal.formula}(OH)2`
        : `${metal.formula}OH`;
      const equation = isDivalent
        ? `${metal.formula} + 2H₂O → ${metal.formula}(OH)₂ + H₂↑`
        : `2${metal.formula} + 2H₂O → 2${metal.formula}OH + H₂↑`;
      // 生成强碱：若体系含指示剂（如酚酞），溶液显色（变红）
      const hasIndicator = hasCategory(inputs, "indicator");
      return {
        products: [
          { formula: hydroxide, name: "可溶性碱", category: "base" },
          { formula: "H2", name: "氢气", category: "gas" },
        ],
        producesGas: true,
        producesPrecipitate: false,
        colorChange: hasIndicator,
        thermal: "exothermic",
        phTrend: "increase",
        equation,
        description: hasIndicator
          ? "活泼金属与水剧烈反应放出氢气，生成的强碱使酚酞等指示剂变红。"
          : "活泼金属与水剧烈反应，放出氢气并生成对应的可溶性强碱。",
      };
    },
  },
  {
    id: "metal-salt-displacement",
    name: "金属置换盐溶液",
    // 由「活动性顺序」判定而非固定盐白名单：单质必须比盐中金属更活泼才置换。
    // 这样新增镍/钴/锡/镉等电极金属时无需再逐条改白名单（DRY）。
    match: (inputs) => findDisplacement(inputs) !== null,
    build: (inputs) => {
      const { metal, salt, saltMetal } = findDisplacement(inputs)!;
      // 拼真实新盐化学式，让 productTint 能查到「反应后」的液色。
      // 拼不出时才退回占位符（此时 productTint 会按反应物阳离子反推，虽不精确但不至于崩）
      const newSalt = newSaltFormula(metal.formula, salt.formula);
      return {
        products: [
          // 被置换出的金属用真实符号：原先写死 "Cu/Ag"，锌置换钴时显示的是铜
          { formula: saltMetal, name: `${saltMetal} 单质`, category: "metal" },
          newSalt
            ? { formula: newSalt, name: "新盐", category: "salt" }
            : { formula: `${metal.formula}-salt`, name: "新盐", category: "salt" },
        ],
        producesGas: false,
        producesPrecipitate: false,
        colorChange: true,
        thermal: "exothermic",
        phTrend: "neutral",
        equation: newSalt
          ? `${metal.formula} + ${salt.formula} → ${newSalt} + ${saltMetal}`
          : `${metal.formula} + 盐 → 新盐 + 金属`,
        description:
          `${metal.name}比${saltMetal}活泼，把${saltMetal}从其盐溶液中置换出来：` +
          `${metal.name}表面附着一层${saltMetal}，溶液颜色随阳离子改变而变化。`,
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
