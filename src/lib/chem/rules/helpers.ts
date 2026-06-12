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

/** 是否包含全部指定化学式 */
export function hasAllFormulas(inputs: Substance[], formulas: string[]): boolean {
  return formulas.every((f) => inputs.some((s) => s.formula === f));
}
