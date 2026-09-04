// 金属外观表（纯数据，可单测）：化学式 → 真实金属色与实验室常见形态。
// 与 appearance.ts 分工：那边管溶液/沉淀/气体，这边管金属单质固体。
import { PRECIPITATE_COLOR } from "@/lib/chem/appearance";

export type MetalShape = "grain" | "strip" | "wire" | "sheet";

export interface MetalLook {
  color: string;
  roughness: number;
  metalness: number;
  shape: MetalShape;
}

/** 常见金属的外观与实验室常用形态 */
export const METAL_LOOK: Record<string, MetalLook> = {
  Zn: { color: "#b9c2c8", roughness: 0.42, metalness: 0.82, shape: "grain" }, // 锌粒·青灰
  Fe: { color: "#8f949a", roughness: 0.5, metalness: 0.78, shape: "wire" }, // 铁丝·灰
  Cu: { color: "#c87a45", roughness: 0.32, metalness: 0.88, shape: "sheet" }, // 铜片·紫红
  Mg: { color: "#d5d9dc", roughness: 0.38, metalness: 0.72, shape: "strip" }, // 镁条·银白
  Al: { color: "#cfd6da", roughness: 0.3, metalness: 0.85, shape: "sheet" }, // 铝片·银白
  Ag: { color: "#e3e6e8", roughness: 0.16, metalness: 0.95, shape: "sheet" }, // 银·亮白
  Na: { color: "#dcdcd6", roughness: 0.62, metalness: 0.5, shape: "grain" }, // 钠块·暗银（易氧化）
  K: { color: "#d2d2cc", roughness: 0.66, metalness: 0.46, shape: "grain" }, // 钾·暗银
  Sn: { color: "#c4c8cc", roughness: 0.36, metalness: 0.8, shape: "sheet" }, // 锡
  Pb: { color: "#8d9298", roughness: 0.55, metalness: 0.7, shape: "sheet" }, // 铅·暗灰
  Ni: { color: "#c6cbc8", roughness: 0.3, metalness: 0.88, shape: "sheet" }, // 镍
  C: { color: "#2a2c30", roughness: 0.8, metalness: 0.15, shape: "grain" }, // 碳（石墨/木炭）
  S: { color: "#e8d44a", roughness: 0.72, metalness: 0.05, shape: "grain" }, // 硫粉·黄
  P: { color: "#d94f3a", roughness: 0.7, metalness: 0.08, shape: "grain" }, // 红磷
  Ca: { color: "#cfd0c8", roughness: 0.6, metalness: 0.55, shape: "grain" }, // 钙屑·银白偏暗（表面易生氧化膜）
  Cd: { color: "#c3c8cc", roughness: 0.34, metalness: 0.82, shape: "sheet" }, // 镉片·蓝白色金属光泽
};

/** 默认外观：未收录的固体按灰色颗粒处理 */
export const DEFAULT_METAL_LOOK: MetalLook = {
  color: "#a8adb2",
  roughness: 0.5,
  metalness: 0.6,
  shape: "grain",
};

export function metalLook(formula: string): MetalLook {
  return METAL_LOOK[formula] ?? DEFAULT_METAL_LOOK;
}

/**
 * 非金属固体（氧化物 / 碳酸盐 / 难溶盐 / 有机固体）的外观。
 * 这些物质在实验里以粉末或块状投入，形态一律按颗粒堆处理，颜色是关键辨识特征
 * （黑色氧化铜、红色氧化铁、白色碳酸钙……），不给色就成了一堆灰点看不出是什么。
 */
