// 物质外观（纯数据 + 纯函数）：把化学式映射为真实的溶液色 / 沉淀色 / 气体色。
// 2D 的 Glassware 与 3D 的通用场景共用这一份，避免同一物质在两种视图里颜色不一致。
// 只描述"看起来是什么颜色"，不含任何反应判定。

/** 溶液色：上浅下深（液柱有厚度，底部更饱和） */
export interface SolutionTint {
  top: string;
  bottom: string;
}

// 无色澄清液（水 / 稀酸碱 / 无色盐溶液）的默认色。
// 略带青蓝而非纯白：纯白液体在浅色台面/浅灰背景下会与器皿玻璃糊在一起看不出液面，
// 真实澄清液体因厚度与折射也确有淡青感。
export const CLEAR_TINT: SolutionTint = { top: "#cfe4f0", bottom: "#a9c8dd" };

/** 常见有色离子 / 物质的溶液特征色 */
export const SOLUTION_TINT: Record<string, SolutionTint> = {
  CuSO4: { top: "#7cc0ea", bottom: "#2f7fc7" }, // 硫酸铜·蓝
  CuCl2: { top: "#7fcadf", bottom: "#2f9bbf" }, // 氯化铜·蓝绿
  "Cu(NO3)2": { top: "#7cc0ea", bottom: "#2f7fc7" }, // 硝酸铜·蓝
  FeCl3: { top: "#e0b56a", bottom: "#b9772c" }, // 氯化铁·黄棕
  "Fe(NO3)3": { top: "#e0b56a", bottom: "#b9772c" },
  FeCl2: { top: "#bfe0b6", bottom: "#7fbf86" }, // 氯化亚铁·浅绿
  FeSO4: { top: "#bfe0b6", bottom: "#7fbf86" },
  KMnO4: { top: "#c08fe0", bottom: "#7a2fb0" }, // 高锰酸钾·紫
  K2Cr2O7: { top: "#f0b06a", bottom: "#d9722c" }, // 重铬酸钾·橙
  K2CrO4: { top: "#f5d96a", bottom: "#e0b62c" }, // 铬酸钾·黄
  I2: { top: "#c9a06a", bottom: "#8a5a2c" }, // 碘·棕
  CoCl2: { top: "#f0a0b8", bottom: "#d95a82" }, // 氯化钴·粉红
  NiSO4: { top: "#9fd9a8", bottom: "#4fae5e" }, // 硫酸镍·绿
  CrCl3: { top: "#8fd9c8", bottom: "#2f9b86" }, // 氯化铬·绿
  "Ni(NO3)2": { top: "#9fd9a8", bottom: "#4fae5e" },
  MnSO4: { top: "#f7dfe8", bottom: "#e8b6c8" }, // 硫酸锰·极浅粉
  Br2: { top: "#e09a6a", bottom: "#b8542c" }, // 溴水·橙棕
  // —— 反应产物：有色配合物 / 离子（引擎产物化学式，用于反应后液色过渡）——
  "Fe(SCN)3": { top: "#c8302a", bottom: "#8f1410" }, // 硫氰合铁·血红
  "[Cu(NH3)4]2+": { top: "#4a6fd0", bottom: "#1f3aa0" }, // 铜氨配离子·深蓝
  "[Co(H2O)6]2+": { top: "#f0a0b8", bottom: "#d95a82" }, // 水合钴·粉红
  "Mn2+": { top: "#f9e8ef", bottom: "#f0d2e0" }, // 锰(II)·几乎无色（紫色褪去）
  "I2-starch": { top: "#4a3f8f", bottom: "#241a5c" }, // 碘遇淀粉·蓝紫
  "KFe[Fe(CN)6]": { top: "#2f52a8", bottom: "#122c72" }, // 普鲁士蓝
  Fe2: { top: "#bfe0b6", bottom: "#7fbf86" },
  "Fe2(SO4)3": { top: "#e0b56a", bottom: "#b9772c" }, // 硫酸铁·黄棕
  // 标记式产物（引擎用它表示"某种可见变化"，而非严格化学式）
  "fe-scn": { top: "#c8302a", bottom: "#8f1410" }, // 血红
  "fe2-oxidized": { top: "#e0b56a", bottom: "#b9772c" }, // Fe²⁺→Fe³⁺ 转黄棕
  "kmno4-decolor": { top: "#f9e8ef", bottom: "#f0d2e0" }, // 紫色褪去
  "K3[Fe(CN)6]": { top: "#e8d98a", bottom: "#c9b23a" }, // 铁氰化钾·黄
  "K4[Fe(CN)6]": { top: "#f2e9a8", bottom: "#d8c85a" }, // 亚铁氰化钾·浅黄
  // —— 配位溶解产物：沉淀被配体拉回溶液，液色由浑浊转为澄清有色 ——
  "[Ag(NH3)2]+": { top: "#f0f4f8", bottom: "#d8e4ee" }, // 二氨合银·无色澄清（较纯水略带灰蓝）
  "[Ag(S2O3)2]3-": { top: "#eef3f7", bottom: "#d4e2ec" }, // 硫代硫酸合银·无色澄清（定影液）
  "[Zn(NH3)4]2+": { top: "#eef6fa", bottom: "#d2e6f0" }, // 锌氨配离子·无色澄清
  "[Ni(NH3)6]2+": { top: "#8f9fe0", bottom: "#4a5ab8" }, // 镍氨配离子·蓝紫
  // 引擎产物用「配合物整体式」而非配离子式，两种写法都登记以免漏色
  "[Ni(NH3)6](OH)2": { top: "#8f9fe0", bottom: "#4a5ab8" }, // 六氨合镍·蓝紫
  "[Zn(NH3)4](OH)2": { top: "#eef6fa", bottom: "#d2e6f0" }, // 四氨合锌·无色澄清
  "[Ag(NH3)2]OH": { top: "#f0f4f8", bottom: "#d8e4ee" }, // 银氨配合物·无色澄清
  "[Co(NH3)6]2+": { top: "#c9a8d9", bottom: "#8a5ab0" }, // 钴氨配离子·紫红
  "[M-EDTA]": { top: "#bfe6dc", bottom: "#6fbfae" }, // EDTA 螯合物·浅青（多数金属螯合后色浅）
  // —— 酯化产物：酯层无色透明，与酸醇混合液的差异体现在分层而非色相 ——
  CH3COOC2H5: { top: "#f7fbfd", bottom: "#e6f1f7" }, // 乙酸乙酯·无色
  HCOOC2H5: { top: "#f7fbfd", bottom: "#e6f1f7" }, // 甲酸乙酯·无色
  C2H5COOC2H5: { top: "#f7fbfd", bottom: "#e6f1f7" }, // 丙酸乙酯·无色
  CH3COOC3H7: { top: "#f7fbfd", bottom: "#e6f1f7" }, // 乙酸丙酯·无色
  CH3COOC4H9: { top: "#f7fbfd", bottom: "#e6f1f7" }, // 乙酸丁酯·无色
  C6H5COOC2H5: { top: "#f7fbfd", bottom: "#e6f1f7" }, // 苯甲酸乙酯·无色
};

