// 有机反应规则（第二组）：芳烃取代与侧链氧化、不饱和烃加成、糖类水解、
// 醇的催化氧化与消去。与 organic.ts 互补——那里是银镜/酯化/皂化这类
// 「特征检验」，这里补齐「官能团转化」这条主线。
import type { Substance } from "../engine";
import type { Reaction } from "./helpers";
import { hasAnyFormula, hasCategory } from "./helpers";

/** 能与溴水（或酸性高锰酸钾）发生加成而使之褪色的不饱和烃 */
const UNSATURATED: Record<string, { name: string; bond: string; product: string; pname: string }> = {
  C2H4: { name: "乙烯", bond: "碳碳双键", product: "C2H4Br2", pname: "1,2-二溴乙烷" },
  C2H2: { name: "乙炔", bond: "碳碳三键", product: "C2H2Br4", pname: "1,1,2,2-四溴乙烷" },
  C8H8: { name: "苯乙烯", bond: "侧链碳碳双键", product: "C8H8Br2", pname: "苯乙烯二溴化物" },
};

/** 含活泼氢的醇：与钠置换产氢，羟基数决定产氢量 */
const POLYOL: Record<string, { name: string; oh: number; product: string; pname: string }> = {
  C2H6O2: { name: "乙二醇", oh: 2, product: "C2H4(ONa)2", pname: "乙二醇钠" },
  C3H8O3: { name: "甘油", oh: 3, product: "C3H5(ONa)3", pname: "甘油钠" },
  C3H7OH: { name: "丙醇", oh: 1, product: "C3H7ONa", pname: "丙醇钠" },
  C4H9OH: { name: "正丁醇", oh: 1, product: "C4H9ONa", pname: "丁醇钠" },
};

/** 可水解为单糖的糖类与高分子 */
const HYDROLYZABLE: Record<string, { name: string; product: string; pname: string; note: string }> = {
  C12H22O11: {
    name: "二糖",
    product: "C6H12O6",
    pname: "单糖",
    note: "水解得到的单糖含醛基，可用银镜或斐林试剂检出",
  },
  starch: {
    name: "淀粉",
    product: "C6H12O6",
    pname: "葡萄糖",
    note: "水解完全的判据是碘水不再显蓝色",
  },
  cellulose: {
    name: "纤维素",
    product: "C6H12O6",
    pname: "葡萄糖",
    note: "纤维素比淀粉难水解，需浓酸并较长时间",
  },
};

/** 从输入里取出表中第一个命中的物质 */
function pick<T>(inputs: Substance[], table: Record<string, T>) {
  for (const s of inputs) {
    const spec = table[s.formula];
    if (spec) return { substance: s, spec };
  }
  return null;
}

/** 是否存在强酸催化（水解 / 消去 / 酯化都靠它） */
function acidCatalyst(inputs: Substance[]): boolean {
  return hasAnyFormula(inputs, ["H2SO4", "HCl"]);
}

