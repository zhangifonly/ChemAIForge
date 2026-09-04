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
  // 深蓝是「氢氧化铜溶于氨水」的唯一看点，漏登记会让这个实验在 3D 里毫无变化
  "[Cu(NH3)4](OH)2": { top: "#4a6fd0", bottom: "#1f3aa0" }, // 四氨合铜·深蓝
  "[Co(NH3)6]2+": { top: "#c9a8d9", bottom: "#8a5ab0" }, // 钴氨配离子·紫红
  "[M-EDTA]": { top: "#bfe6dc", bottom: "#6fbfae" }, // EDTA 螯合物·浅青（多数金属螯合后色浅）
  // —— 酯化产物：酯层无色透明，与酸醇混合液的差异体现在分层而非色相 ——
  CH3COOC2H5: { top: "#f7fbfd", bottom: "#e6f1f7" }, // 乙酸乙酯·无色
  HCOOC2H5: { top: "#f7fbfd", bottom: "#e6f1f7" }, // 甲酸乙酯·无色
  C2H5COOC2H5: { top: "#f7fbfd", bottom: "#e6f1f7" }, // 丙酸乙酯·无色
  CH3COOC3H7: { top: "#f7fbfd", bottom: "#e6f1f7" }, // 乙酸丙酯·无色
  CH3COOC4H9: { top: "#f7fbfd", bottom: "#e6f1f7" }, // 乙酸丁酯·无色
  C6H5COOC2H5: { top: "#f7fbfd", bottom: "#e6f1f7" }, // 苯甲酸乙酯·无色
  // —— 置换反应生成的无色盐：必须显式登记，不能靠"查不到"来表示无色 ——
  // 查不到会让 productTint 返回 null，3D 便保持反应前的颜色不动 ——
  // 而「锌置换铜」的看点恰恰是蓝色褪成无色。同理钴的粉红褪去、镍的绿褪去。
  ZnSO4: { top: "#f4f9fc", bottom: "#e0edf5" }, // 硫酸锌·无色
  ZnCl2: { top: "#f4f9fc", bottom: "#e0edf5" }, // 氯化锌·无色
  "Zn(NO3)2": { top: "#f4f9fc", bottom: "#e0edf5" }, // 硝酸锌·无色
  MgSO4: { top: "#f4f9fc", bottom: "#e0edf5" }, // 硫酸镁·无色
  MgCl2: { top: "#f4f9fc", bottom: "#e0edf5" }, // 氯化镁·无色
  "Mg(NO3)2": { top: "#f4f9fc", bottom: "#e0edf5" }, // 硝酸镁·无色
  AlCl3: { top: "#f4f9fc", bottom: "#e0edf5" }, // 氯化铝·无色
  "Al2(SO4)3": { top: "#f4f9fc", bottom: "#e0edf5" }, // 硫酸铝·无色
  SnCl2: { top: "#f4f9fc", bottom: "#e0edf5" }, // 氯化亚锡·无色
  "Pb(NO3)2": { top: "#f4f9fc", bottom: "#e0edf5" }, // 硝酸铅·无色
  CdSO4: { top: "#f4f9fc", bottom: "#e0edf5" }, // 硫酸镉·无色
  NiCl2: { top: "#9fd9a8", bottom: "#4fae5e" }, // 氯化镍·绿
  // —— 离子式产物：引擎有的规则直接返回离子，与整体盐式两种写法都要登记 ——
  // 这些反应既不产沉淀也不冒气泡，液色是唯一的可见变化，
  // 查不到色表就等于 3D 里什么都没发生
  "Fe3+": { top: "#e0b56a", bottom: "#b9772c" }, // 铁(III)·黄棕
  "Fe³⁺": { top: "#e0b56a", bottom: "#b9772c" }, // 同上（全角上标写法）
  "Fe2+": { top: "#bfe0b6", bottom: "#7fbf86" }, // 铁(II)·浅绿
  "Cr3+": { top: "#8fd9c8", bottom: "#2f9b86" }, // 铬(III)·绿（重铬酸盐被还原的终态）
  "Co3+": { top: "#c9a8d9", bottom: "#8a5ab0" }, // 钴(III)氨配合物·紫红
  "CrO4^2-": { top: "#f5d96a", bottom: "#e0b62c" }, // 铬酸根·黄
  "Cr2O7^2-": { top: "#f0b06a", bottom: "#d9722c" }, // 重铬酸根·橙
  "[Co(SCN)4]2-": { top: "#5a8fd9", bottom: "#1f4aa8" }, // 四硫氰钴·亮蓝
  "[CuCl4]2-": { top: "#4fbf9f", bottom: "#1f8f6f" }, // 四氯合铜·黄绿（浓盐酸中由蓝转绿）
  "[Fe-phenolate]": { top: "#a06ac0", bottom: "#5a2a8a" }, // 酚铁配合物·紫
  "[Fe(CN)6]-mix": { top: "#e8d98a", bottom: "#c9b23a" }, // 铁氰/亚铁氰混合·黄
  "[Ca-EDTA]2-": { top: "#bfe6dc", bottom: "#6fbfae" }, // 钙-EDTA 螯合物·浅青
  "X-": { top: "#f4f9fc", bottom: "#e0edf5" }, // 卤素被还原为卤离子·无色（溴水/碘水褪色）
  // —— 溴水褪色类：加成/取代产物都是无色，「橙棕褪成无色」就是全部看点 ——
  C2H4Br2: { top: "#f7fbfd", bottom: "#e6f1f7" }, // 1,2-二溴乙烷·无色
  C2H2Br4: { top: "#f7fbfd", bottom: "#e6f1f7" }, // 四溴乙烷·无色
  C8H8Br2: { top: "#f7fbfd", bottom: "#e6f1f7" }, // 苯乙烯溴加成物·无色
  // —— 碘量法终点：I₂ 被还原为无色 I⁻，蓝色/棕色恰好消失即为终点 ——
  NaI: { top: "#f4f9fc", bottom: "#e0edf5" }, // 碘化钠·无色
  Na2S4O6: { top: "#f4f9fc", bottom: "#e0edf5" }, // 连四硫酸钠·无色
  // —— 水解产物：酯水解后油状酯层消失，液相回到无色澄清 ——
  CH3COONa: { top: "#f4f9fc", bottom: "#e0edf5" }, // 乙酸钠·无色
  C6H12O6: { top: "#f4f9fc", bottom: "#e0edf5" }, // 葡萄糖·无色（淀粉水解后碘不再显蓝）
  SnSO4: { top: "#f4f9fc", bottom: "#e0edf5" }, // 硫酸亚锡·无色（锡置换铜后蓝色褪去）
  PbSO4: { top: "#f4f9fc", bottom: "#e0edf5" }, // 硫酸铅·上层清液无色（本体为白色沉淀，见 PRECIPITATE 表）
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
  // —— 以下为原表遗漏项。未收录时 precipitateColor 一律回退白色 #f5f7f9，
  //    对白色沉淀无妨，但黑色 Ag₂S、亮黄 PbCrO₄、粉红 Co(OH)₂、绿 Ni(OH)₂ 全被画成白色，
  //    而颜色正是这些沉淀的鉴定依据 —— 3D 里看到白色，结论就反了 ——
  // 有色氢氧化物：过渡金属的特征色，是「按沉淀颜色判断阳离子」这类实验的全部依据
  "Co(OH)2": "#f0a0b8", // 粉红（久置被空气氧化转棕黑）
  "Ni(OH)2": "#5fbf72", // 苹果绿
  "Mn(OH)2": "#c98f5a", // 白色迅速氧化为棕色
  "Cr(OH)3": "#4fae96", // 灰绿
  "Zn(OH)2": "#f4f7f9", // 白（两性，溶于过量碱）
  // 有色铬酸盐 / 硫化物 / 单质
  PbCrO4: "#f2c81a", // 铬黄（曾用作黄色颜料）
  BaCrO4: "#f5e08a", // 浅黄
  "Ag2S": "#17171c", // 黑（银器发黑的元凶）
  AgOH: "#f2f5f8", // 白（配银氨溶液时先析出，继续加氨即溶解）
  Ag: "#d8dde2", // 银镜·金属光泽的亮灰白
  S: "#f0e07a", // 淡黄（硫代硫酸盐遇酸析出的乳黄浑浊）
  // 普鲁士蓝 / 特征螯合物：颜色即检验结论
  "KFe[Fe(CN)6]": "#2f52a8", // 普鲁士蓝·深蓝
  "Ni(DMG)2": "#e0304a", // 丁二酮肟镍·鲜红（镍的经典重量分析）
  // 白色难溶盐：颜色不是看点，但登记后语义明确，也避免误以为漏配
  BaSO3: "#f7f9fa", CaSO3: "#f7f9fa", SrSO4: "#fbfcfd", SrCO3: "#f7f9fa",
  MgCO3: "#f7f9fa", FeCO3: "#e8e4d8", PbSO4: "#fbfcfd", PbCl2: "#f7f9fa",
  CaF2: "#f7f9fa", "Ca3(PO4)2": "#f7f9fa", "Ba3(PO4)2": "#f7f9fa",
  "Ag2CO3": "#f2eddc", "Ag2SO4": "#fbfcfd", "Ag3PO4": "#f0dc90", // 磷酸银·黄
  // 有机固体：重结晶与取代反应析出的白色晶体
  C6H5COOH: "#fbfcfd", // 苯甲酸·白色针状
  C7H6O3: "#fbfcfd", // 水杨酸·白色晶体
  "C6H2Br3OH": "#fbfcfd", // 三溴苯酚·白色（苯酚遇溴水的定性依据）
  "C6H2Br3NH2": "#fbfcfd", // 三溴苯胺·白色
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