/** 常见沉淀的颜色 */
export const PRECIPITATE_COLOR: Record<string, string> = {
  "Fe(OH)3": "#b04a24", // 红棕絮状
  "Cu(OH)2": "#2f7fd0", // 蓝色絮状
  "Fe(OH)2": "#9fc4a8", // 白绿（易被氧化）
  "Mg(OH)2": "#f2f5f7", // 白
  "Al(OH)3": "#f0f3f5", // 白胶状
  AgCl: "#f4f6f7", // 白（感光变灰）
  AgBr: "#f0e6c8", // 淡黄
  AgI: "#f0dc90", // 黄
  BaSO4: "#fbfcfd", // 白（不溶于酸）
  CaCO3: "#f7f9fa", // 白
  BaCO3: "#f7f9fa",
  CuS: "#1a1a1f", // 黑
  PbS: "#17171c", // 黑
  FeS: "#20232a", // 黑
  ZnS: "#f6f8f9", // 白
  "Cu2(OH)2CO3": "#3fa08a", // 碱式碳酸铜·绿
  PbI2: "#f2d84a", // 亮黄（金色鳞片）
  "Ag2CrO4": "#a8302a", // 砖红
};

/** 气体颜色（多为无色，仅少数有色） */
export const GAS_COLOR: Record<string, string> = {
  H2: "#eaf4fb",
  O2: "#e6f3ff",
  CO2: "#eef2f5",
  N2: "#eef2f5",
  NH3: "#f0f6f2",
  Cl2: "#dbe86a", // 黄绿
  NO2: "#d97a3a", // 红棕
  SO2: "#f2f0dc",
  H2S: "#eef0e6",
};

