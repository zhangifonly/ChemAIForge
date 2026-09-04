// 反应规则共享类型与工具函数
// 抽离到独立模块以避免 reactions.ts 与各规则模块之间的循环依赖。
import type { ReactionConditions, ReactionResult, Substance } from "../engine";

/** 一条反应规则 */
export interface Reaction {
  /** 规则唯一标识 */
  id: string;
  /** 反应名称 */
  name: string;
  /** 判断给定输入是否触发该反应 */
  match: (inputs: Substance[]) => boolean;
  /**
   * 该反应必须加热（含点燃 / 灼烧 / 水浴 / 催化氧化）才能进行。
   *
   * 声明式放在规则上、而不是把 conditions 塞进 match：match 只该管
   * 「试剂搭配对不对」这一件事，条件判定由引擎统一处理，
   * 一百多条规则也就不必各自重复写一遍温度比较。
   */
  requiresHeat?: boolean;
  /** 生成反应结果（不含 reacted 字段，由引擎补全） */
  build: (
    inputs: Substance[],
    conditions: ReactionConditions
  ) => Omit<ReactionResult, "reacted">;
}

/** 在输入中查找指定类别的物质 */
export function findByCategory(
  inputs: Substance[],
  category: Substance["category"]
): Substance | undefined {
  return inputs.find((s) => s.category === category);
}

/** 判断输入是否同时包含两个指定类别 */
export function hasCategories(
  inputs: Substance[],
  a: Substance["category"],
  b: Substance["category"]
): boolean {
  return Boolean(findByCategory(inputs, a)) && Boolean(findByCategory(inputs, b));
}

/** 判断输入是否包含某一类别 */
export function hasCategory(
  inputs: Substance[],
  c: Substance["category"]
): boolean {
  return inputs.some((s) => s.category === c);
}

/** 判断是否包含指定化学式 */
export function hasFormula(inputs: Substance[], formula: string): boolean {
  return inputs.some((s) => s.formula === formula);
}

/** 是否包含任一指定化学式 */
export function hasAnyFormula(inputs: Substance[], formulas: string[]): boolean {
  return inputs.some((s) => formulas.includes(s.formula));
}

/**
 * 判断某化学式对应的试剂是否为浓溶液。浓度不进化学式，只体现在试剂中文名里
 * （"浓硫酸" / "稀硝酸"），而铜与浓硫酸放 SO₂、与浓硝酸放红棕 NO₂、与稀硝酸放
 * 无色 NO，产物完全不同，故必须能从名称读出浓度。
 */
export function isConcentrated(inputs: Substance[], formula: string): boolean {
  return inputs.some((s) => s.formula === formula && s.name.includes("浓"));
}

/** 是否包含全部指定化学式 */
export function hasAllFormulas(inputs: Substance[], formulas: string[]): boolean {
  return formulas.every((f) => inputs.some((s) => s.formula === f));
}

/** 半角数字 → 全角下标的映射 */
const SUB_DIGITS = "₀₁₂₃₄₅₆₇₈₉";

/**
 * 把化学式里的半角数字转成全角下标，供 equation / description 排版使用。
 *
 * 产物 formula 必须保持半角 —— 它是查 PRECIPITATE_COLOR / SOLUTION_TINT 的键，
 * `CaCO₃` 与 `CaCO3` 是两个不同字符串，混用会让颜色静默回退默认值。
 * 但方程式是给人读的，全角下标可读性明显更好，于是两者用同一个半角变量、
 * 在排版时才经这里转换，避免出现"同一个式子写两遍"的不一致。
 */
export function sub(formula: string): string {
  return formula.replace(/\d/g, (d) => SUB_DIGITS[Number(d)]);
}
