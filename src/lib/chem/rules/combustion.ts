// 燃烧与气体制备规则
// 覆盖教材中"物质在氧气/氯气中燃烧""氢气还原金属氧化物""铝与强碱制氢"
// "氯气与碱制漂白液""氨气溶于水""氨与酸生成白烟"这几条引擎原先缺失的核心反应。
// 这些反应的共同点是至少一方为气体，因此单独成文件，与 gas.ts（由固液制气）互补。
import type { Reaction } from "./helpers";
import { hasAnyFormula, hasCategory, isConcentrated } from "./helpers";

/** 在氧气中燃烧的可燃物：化学式 → 产物与现象描述 */
const O2_BURN: Record<
  string,
  { product: string; name: string; equation: string; desc: string }
> = {
  Mg: { product: "MgO", name: "氧化镁", equation: "2Mg + O₂ --点燃--> 2MgO", desc: "镁条在氧气中发出耀眼白光，生成白色氧化镁粉末。" },
  Fe: { product: "Fe3O4", name: "四氧化三铁", equation: "3Fe + 2O₂ --点燃--> Fe₃O₄", desc: "铁丝在纯氧中剧烈燃烧、火星四射，生成黑色四氧化三铁。" },
  Al: { product: "Al2O3", name: "氧化铝", equation: "4Al + 3O₂ --点燃--> 2Al₂O₃", desc: "铝箔在氧气中燃烧发出白光，生成白色氧化铝。" },
  Cu: { product: "CuO", name: "氧化铜", equation: "2Cu + O₂ --Δ--> 2CuO", desc: "紫红色铜在空气中受热逐渐变黑，表面生成氧化铜。" },
  S: { product: "SO2", name: "二氧化硫", equation: "S + O₂ --点燃--> SO₂", desc: "硫粉在氧气中燃烧发出明亮蓝紫色火焰，生成有刺激性气味的二氧化硫。" },
  C: { product: "CO2", name: "二氧化碳", equation: "C + O₂ --点燃--> CO₂", desc: "木炭在氧气中剧烈燃烧发白光，生成能使石灰水变浑浊的二氧化碳。" },
  H2: { product: "H2O", name: "水", equation: "2H₂ + O₂ --点燃--> 2H₂O", desc: "氢气在氧气中安静燃烧发出淡蓝色火焰，管壁出现水珠。" },
  C2H5OH: { product: "CO2", name: "二氧化碳", equation: "C₂H₅OH + 3O₂ --点燃--> 2CO₂ + 3H₂O", desc: "乙醇燃烧发出淡蓝色火焰，放出大量热，是常用清洁燃料。" },
  Na: { product: "Na2O2", name: "过氧化钠", equation: "2Na + O₂ --Δ--> Na₂O₂", desc: "钠在氧气中燃烧发出黄色火焰，生成淡黄色过氧化钠。" },
  P: { product: "P2O5", name: "五氧化二磷", equation: "4P + 5O₂ --点燃--> 2P₂O₅", desc: "红磷在氧气中燃烧发出黄光并冒大量白烟，生成五氧化二磷。" },
  CH4: { product: "CO2", name: "二氧化碳", equation: "CH₄ + 2O₂ --点燃--> CO₂ + 2H₂O", desc: "甲烷燃烧发出淡蓝色火焰，罩上干冷烧杯可见水珠。" },
  CO: { product: "CO2", name: "二氧化碳", equation: "2CO + O₂ --点燃--> 2CO₂", desc: "一氧化碳燃烧发出蓝色火焰，生成二氧化碳，是煤气燃烧的主要过程。" },
  Zn: { product: "ZnO", name: "氧化锌", equation: "2Zn + O₂ --Δ--> 2ZnO", desc: "锌粉在氧气中燃烧发出蓝绿色光，生成白色氧化锌。" },
};

/** 在氯气中燃烧的金属：氯气氧化性强，一律生成最高价氯化物 */
const CL2_BURN: Record<
  string,
  { product: string; name: string; equation: string; desc: string }