/** 默认气体色（无色气泡） */
export const DEFAULT_GAS_COLOR = "#eef2f5";

/** 指示剂在酸性 / 中性 / 碱性中的颜色（含"无色"，如酚酞在酸中） */
export interface IndicatorColors {
  acid: SolutionTint;
  neutral: SolutionTint;
  base: SolutionTint;
}

export const INDICATOR_COLORS: Record<string, IndicatorColors> = {
  // 酚酞：酸/中性无色，碱性紫红
  phenolphthalein: {
    acid: CLEAR_TINT,
    neutral: CLEAR_TINT,
    base: { top: "#e79ac0", bottom: "#cf5f95" },
  },
  // 石蕊：酸红、中紫、碱蓝
  litmus: {
    acid: { top: "#e08a86", bottom: "#c04a44" },
    neutral: { top: "#b79ad0", bottom: "#8a63ad" },
    base: { top: "#7fa8de", bottom: "#3f6fbf" },
  },
  // 甲基橙：酸红、中橙、碱黄
  "methyl-orange": {
    acid: { top: "#e8836a", bottom: "#cc4a2c" },
    neutral: { top: "#f0a95a", bottom: "#dd7f22" },
    base: { top: "#f2d36a", bottom: "#dfb52c" },
  },
  // pH 试纸：按酸碱给出红 / 绿 / 蓝，作为整体色示意
  "ph-paper": {
    acid: { top: "#e08a86", bottom: "#c04a44" },
    neutral: { top: "#a8d9a0", bottom: "#6fae62" },
    base: { top: "#7fa8de", bottom: "#3f6fbf" },
  },
};

/** 取指示剂在给定酸碱环境下的颜色；未收录的指示剂返回 null（不改变液色） */
export function indicatorTint(
  formula: string,
  env: "acid" | "neutral" | "base",
): SolutionTint | null {
  const c = INDICATOR_COLORS[formula];
  return c ? c[env] : null;
}

/** 取溶液色：按化学式查表，未收录的按无色澄清处理 */
export function solutionTint(formula: string): SolutionTint {
  return SOLUTION_TINT[formula] ?? CLEAR_TINT;
}

/** 容器内多种溶质时，取第一个有特征色的；全无色则澄清 */
export function mixedTint(formulas: string[]): SolutionTint {
  for (const f of formulas) {
    const t = SOLUTION_TINT[f];
    if (t) return t;
  }
  return CLEAR_TINT;
}

/** 取沉淀色；未收录的按白色絮状处理（绝大多数沉淀为白色） */
export function precipitateColor(formula: string): string {
  return PRECIPITATE_COLOR[formula] ?? "#f5f7f9";
}

/** 取气体色；未收录的按无色处理 */
export function gasColor(formula: string): string {
  return GAS_COLOR[formula] ?? DEFAULT_GAS_COLOR;
}