export const SOLID_LOOK: Record<string, MetalLook> = {
  CuO: { color: "#1f2124", roughness: 0.85, metalness: 0.08, shape: "grain" }, // 氧化铜·黑
  Cu2O: { color: "#b8452c", roughness: 0.8, metalness: 0.1, shape: "grain" }, // 氧化亚铜·砖红
  Fe2O3: { color: "#8f3520", roughness: 0.86, metalness: 0.06, shape: "grain" }, // 氧化铁·红棕
  Fe3O4: { color: "#26282c", roughness: 0.72, metalness: 0.32, shape: "grain" }, // 四氧化三铁·黑（磁性）
  FeO: { color: "#2c2e32", roughness: 0.84, metalness: 0.1, shape: "grain" },
  MgO: { color: "#f4f6f7", roughness: 0.92, metalness: 0.03, shape: "grain" }, // 氧化镁·白
  CaO: { color: "#f2f4f2", roughness: 0.94, metalness: 0.03, shape: "grain" }, // 生石灰·白
  Al2O3: { color: "#eef1f3", roughness: 0.9, metalness: 0.04, shape: "grain" },
  MnO2: { color: "#232528", roughness: 0.88, metalness: 0.07, shape: "grain" }, // 二氧化锰·黑
  ZnO: { color: "#f6f7f5", roughness: 0.92, metalness: 0.03, shape: "grain" },
  CaCO3: { color: "#f6f7f8", roughness: 0.9, metalness: 0.04, shape: "grain" }, // 大理石·白
  NaHCO3: { color: "#fafbfb", roughness: 0.93, metalness: 0.03, shape: "grain" },
  Na2CO3: { color: "#f8f9fa", roughness: 0.93, metalness: 0.03, shape: "grain" },
  K2CO3: { color: "#f8f9fa", roughness: 0.93, metalness: 0.03, shape: "grain" }, // 碳酸钾·白（易潮解）
  NH4HCO3: { color: "#fafbfb", roughness: 0.9, metalness: 0.03, shape: "grain" }, // 碳酸氢铵·白色晶粒
  Na2O2: { color: "#f5f0c8", roughness: 0.9, metalness: 0.04, shape: "grain" }, // 过氧化钠·淡黄（区别于白色 Na₂O，颜色即判据）
  Na2O: { color: "#f6f7f4", roughness: 0.93, metalness: 0.03, shape: "grain" }, // 氧化钠·白
  KMnO4: { color: "#4a1060", roughness: 0.6, metalness: 0.2, shape: "grain" }, // 高锰酸钾晶体·紫黑
  KNO3: { color: "#fafbfc", roughness: 0.68, metalness: 0.06, shape: "grain" }, // 硝酸钾晶体
  CuSO4: { color: "#2f7fc7", roughness: 0.55, metalness: 0.12, shape: "grain" }, // 胆矾·蓝晶
  I2: { color: "#3a2c3f", roughness: 0.55, metalness: 0.3, shape: "grain" }, // 碘·紫黑有光泽
  "Al(OH)3": { color: "#f0f3f5", roughness: 0.95, metalness: 0.02, shape: "grain" },
  "Ca(OH)2": { color: "#f4f6f4", roughness: 0.95, metalness: 0.02, shape: "grain" }, // 熟石灰粉末·白（仅石灰乳/熟石灰形态会画出固体）
  "Fe(OH)3": { color: "#b04a24", roughness: 0.94, metalness: 0.03, shape: "grain" },
  C6H5OH: { color: "#f7f4ea", roughness: 0.72, metalness: 0.05, shape: "grain" }, // 苯酚·白晶
  fat: { color: "#f5efdc", roughness: 0.86, metalness: 0.04, shape: "grain" }, // 油脂
  starch: { color: "#fbfbf8", roughness: 0.95, metalness: 0.02, shape: "grain" }, // 淀粉
};

/**
 * 取固体外观：金属 → 非金属固体表 → 难溶物颜色表 → 灰色颗粒兜底。
 *
 * 第三级是关键：难溶物投入时也按固体渲染（见 scenePlan.pickSolid），而
 * PRECIPITATE_COLOR 里已经存着它们的准确颜色（黑色 FeS、黄色 AgI、绿色 Ni(OH)₂…），
 * 复用即可，不必在本表手抄一遍——否则新增沉淀又要两处同步，漏一处就画成灰点，
 * 而颜色恰恰是这些实验的鉴定依据。
 */
export function solidLook(formula: string): MetalLook {
  const known = METAL_LOOK[formula] ?? SOLID_LOOK[formula];
  if (known) return known;
  const precip = PRECIPITATE_COLOR[formula];
  if (precip) return { color: precip, roughness: 0.93, metalness: 0.03, shape: "grain" };
  return DEFAULT_METAL_LOOK;
}

/** 该化学式是否有已知固体外观（用于判断"值不值得渲染成固体"） */
export function hasSolidLook(formula: string): boolean {
  return formula in METAL_LOOK || formula in SOLID_LOOK || formula in PRECIPITATE_COLOR;
}