> = {
  Fe: { product: "FeCl3", name: "氯化铁", equation: "2Fe + 3Cl₂ --点燃--> 2FeCl₃", desc: "铁丝在氯气中剧烈燃烧，产生棕褐色的烟，生成氯化铁而非氯化亚铁。" },
  Cu: { product: "CuCl2", name: "氯化铜", equation: "Cu + Cl₂ --点燃--> CuCl₂", desc: "铜丝在氯气中燃烧产生棕黄色烟，加水溶解后得到蓝绿色氯化铜溶液。" },
  Na: { product: "NaCl", name: "氯化钠", equation: "2Na + Cl₂ --点燃--> 2NaCl", desc: "钠在氯气中剧烈燃烧发出黄色火焰，产生大量白烟即食盐微粒。" },
  H2: { product: "HCl", name: "氯化氢", equation: "H₂ + Cl₂ --点燃--> 2HCl", desc: "氢气在氯气中安静燃烧发出苍白色火焰，瓶口出现白雾（盐酸小液滴）。" },
};

/** 氢气/一氧化碳可还原的金属氧化物 */
const REDUCIBLE_OXIDE: Record<string, { metal: string; name: string; color: string }> = {
  CuO: { metal: "Cu", name: "铜", color: "黑色固体变为紫红色" },
  Fe2O3: { metal: "Fe", name: "铁", color: "红棕色固体变为黑色" },
  Fe3O4: { metal: "Fe", name: "铁", color: "黑色固体逐渐变为银灰色" },
  PbO2: { metal: "Pb", name: "铅", color: "棕黑色固体变为灰色" },
};

