// 相态与外观补充层：把"不靠液体颜色"的可见现象抽成数据。
//
// 有相当一批实验的看点既不是液色也不是气泡/沉淀，而是：
//   · 分层  —— 酯 / 苯 / 四氯化碳等与水互不相溶，形成上下两层（酯化、萃取、酯水解）
//   · 浑浊  —— 微溶物 / 有机物析出成乳浊液（苯酚遇水、苯酚钠通 CO₂、盐析）
//   · 结晶  —— 热饱和溶液冷却析出晶体（重结晶、溶解度测定）
//   · 气体着色 —— 注射器内平衡气体随压强改变颜色深浅（NO₂ ⇌ N₂O₄）
// 这些能力与具体实验无关，一次实现即可被全部实验复用。
import type { ReactionResult, Substance } from "./engine";

/** 与水互不相溶的有机相：密度决定它浮在上层还是沉在下层 */
export interface OrganicPhaseSpec {
  /** 相对水的位置：上层（密度<1）/ 下层（密度>1） */
  side: "top" | "bottom";
  /** 相的颜色（无色有机相取淡黄白，便于在 3D 中看出界面） */
  color: string;
  /** 中文名，用于讲解与提示 */
  label: string;
}

/**
 * 常见不溶于水的有机溶剂 / 酯类。
 * 密度是判断分层方向的唯一依据：CCl₄(1.59) 沉底，酯与苯(0.7~0.9) 浮顶。
 */
export const ORGANIC_PHASE: Record<string, OrganicPhaseSpec> = {
  CH3COOC2H5: { side: "top", color: "#f4f1e2", label: "乙酸乙酯层" },
  CH3COOCH3: { side: "top", color: "#f4f1e2", label: "乙酸甲酯层" },
  HCOOCH3: { side: "top", color: "#f4f1e2", label: "甲酸甲酯层" },
  HCOOC2H5: { side: "top", color: "#f4f1e2", label: "甲酸乙酯层" },
  C6H6: { side: "top", color: "#f2efe0", label: "苯层" },
  C7H8: { side: "top", color: "#f2efe0", label: "甲苯层" },
  petroleum: { side: "top", color: "#f6e9bd", label: "汽油层" },
  fat: { side: "top", color: "#f7e9a8", label: "油脂层" },
  CCl4: { side: "bottom", color: "#eef3f5", label: "四氯化碳层" },
};

/** 萃取后有机相被溶质染色：碘的 CCl₄ 层紫红、溴的层橙红 */
export const EXTRACT_TINT: Record<string, string> = {
  I2: "#7b2d8b",
  Br2: "#c2551f",
};

/**
 * 微溶 / 难溶于水而呈乳浊的物质：这类实验的看点就是"浑浊 ⇌ 澄清"的往复。
 * 苯酚常温微溶呈乳浊，加碱生成苯酚钠澄清，再通 CO₂ 又析出苯酚变浑浊。
 */
export const TURBID_FORMULAS = new Set([
  "C6H5OH", // 苯酚：常温水中乳浊
  "C7H6O3", // 水杨酸：微溶
  // ⚠️ 这里绝不能放 Ca(OH)₂。它虽是微溶物，但实验里用的是「澄清」石灰水 ——
  // 二十多个实验（检验 CO₂、验证燃烧产物、氨气制备）的唯一看点正是
  // 「原本澄清 → 通入气体后变浑浊」。把它登记成乳浊，反应前就是一杯白汤，
  // 这个对比彻底消失。通气后的浑浊来自产物 CaCO₃，由沉淀层负责绘制。
  "fat", // 油脂在水中乳化
  "soap-solution",
  "starch", // 淀粉糊呈乳白半透明
]);

/**
 * 靠名称而非化学式判定的浊液：同一个 Ca(OH)₂，「澄清石灰水」是澄清溶液，
 * 「石灰乳 / 熟石灰」是过量固体悬浮的白色浊液。化学式分不出，只能看标签。
 */
const TURBID_NAME_KEYWORDS = ["石灰乳", "熟石灰", "生石灰", "乳浊"];

/** 该物质是否以浊液形式存在（化学式白名单 或 名称白名单） */
export function isTurbidSubstance(s: Substance): boolean {
  if (TURBID_FORMULAS.has(s.formula)) return true;
  return TURBID_NAME_KEYWORDS.some((k) => s.name.includes(k));
}

/** 判断体系是否呈浑浊（乳浊液）。生成澄清产物的反应会解除浑浊 */
export function isTurbid(contents: Substance[], result: ReactionResult | null): boolean {
  const hasTurbid = contents.some(isTurbidSubstance);
  if (!hasTurbid) return false;
  // 苯酚 + NaOH → 苯酚钠（可溶）时体系变澄清；但若产物里又出现难溶物则仍浑浊
  if (result?.reacted) {
    const productTurbid = result.products.some((p) => TURBID_FORMULAS.has(p.formula));
    const clearing = result.products.some((p) => CLEARING_PRODUCTS.has(p.formula));
    if (clearing && !productTurbid) return false;
  }
  return true;
}

/** 使乳浊液变澄清的可溶产物（生成盐即溶解） */
export const CLEARING_PRODUCTS = new Set(["C6H5ONa", "CH3COONa", "RCOONa", "NaAlO2"]);

/** 找出体系中的有机相；同时存在多个时取先出现的那一个 */
export function findOrganicPhase(contents: Substance[]): OrganicPhaseSpec | null {
  for (const c of contents) {
    const spec = ORGANIC_PHASE[c.formula];
    if (spec) return spec;
  }
  return null;
}

