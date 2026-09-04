// 有机反应规则（第三组）：油脂的酸性水解、乙醇的消去、萃取分层与重结晶。
//
// 与前两组的分工：organic.ts 管特征检验（银镜/酯化/皂化），organic2.ts 管官能团
// 转化（取代/加成/氧化），这里收两类前面漏掉的：
//   ① 同一底物在酸、碱下走不同路（油脂酸性水解出脂肪酸，碱性水解出肥皂）；
//   ② 物理分离过程 —— 萃取、重结晶严格说不是化学反应，但它们是教材独立课题，
//      观察量是分层界面与晶体析出。引擎若判"未反应"，3D 台上就毫无变化。
import type { Reaction } from "./helpers";
import { hasAnyFormula, hasCategory, isConcentrated } from "./helpers";
// 复用酯化的羧酸表，供消去规则排除酯化情形（见 ethanol-dehydration-ethylene）
import { ESTER_ACIDS } from "./organic";

/** 与水互不相溶、可用于萃取碘/溴的有机溶剂 → 是否比水重（决定分层上下） */
const EXTRACTANT: Record<string, { name: string; denser: boolean; tint: string }> = {
  CCl4: { name: "四氯化碳", denser: true, tint: "紫红" },
  CHCl3: { name: "氯仿", denser: true, tint: "紫红" },
  C6H6: { name: "苯", denser: false, tint: "紫红" },
  C6H5CH3: { name: "甲苯", denser: false, tint: "紫红" },
  C2H5OC2H5: { name: "乙醚", denser: false, tint: "棕黄" },
};

/**
 * 可被铜（或银）催化氧化的醇 → 对应的羰基产物。
 *
 * 只有连着氢的碳才能被夺氢：伯醇 → 醛，仲醇 → 酮，叔醇（如叔丁醇）没有 α-H
 * 故不被氧化 —— 这是本类反应最重要的结构判据，不能一概而论。
 */
const CATALYTIC_ALCOHOL: Record<string, { formula: string; name: string; kind: string }> = {
  CH3OH: { formula: "HCHO", name: "甲醛", kind: "醛" },
  C2H5OH: { formula: "CH3CHO", name: "乙醛", kind: "醛" },
  C3H7OH: { formula: "C2H5CHO", name: "丙醛", kind: "醛" },
  C3H8O: { formula: "CH3COCH3", name: "丙酮", kind: "酮" },
};

/** 催化氧化的催化剂：铜丝或银 */
const OXIDATION_CATALYST = ["Cu", "Ag"];

/** 苯环取代的催化剂：在场说明目的是溴代而非萃取 */
const ARENE_CATALYST = ["Fe", "FeBr3", "FeCl3", "AlCl3"];

/** 可被更活泼卤素置换的卤化物盐：在场说明目的是置换，萃取只是显色手段 */
const HALIDE_SALT = ["KBr", "KI", "NaBr", "NaI", "MgBr2", "CaI2"];