export const combustionRules: Reaction[] = [
  {
    id: "burn-in-oxygen",
    name: "物质在氧气中燃烧",
    requiresHeat: true,
    // 必须有氧气 + 一种登记过的可燃物；产物与火焰颜色都由可燃物决定
    match: (inputs) =>
      hasAnyFormula(inputs, ["O2"]) &&
      inputs.some((s) => s.formula !== "O2" && s.formula in O2_BURN),
    build: (inputs) => {
      const fuel = inputs.find((s) => s.formula !== "O2" && s.formula in O2_BURN)!;
      const spec = O2_BURN[fuel.formula];
      return {
        products: [{ formula: spec.product, name: spec.name, category: "oxide" as const }],
        producesGas: spec.product === "CO2" || spec.product === "SO2",
        producesPrecipitate: false,
        // 燃烧一定伴随剧烈的光与固体颜色变化，是最强的可见现象
        colorChange: true,
        thermal: "exothermic" as const,
        phTrend: "unknown" as const,
        equation: spec.equation,
        description: spec.desc,
      };
    },
  },
  {
    id: "h2-reduce-oxide",
    name: "氢气还原金属氧化物",
    requiresHeat: true,
    match: (inputs) =>
      hasAnyFormula(inputs, ["H2", "CO"]) &&
      inputs.some((s) => s.formula in REDUCIBLE_OXIDE),
    build: (inputs) => {
      const oxide = inputs.find((s) => s.formula in REDUCIBLE_OXIDE)!;
      const spec = REDUCIBLE_OXIDE[oxide.formula];
      const reducer = hasAnyFormula(inputs, ["H2"]) ? "H₂" : "CO";
      return {
        products: [
          { formula: spec.metal, name: spec.name, category: "metal" as const },
          { formula: reducer === "H₂" ? "H2O" : "CO2", name: reducer === "H₂" ? "水" : "二氧化碳", category: reducer === "H₂" ? ("water" as const) : ("gas" as const) },
        ],
        producesGas: reducer === "CO",
        producesPrecipitate: false,
        colorChange: true,
        thermal: "exothermic" as const,
        phTrend: "unknown" as const,
        equation: `${oxide.formula} + ${reducer} --Δ--> ${spec.metal} + ${reducer === "H₂" ? "H₂O" : "CO₂"}`,
        description: `加热条件下${reducer === "H₂" ? "氢气" : "一氧化碳"}把${oxide.name}还原为金属，${spec.color}，同时${reducer === "H₂" ? "管口出现水珠" : "尾气需点燃处理"}。`,
      };
    },
  },
  {
    id: "aluminum-strong-base",
    name: "铝与强碱溶液反应",
    // 铝的两性：既溶于酸也溶于强碱并放氢，是铝区别于其他常见金属的关键性质
    match: (inputs) =>
      hasAnyFormula(inputs, ["Al"]) && hasAnyFormula(inputs, ["NaOH", "KOH"]),
    build: () => ({
      products: [
        { formula: "NaAlO2", name: "偏铝酸钠", category: "salt" as const },
        { formula: "H2", name: "氢气", category: "gas" as const },
      ],
      producesGas: true,
      producesPrecipitate: false,
      colorChange: false,
      thermal: "exothermic" as const,
      phTrend: "decrease" as const,
      equation: "2Al + 2NaOH + 2H₂O → 2NaAlO₂ + 3H₂↑",
      description: "铝片放入强碱溶液中持续冒出氢气并放热，体现铝的两性——既溶于酸又溶于强碱。",
    }),
  },
  {
    id: "burn-in-chlorine",
    name: "金属在氯气中燃烧",
    requiresHeat: true,
    // 氯气的氧化性使金属直接生成高价氯化物：铁在氯气中只生成 FeCl₃（棕黄烟），
    // 不会停在 FeCl₂，这是「氧化剂强弱决定产物价态」的关键证据
    match: (inputs) =>
      hasAnyFormula(inputs, ["Cl2"]) &&
      inputs.some((s) => s.formula !== "Cl2" && s.formula in CL2_BURN),
    build: (inputs) => {
      const metal = inputs.find((s) => s.formula !== "Cl2" && s.formula in CL2_BURN)!;
      const spec = CL2_BURN[metal.formula];
      return {
        products: [{ formula: spec.product, name: spec.name, category: "salt" as const }],
        producesGas: false,
        producesPrecipitate: false,
        colorChange: true,
        thermal: "exothermic" as const,
        phTrend: "unknown" as const,
        equation: spec.equation,
        description: spec.desc,
      };
    },
  },
  {
    id: "hypochlorite-oxidize",
    name: "次氯酸盐氧化还原剂",
    // 漂白液（NaClO）的氧化性介于氯气与双氧水之间，能把 I⁻ 氧化出碘、
    // 使有色物质褪色，是家用消毒液起效的化学基础
    match: (inputs) =>
      hasAnyFormula(inputs, ["NaClO", "Ca(ClO)2"]) &&
      hasAnyFormula(inputs, ["KI", "NaI", "Na2SO3", "Na2S", "FeSO4", "FeCl2", "H2C2O4"]),
    build: () => ({
      products: [
        { formula: "NaCl", name: "氯化钠", category: "salt" },
        { formula: "I2", name: "被氧化产物", category: "other" },
      ],
      producesGas: false,
      producesPrecipitate: false,
      colorChange: true,
      thermal: "exothermic",
      phTrend: "decrease",
      equation: "ClO⁻ + 还原剂 → Cl⁻ + 氧化产物",
      description:
        "次氯酸盐把还原剂氧化，自身被还原为氯离子；碘离子被氧化时溶液显棕黄，加淀粉变蓝。",
    }),
  },
  {
    id: "chlorine-base",
    name: "氯气与碱溶液反应",
    match: (inputs) =>
      hasAnyFormula(inputs, ["Cl2"]) && hasCategory(inputs, "base"),
    build: (inputs) => {
      const lime = hasAnyFormula(inputs, ["Ca(OH)2"]);
      return {
        products: lime
          ? [
              { formula: "Ca(ClO)2", name: "次氯酸钙", category: "salt" as const },
              { formula: "CaCl2", name: "氯化钙", category: "salt" as const },
            ]
          : [
              { formula: "NaClO", name: "次氯酸钠", category: "salt" as const },
              { formula: "NaCl", name: "氯化钠", category: "salt" as const },
            ],
        producesGas: false,
        producesPrecipitate: false,
        // 黄绿色的氯气被吸收后溶液颜色明显变浅，是尾气吸收完全的判据
        colorChange: true,
        thermal: "exothermic" as const,
        phTrend: "decrease" as const,
        equation: lime
          ? "2Cl₂ + 2Ca(OH)₂ → Ca(ClO)₂ + CaCl₂ + 2H₂O"
          : "Cl₂ + 2NaOH → NaCl + NaClO + H₂O",
        description: lime
          ? "氯气通入石灰乳制得漂白粉，有效成分次氯酸钙，黄绿色随吸收而褪去。"
          : "氯气被氢氧化钠溶液吸收生成漂白液，黄绿色褪去，是氯气尾气处理的标准做法。",
      };
    },
  },
  {
    id: "ammonia-water",
    name: "氨气溶于水",
    // 氨极易溶于水（1:700），是喷泉实验的基础；溶液呈碱性可使酚酞变红
    match: (inputs) =>
      hasAnyFormula(inputs, ["NH3"]) && hasAnyFormula(inputs, ["H2O"]),
    build: () => ({
      products: [{ formula: "NH3·H2O", name: "氨水", category: "base" as const }],
      producesGas: false,
      producesPrecipitate: false,
      colorChange: true,
      thermal: "exothermic" as const,
      phTrend: "increase" as const,
      equation: "NH₃ + H₂O ⇌ NH₃·H₂O ⇌ NH₄⁺ + OH⁻",
      description: "氨气极易溶于水生成氨水，溶液呈碱性能使酚酞变红；瓶内压强骤降可形成喷泉。",
    }),
  },
  {
    id: "ammonia-acid-smoke",
    name: "氨与挥发性酸生成白烟",
    // 白烟发生在空气中而非溶液里：两根玻璃棒各蘸浓氨水与浓盐酸靠近，
    // 挥发出的 NH₃ 与 HCl 在气相相遇成 NH₄Cl 微晶。因此判据有两条路 ——
    //   ① 直接给氨气；
    //   ② 给的是浓氨水且酸也是浓的（浓才挥发得出来）。
    // 若两者都是稀溶液，倒在一起就只是普通中和，不该报白烟，
    // 这时让位给 acidBaseNeutralization
    match: (inputs) => {
      const acid = hasAnyFormula(inputs, ["HCl", "HNO3"]);
      if (!acid) return false;
      if (hasAnyFormula(inputs, ["NH3"])) return true;
      const concAmmonia = inputs.some(
        (s) => s.formula === "NH3·H2O" && s.name.includes("浓"),
      );
      const concAcid =
        isConcentrated(inputs, "HCl") || isConcentrated(inputs, "HNO3");
      return concAmmonia && concAcid;
    },
    build: (inputs) => {
      const isHCl = hasAnyFormula(inputs, ["HCl"]);
      return {
        products: [
          {
            formula: isHCl ? "NH4Cl" : "NH4NO3",
            name: isHCl ? "氯化铵" : "硝酸铵",
            category: "salt" as const,
          },
        ],
        producesGas: false,
        producesPrecipitate: false,
        // 白烟是悬浮的微小晶体，肉眼看得见，属于典型的可见现象
        colorChange: true,
        thermal: "exothermic" as const,
        phTrend: "neutral" as const,
        equation: isHCl ? "NH₃ + HCl → NH₄Cl（白烟）" : "NH₃ + HNO₃ → NH₄NO₃（白烟）",
        description: `氨气与挥发性${isHCl ? "盐酸" : "硝酸"}相遇，两瓶口靠近即产生大量白烟，是氨与酸互相检验的经典现象。`,
      };
    },
  },
];