export const organic2Rules: Reaction[] = [
  {
    id: "unsaturated-bromine-addition",
    name: "不饱和烃与溴的加成",
    // 加成而非取代：溴水褪色且不放出溴化氢，这是与苯环取代的关键区别
    match: (inputs) =>
      !!pick(inputs, UNSATURATED) && hasAnyFormula(inputs, ["Br2", "Br2(aq)"]),
    build: (inputs) => {
      const { spec } = pick(inputs, UNSATURATED)!;
      return {
        products: [{ formula: spec.product, name: spec.pname, category: "organic" as const }],
        producesGas: false,
        producesPrecipitate: false,
        colorChange: true,
        thermal: "exothermic" as const,
        phTrend: "neutral" as const,
        equation: `${spec.name} + Br₂ → ${spec.pname}（加成）`,
        description: `${spec.name}的${spec.bond}打开并与溴加成，橙黄色溴水迅速褪为无色，全程不放出气体，可据此与苯环的取代反应区分。`,
      };
    },
  },
  {
    id: "unsaturated-kmno4-oxidation",
    name: "不饱和烃使酸性高锰酸钾褪色",
    match: (inputs) =>
      !!pick(inputs, UNSATURATED) && hasAnyFormula(inputs, ["KMnO4"]),
    build: (inputs) => {
      const { spec } = pick(inputs, UNSATURATED)!;
      return {
        products: [
          { formula: "CO2", name: "二氧化碳", category: "gas" as const },
          { formula: "MnSO4", name: "硫酸锰", category: "salt" as const },
        ],
        producesGas: true,
        producesPrecipitate: false,
        colorChange: true,
        thermal: "exothermic" as const,
        phTrend: "neutral" as const,
        equation: `${spec.name} + KMnO₄(H⁺) → CO₂↑ + Mn²⁺ + H₂O`,
        description: `${spec.name}被酸性高锰酸钾氧化断键，紫红色迅速褪去并放出二氧化碳；因产物复杂，实验上只作定性检验不饱和键之用。`,
      };
    },
  },
  {
    id: "benzene-bromination",
    name: "苯的溴代（取代反应）",
    // 必须有铁粉或溴化铁作催化剂，且产物放出溴化氢——这是取代的标志
    match: (inputs) =>
      hasAnyFormula(inputs, ["C6H6", "C7H8"]) &&
      hasAnyFormula(inputs, ["Br2"]) &&
      hasAnyFormula(inputs, ["Fe", "FeBr3"]),
    build: (inputs) => {
      const toluene = hasAnyFormula(inputs, ["C7H8"]);
      return {
        products: [
          {
            formula: toluene ? "C7H7Br" : "C6H5Br",
            name: toluene ? "溴甲苯" : "溴苯",
            category: "organic" as const,
          },
          { formula: "HBr", name: "溴化氢", category: "gas" as const },
        ],
        producesGas: true,
        producesPrecipitate: false,
        colorChange: true,
        thermal: "exothermic" as const,
        phTrend: "decrease" as const,
        equation: toluene
          ? "C₇H₈ + Br₂ --Fe--> C₇H₇Br + HBr↑"
          : "C₆H₆ + Br₂ --Fe--> C₆H₅Br + HBr↑",
        description:
          "在铁粉催化下苯环上的氢被溴取代，放出的溴化氢遇湿润石蕊变红、遇硝酸银生成淡黄沉淀，这是取代区别于加成的判据；产物溴苯是不溶于水的油状液体。",
      };
    },
  },
  {
    id: "toluene-side-chain-oxidation",
    name: "甲苯侧链的氧化",
    // 苯环稳定不被氧化，被氧化的是甲基——这是芳烃侧链效应的经典证明
    match: (inputs) =>
      hasAnyFormula(inputs, ["C7H8"]) && hasAnyFormula(inputs, ["KMnO4", "K2Cr2O7"]),
    build: () => ({
      products: [
        { formula: "C6H5COOH", name: "苯甲酸", category: "acid" as const },
        { formula: "MnSO4", name: "硫酸锰", category: "salt" as const },
      ],
      producesGas: false,
      producesPrecipitate: true,
      colorChange: true,
      thermal: "exothermic" as const,
      phTrend: "decrease" as const,
      equation: "C₇H₈ + KMnO₄(H⁺) → C₆H₅COOH + Mn²⁺ + H₂O",
      description:
        "紫红色褪去，甲基被氧化为羧基生成苯甲酸，冷却后析出白色片状晶体；苯环本身不被氧化，说明侧链受苯环活化而更易反应。",
    }),
  },
  {
    id: "polyol-sodium-hydrogen",
    name: "多元醇与钠置换产氢",
    match: (inputs) => !!pick(inputs, POLYOL) && hasAnyFormula(inputs, ["Na", "K"]),
    build: (inputs) => {
      const { spec } = pick(inputs, POLYOL)!;
      return {
        products: [
          { formula: spec.product, name: spec.pname, category: "organic" as const },
          { formula: "H2", name: "氢气", category: "gas" as const },
        ],
        producesGas: true,
        producesPrecipitate: false,
        colorChange: false,
        thermal: "exothermic" as const,
        phTrend: "increase" as const,
        // 系数为 1 时按化学惯例省略；产氢的半整数系数统一乘 2 配平
        equation:
          spec.oh === 1
            ? `2${spec.name} + 2Na → 2${spec.pname} + H₂↑`
            : `${spec.name} + ${spec.oh}Na → ${spec.pname} + ${
                spec.oh === 2 ? "" : spec.oh / 2
              }H₂↑`,
        description: `钠沉在液面下缓慢冒出氢气泡，比与水反应温和得多；${spec.name}每分子含 ${spec.oh} 个羟基，等物质的量时产氢量是乙醇的 ${spec.oh} 倍，可据此测定羟基数目。`,
      };
    },
  },
  {
    id: "saccharide-hydrolysis",
    name: "糖类与多糖的酸性水解",
    requiresHeat: true,
    // 「有糖 + 有酸」这个条件本身很宽，必须排除两类情形，否则会抢走更该
    // 呈现的现象：① 同时给了银氨试剂时，主导现象是水解产物的银镜析出；
    // ② 淀粉只作碘指示剂、真正反应是别的氧化还原时（如 H₂O₂ + KI + 硫酸）
    match: (inputs) =>
      !!pick(inputs, HYDROLYZABLE) &&
      acidCatalyst(inputs) &&
      !hasAnyFormula(inputs, ["AgNO3"]) &&
      !hasAnyFormula(inputs, ["H2O2", "KMnO4", "K2Cr2O7", "KI", "NaClO"]),
    build: (inputs) => {
      const { spec } = pick(inputs, HYDROLYZABLE)!;
      return {
        products: [{ formula: spec.product, name: spec.pname, category: "organic" as const }],
        producesGas: false,
        producesPrecipitate: false,
        colorChange: true,
        thermal: "none" as const,
        phTrend: "neutral" as const,
        equation: `${spec.name} + nH₂O --H⁺,Δ--> n${spec.pname}`,
        description: `${spec.name}在稀酸催化下水浴加热逐步水解为${spec.pname}，溶液由浑浊转清亮；${spec.note}。检验前必须先用碱中和残余酸，否则银镜与斐林试剂都会失效。`,
      };
    },
  },
  {
    id: "aniline-bromine-water",
    name: "苯胺与溴水的取代",
    // 氨基强活化苯环，无需催化剂即在常温三取代，直接落白色沉淀
    match: (inputs) =>
      hasAnyFormula(inputs, ["C6H5NH2"]) && hasAnyFormula(inputs, ["Br2", "Br2(aq)"]),
    build: () => ({
      products: [
        { formula: "C6H2Br3NH2", name: "2,4,6-三溴苯胺", category: "organic" as const },
        { formula: "HBr", name: "溴化氢", category: "acid" as const },
      ],
      producesGas: false,
      producesPrecipitate: true,
      colorChange: true,
      thermal: "none" as const,
      phTrend: "decrease" as const,
      equation: "C₆H₅NH₂ + 3Br₂ → C₆H₂Br₃NH₂↓ + 3HBr",
      description:
        "常温下不需催化剂，溴水立即褪色并析出白色的三溴苯胺沉淀；氨基对苯环的活化作用比羟基更强，与苯需铁粉催化才单取代形成鲜明对照。",
    }),
  },
  {
    id: "benzaldehyde-silver-mirror",
    name: "苯甲醛的银镜反应",
    requiresHeat: true,
    match: (inputs) =>
      hasAnyFormula(inputs, ["C6H5CHO"]) &&
      hasAnyFormula(inputs, ["AgNO3"]) &&
      hasAnyFormula(inputs, ["NH3·H2O", "NH3"]),
    build: () => ({
      products: [
        { formula: "Ag", name: "银", category: "metal" as const },
        { formula: "C6H5COONH4", name: "苯甲酸铵", category: "salt" as const },
      ],
      producesGas: false,
      producesPrecipitate: true,
      colorChange: true,
      thermal: "none" as const,
      phTrend: "neutral" as const,
      equation: "C₆H₅CHO + 2Ag(NH₃)₂OH --Δ--> C₆H₅COONH₄ + 2Ag↓ + 3NH₃ + H₂O",
      description:
        "水浴加热后管壁附着光亮银镜，证明苯甲醛的醛基与脂肪醛同样具有还原性；若管壁不洁则银以黑色絮状析出而非成镜。",
    }),
  },
];