export const organic3Rules: Reaction[] = [
  {
    id: "alcohol-catalytic-oxidation",
    name: "醇的催化氧化",
    requiresHeat: true,
    // 「乙醇 + 铜 + 氧气」原先落到 combustionRules 的「乙醇燃烧」，打印出
    // C₂H₅OH + 3O₂ → 2CO₂ + 3H₂O ——那是完全氧化，与本实验恰好相反：
    // 灼热铜丝的作用是把氧只传给羟基那个碳，得到醛而非烧成二氧化碳。
    // 判据里必须有催化剂，否则乙醇在空气中确实是燃烧
    match: (inputs) =>
      inputs.some((s) => s.formula in CATALYTIC_ALCOHOL) &&
      hasAnyFormula(inputs, OXIDATION_CATALYST) &&
      hasAnyFormula(inputs, ["O2"]),
    build: (inputs) => {
      const alcohol = inputs.find((s) => s.formula in CATALYTIC_ALCOHOL)!;
      const spec = CATALYTIC_ALCOHOL[alcohol.formula];
      const cat = hasAnyFormula(inputs, ["Cu"]) ? "铜" : "银";
      return {
        products: [
          { formula: spec.formula, name: spec.name, category: "organic" as const },
          { formula: "H2O", name: "水", category: "water" as const },
        ],
        producesGas: false,
        producesPrecipitate: false,
        // 铜丝在黑（CuO）与红（Cu）之间反复交替，是催化剂参与循环的直接证据
        colorChange: true,
        thermal: "exothermic" as const,
        phTrend: "neutral" as const,
        equation: `2${alcohol.formula} + O₂ --${cat}, Δ--> 2${spec.formula} + 2H₂O`,
        description: `灼热的${cat}丝先被氧化成黑色氧化${cat}，随即被${alcohol.name}夺去氧而复原为光亮的红色 —— 黑红交替正说明${cat}只是催化剂，反应前后质量与性质不变。产物${spec.name}有刺激性气味，属于${spec.kind}；若撤去催化剂直接点燃，${alcohol.name}会完全燃烧成二氧化碳和水，得不到${spec.name}。`,
      };
    },
  },
  {
    id: "fat-hydrolysis-acid",
    name: "油脂的酸性水解",
    requiresHeat: true,
    // 与皂化（碱性）区分：酸只是催化剂，产物是高级脂肪酸而非其钠盐，
    // 且反应可逆、需长时间水浴。organic.ts 的皂化规则只匹配 NaOH/KOH，
    // 加硫酸的油脂原先一路落空
    match: (inputs) =>
      hasAnyFormula(inputs, ["fat"]) &&
      hasCategory(inputs, "acid") &&
      hasCategory(inputs, "water"),
    build: () => ({
      products: [
        { formula: "RCOOH", name: "高级脂肪酸", category: "acid" as const },
        { formula: "C3H8O3", name: "甘油", category: "organic" as const },
      ],
      producesGas: false,
      producesPrecipitate: false,
      // 长时间水浴后上层由浑浊的油层变为半透明脂肪酸层，界面位置明显改变
      colorChange: true,
      thermal: "none" as const,
      phTrend: "neutral" as const,
      equation: "油脂 + 3H₂O ⇌(稀硫酸, Δ) 3RCOOH + 甘油",
      description:
        "稀硫酸只作催化剂，油脂水解得到高级脂肪酸和甘油 —— 与皂化的关键差别在此：产物是酸而非肥皂，故不产生泡沫。反应可逆，需长时间水浴并不断搅拌，静置后上层为脂肪酸、下层为含甘油的水层。",
    }),
  },
  {
    id: "ethanol-dehydration-ethylene",
    name: "乙醇的消去制乙烯",
    // 浓硫酸 170 ℃ 脱水成烯（消去），140 ℃ 则成乙醚（分子间脱水）。
    // 判据是「浓硫酸 + 乙醇」，产气且能使溴水褪色 —— 后者是乙烯的检验依据，
    // 故体系含溴水时必须报颜色变化
    //
    // ⚠️ 必须排除羧酸在场：同样是「乙醇 + 浓硫酸」，加了羧酸就是酯化
    // （60~80 ℃ 水浴即可），不加才是 170 ℃ 强热消去 —— 温度差了一百度，
    // 产物一个是液态酯一个是气态乙烯。本规则注册在 esterification 之前，
    // 不排除就会把全部酯化实验（乙酸乙酯、苯甲酸乙酯…）报成制乙烯
    match: (inputs) =>
      hasAnyFormula(inputs, ["C2H5OH"]) &&
      isConcentrated(inputs, "H2SO4") &&
      !hasAnyFormula(inputs, ESTER_ACIDS),
    build: (inputs) => {
      const hasBromine = hasAnyFormula(inputs, ["Br2"]);
      const hasKmno4 = hasAnyFormula(inputs, ["KMnO4"]);
      return {
        products: [
          { formula: "C2H4", name: "乙烯", category: "gas" as const },
          { formula: "H2O", name: "水", category: "water" as const },
        ],
        producesGas: true,
        producesPrecipitate: false,
        colorChange: hasBromine || hasKmno4,
        thermal: "exothermic" as const,
        phTrend: "unknown" as const,
        equation: "C₂H₅OH --浓H₂SO₄, 170℃--> CH₂=CH₂↑ + H₂O",
        description: hasBromine
          ? "浓硫酸在 170 ℃ 使乙醇分子内脱水生成乙烯，气体通入溴水后橙色褪去，证明含碳碳双键 —— 须先经氢氧化钠溶液除去副产物二氧化硫，否则 SO₂ 同样能使溴水褪色，检验就失去意义。"
          : hasKmno4
            ? "生成的乙烯使酸性高锰酸钾紫色褪去，但该试剂对 SO₂ 也响应，故检验双键更宜用溴水并先除杂。"
            : "浓硫酸兼作脱水剂与催化剂，须迅速升温到 170 ℃：温度偏低（140 ℃）会转而生成乙醚，温度过高则乙醇碳化使液体变黑。",
      };
    },
  },
  {
    id: "halogen-extraction",
    name: "卤素的萃取分层",
    // 不是化学反应：碘从水层转移到有机层，靠"相似相溶"。观察量是分层与
    // 两层颜色的对调，这正是萃取实验唯一的看点。
    //
    // ⚠️ 两处排除，否则会抢走真正发生化学变化的实验：
    //   ① 苯本身既是萃取剂又是溴代底物，「苯 + 溴 + 铁粉」目的是取代放 HBr，
    //      若判成萃取就丢了产气这个取代判据；
    //   ② 「氯水 + 溴化钾 + 四氯化碳」里四氯化碳只是把置换出的溴显色，
    //      主反应仍是卤素置换。有卤化物盐在场时让位给 redox 规则
    match: (inputs) =>
      hasAnyFormula(inputs, ["I2", "Br2"]) &&
      inputs.some((s) => s.formula in EXTRACTANT) &&
      !hasAnyFormula(inputs, ARENE_CATALYST) &&
      !hasAnyFormula(inputs, HALIDE_SALT),
    build: (inputs) => {
      const solvent = inputs.find((s) => s.formula in EXTRACTANT)!;
      const spec = EXTRACTANT[solvent.formula];
      const halogen = hasAnyFormula(inputs, ["I2"]) ? "碘" : "溴";
      return {
        products: [
          { formula: solvent.formula, name: `含${halogen}的${spec.name}层`, category: "organic" as const },
        ],
        producesGas: false,
        producesPrecipitate: false,
        colorChange: true,
        thermal: "none" as const,
        phTrend: "neutral" as const,
        equation: `${halogen}(水层) ⇌ ${halogen}(${spec.name}层)　分配系数远大于 1`,
        description: `${halogen}在${spec.name}中的溶解度远大于在水中，振荡静置后几乎全部转移到有机层：${
          spec.denser
            ? `${spec.name}密度大于水，故${spec.tint}色的有机层在下、褪色的水层在上`
            : `${spec.name}密度小于水，故${spec.tint}色的有机层在上、褪色的水层在下`
        }。萃取剂必须与水不相溶且不与溶质反应，这也是不能用乙醇萃取碘水的原因。`,
      };
    },
  },
];
