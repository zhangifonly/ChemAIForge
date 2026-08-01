// 金属相关反应规则
// 覆盖：活泼金属 + 水 → 碱 + H₂↑；金属置换（铁置换铜等）；
// 金属 + 盐溶液置换。注意：金属 + 酸 已由 reactions.ts 基础规则处理。
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
      const hydroxide = isDivalent
        ? `${metal.formula}(OH)₂`
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
    match: (inputs) => {
      const metal = findByCategory(inputs, "metal");
      if (!metal) return false;
      const salt = inputs.find((s) => DISPLACEABLE_SALT[s.formula]);
      if (!salt) return false;
      return isMoreActive(metal.formula, DISPLACEABLE_SALT[salt.formula]);
    },
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
