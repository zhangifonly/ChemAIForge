// 化学反应引擎核心逻辑（纯函数，无副作用）
// 被实验画布组件调用以驱动可视化

import { reactions } from "./reactions";

/** 物质类别 */
export type SubstanceCategory =
  | "acid" // 酸
  | "base" // 碱
  | "salt" // 盐
  | "metal" // 金属单质
  | "oxide" // 氧化物
  | "gas" // 气体
  | "water" // 水
  | "other";

/** 参与反应的物质 */
export interface Substance {
  /** 化学式，如 "HCl"、"NaOH" */
  formula: string;
  /** 中文名称，如 "盐酸" */
  name: string;
  /** 物质类别 */
  category: SubstanceCategory;
  /** 物质的量（mol），用于判断过量/不足，默认 1 */
  amount?: number;
}

/** 反应条件 */
export interface ReactionConditions {
  /** 温度（摄氏度），默认 25 */
  temperature?: number;
  /** 是否加热 */
  heated?: boolean;
}

/** pH 变化方向 */
export type PhTrend = "increase" | "decrease" | "neutral" | "unknown";

/** 反应结果 */
export interface ReactionResult {
  /** 是否发生反应 */
  reacted: boolean;
  /** 生成的产物 */
  products: Substance[];
  /** 是否产生气体 */
  producesGas: boolean;
  /** 是否产生沉淀 */
  producesPrecipitate: boolean;
  /** 是否伴随颜色变化 */
  colorChange: boolean;
  /** 热效应：放热 / 吸热 / 无明显热效应 */
  thermal: "exothermic" | "endothermic" | "none";
  /** pH 变化趋势 */
  phTrend: PhTrend;
  /** 反应方程式描述（可读） */
  equation?: string;
  /** 现象描述 */
  description?: string;
}

/** 无反应发生时的默认结果 */
function noReaction(inputs: Substance[]): ReactionResult {
  return {
    reacted: false,
    products: inputs,
    producesGas: false,
    producesPrecipitate: false,
    colorChange: false,
    thermal: "none",
    phTrend: "unknown",
    description: "在当前条件下未观察到明显反应。",
  };
}

/**
 * 反应引擎主入口：给定输入物质与条件，返回反应结果。
 * 纯函数，不修改入参，按规则集顺序匹配第一条满足的反应。
 */
export function react(
  inputs: Substance[],
  conditions: ReactionConditions = {}
): ReactionResult {
  if (inputs.length < 2) {
    return noReaction(inputs);
  }

  for (const rule of reactions) {
    if (rule.match(inputs)) {
      return { reacted: true, ...rule.build(inputs, conditions) };
    }
  }

  return noReaction(inputs);
}