/** 有机相是否被萃取的卤素染色，返回染色后的颜色 */
export function extractedColor(contents: Substance[], base: string): string {
  for (const c of contents) {
    const tint = EXTRACT_TINT[c.formula];
    if (tint) return tint;
  }
  return base;
}

/**
 * 可通过"热溶冷析"重结晶的物质及其晶体外观。
 * 判定结晶的条件是：体系里有这类溶质 + 溶解度随温度显著变化的实验语境（降温）。
 */
export const CRYSTAL_LOOK: Record<string, { color: string; label: string }> = {
  KNO3: { color: "#f4f6f8", label: "硝酸钾针状晶体" },
  C7H6O3: { color: "#fbfaf3", label: "水杨酸白色晶体" },
  CuSO4: { color: "#2f7fc7", label: "硫酸铜蓝色晶体" },
  NaCl: { color: "#fafbfc", label: "氯化钠立方晶体" },
  Na2CO3: { color: "#f7f9fa", label: "碳酸钠晶体" },
  "CH3COONa": { color: "#f8fafb", label: "乙酸钠晶体" },
};

/** 找出可结晶溶质（用于重结晶 / 溶解度测定的晶体析出动画） */
export function findCrystal(contents: Substance[]) {
  for (const c of contents) {
    const look = CRYSTAL_LOOK[c.formula];
    if (look) return { formula: c.formula, ...look };
  }
  return null;
}

/**
 * 气体的颜色深浅随压强变化（勒沙特列原理的可视化）。
 * 注射器压缩 → 浓度升高先变深，平衡右移（2NO₂ → N₂O₄）后又变浅。
 */
export const COLORED_GAS: Record<string, string> = {
  NO2: "#b1481f",
  Br2: "#a3491c",
  Cl2: "#c8d96a",
  I2: "#6d3a86",
};

/**
 * 估算体系 pH，供 pH 计显示。这里只做定性分级而非严格计算：
 * 强酸强碱给极端值，弱酸弱碱给温和值，缓冲体系（弱酸+其共轭碱）锁在 4.7 附近
 * 并且几乎不随少量酸碱改变——这正是缓冲实验要让学生看到的。
 */
const STRONG_ACID = new Set(["HCl", "H2SO4", "HNO3"]);
const WEAK_ACID = new Set(["CH3COOH", "HCOOH", "H2CO3", "C6H5OH", "H3PO4", "C6H8O7", "C7H6O3"]);
const STRONG_BASE = new Set(["NaOH", "KOH", "Ba(OH)2"]);
const WEAK_BASE = new Set(["NH3·H2O", "NH3", "Ca(OH)2", "Al(OH)3", "Mg(OH)2"]);
/** 弱酸的共轭碱盐：与对应弱酸共存即构成缓冲对 */
const CONJUGATE_SALT = new Set(["CH3COONa", "Na2CO3", "NaHCO3", "C6H5ONa", "Na3PO4"]);

export function estimatePh(contents: Substance[]): number {
  const f = contents.map((c) => c.formula);
  const hasWeakAcid = f.some((x) => WEAK_ACID.has(x));
  const hasConjugate = f.some((x) => CONJUGATE_SALT.has(x));
  // 缓冲对优先判定：即使同时加了强酸强碱，缓冲液的读数也几乎不动
  if (hasWeakAcid && hasConjugate) return 4.74;
  const strongA = f.some((x) => STRONG_ACID.has(x));
  const strongB = f.some((x) => STRONG_BASE.has(x));
  if (strongA && strongB) return 7.0; // 强酸强碱等量中和
  if (strongA) return 1.2;
  if (strongB) return 13.0;
  if (hasWeakAcid) return 3.4;
  if (f.some((x) => WEAK_BASE.has(x))) return 11.1;
  if (hasConjugate) return 9.2; // 强碱弱酸盐水解显碱性
  return 7.0;
}

/** 易被碱液 / 水大量吸收的气体：吸收后瓶内压强骤降 */
const ABSORBABLE_GAS = new Set(["CO2", "SO2", "NH3", "HCl", "Cl2", "H2S", "NO2"]);

/**
 * 判断"气体被溶液吸收致内压下降"。
 * 条件是：投入了可被吸收的气体 + 确实发生了反应把它消耗掉，
 * 且反应本身不再产气（否则压强不降反升，看点不成立）。
 */
export function isGasAbsorbed(contents: Substance[], result: ReactionResult | null): boolean {
  const gas = contents.find((c) => c.category === "gas" && ABSORBABLE_GAS.has(c.formula));
  if (!gas) return false;
  if (!result?.reacted) return false;
  return !result.producesGas;
}

/**
 * 判断吸热是"体系自己变冷"（溶解吸热，如硝酸铵制冰袋）而非"需要外部供热"
 * （分解反应需酒精灯）。前者不该画加热源，否则暗示完全相反。
 * 依据是溶解规则方程式里的 `--H₂O-->` 溶解标记。
 */
export function isSelfCooling(result: ReactionResult): boolean {
  return result.thermal === "endothermic" && (result.equation?.includes("--H₂O-->") ?? false);
}

/** 找出注射器内有色气体，用于压强-颜色联动 */
export function findColoredGas(contents: Substance[]): { formula: string; color: string } | null {
  for (const c of contents) {
    const color = COLORED_GAS[c.formula];
    if (color && c.category === "gas") return { formula: c.formula, color };
  }
  return null;
}
