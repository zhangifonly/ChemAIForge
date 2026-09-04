// 显色规则：靠「溶液颜色突变」判读的定性反应。
//
// 这类反应既不产气也不生沉淀，唯一观察量就是色相——酚与铁(III)的紫色、钴与硫氰
// 的蓝色、铜的氯配离子由蓝转黄绿。它们在教学上都是经典鉴定手段，此前引擎完全
// 没有覆盖，用户在 3D 台上点「混合反应」毫无反应。
import { hasAnyFormula, isConcentrated, type Reaction } from "./helpers";

/** 一条显色规则的声明：两组物质同时在场即显色 */
type ChromoSpec = {
  id: string;
  name: string;
  groupA: string[];
  groupB: string[];
  /**
   * 要求 groupB 中该化学式必须是「浓」溶液才显色。
   * 配位平衡类显色需要高浓度配体（如 [CuCl₄]²⁻ 需浓盐酸），若不加这个约束，
   * 规则会抢走「硫酸铜 + 稀盐酸 + 氢氧化钠」这类体系里真正的沉淀现象。
   */
  requireConcentrated?: string;
  /** 产物（配合物整体式，用于 appearance.ts 取色） */
  product: { formula: string; name: string };
  equation: string;
  description: string;
};

const SPECS: ChromoSpec[] = [
  {
    id: "chromo-phenol-fe3",
    name: "酚与铁(III)显色",
    groupA: ["C6H5OH", "C7H6O3"],
    groupB: ["FeCl3", "Fe2(SO4)3", "Fe(NO3)3"],
    product: { formula: "[Fe-phenolate]", name: "酚铁配合物" },
    equation: "6C6H5OH + Fe³⁺ → [Fe(C6H5O)6]³⁻ + 6H⁺",
    description:
      "酚羟基与铁(III)生成紫色配合物，水杨酸显紫红、苯酚显紫色，是鉴别酚类的特征显色反应。",
  },
  {
    id: "chromo-cobalt-scn",
    name: "钴与硫氰显色",
    groupA: ["CoCl2", "CoSO4", "Co(NO3)2"],
    groupB: ["KSCN", "NH4SCN"],
    product: { formula: "[Co(SCN)4]2-", name: "四硫氰钴配离子" },
    equation: "Co²⁺ + 4SCN⁻ → [Co(SCN)₄]²⁻",
    description:
      "钴离子与过量硫氰根生成蓝色配离子，粉红溶液转为亮蓝，是检验微量钴的经典方法。",
  },
  {
    id: "chromo-copper-chloride",
    name: "铜的氯配离子",
    groupA: ["CuSO4", "CuCl2", "Cu(NO3)2"],
    groupB: ["HCl"],
    // 只有浓盐酸能把配位平衡推到 [CuCl₄]²⁻；稀盐酸不显色，也不该抢走别的现象
    requireConcentrated: "HCl",
    product: { formula: "[CuCl4]2-", name: "四氯合铜配离子" },
    equation: "[Cu(H2O)4]²⁺ + 4Cl⁻ ⇌ [CuCl₄]²⁻ + 4H₂O",
    description:
      "浓氯离子把水合铜离子的水配体换成氯配体，天蓝溶液转为黄绿，稀释后可逆变回，是配位平衡的直观演示。",
  },
  {
    id: "chromo-hexacyanoferrate",
    name: "铁氰配合物互变",
    groupA: ["K4[Fe(CN)6]"],
    groupB: ["K3[Fe(CN)6]"],
    product: { formula: "[Fe(CN)6]-mix", name: "铁氰配合物混液" },
    equation: "[Fe(CN)₆]⁴⁻ + [Fe(CN)₆]³⁻ 共存",
    description:
      "亚铁氰化钾浅黄与铁氰化钾橙黄混合后色深加剧，二者构成可逆氧化还原对，是电化学参比体系的常用组分。",
  },
];

export const chromogenicRules: Reaction[] = SPECS.map((spec) => ({
  id: spec.id,
  name: spec.name,
  match: (inputs) =>
    hasAnyFormula(inputs, spec.groupA) &&
    hasAnyFormula(inputs, spec.groupB) &&
    (!spec.requireConcentrated ||
      isConcentrated(inputs, spec.requireConcentrated)),
  build: () => ({
    products: [
      { formula: spec.product.formula, name: spec.product.name, category: "salt" as const },
    ],
    producesGas: false,
    producesPrecipitate: false,
    colorChange: true,
    thermal: "none" as const,
    phTrend: "neutral" as const,
    equation: spec.equation,
    description: spec.description,
  }),
}));
