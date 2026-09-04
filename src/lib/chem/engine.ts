// 化学反应引擎核心逻辑（纯函数，无副作用）
// 被实验画布组件调用以驱动可视化

import { reactions } from "./reactions";

/** 物质类别 */
export type SubstanceCategory =
  | "acid" // 酸
  | "base" // 碱
  | "salt" // 盐
  | "carbonate" // 碳酸盐 / 碳酸氢盐（产气复分解专用）
  | "metal" // 金属单质
  | "oxide" // 氧化物
  | "gas" // 气体
  | "water" // 水
  | "indicator" // 酸碱指示剂
  | "oxidizer" // 氧化剂
  | "reducer" // 还原剂
  | "organic" // 有机物
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
  /**
   * 沉淀物的化学式，仅当它与产物列表不一致时才需要填写。
   *
   * 典型是「先沉淀后溶解」的配位反应：镍盐加氨水先析出苹果绿的 Ni(OH)₂，
   * 氨过量后才溶成蓝紫色配离子 —— 产物是配离子，沉淀却是氢氧化物。
   * 不填时 pickPrecipitate 从产物里挑，会拿配离子去查沉淀色表，
   * 查不到便一律回退白色，把绿色沉淀这个关键观察点画错。
   */
  precipitateFormula?: string;
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
  /**
   * 试剂搭配正确、但当前条件不足以让反应发生（目前只有「缺加热」一种）。
   *
   * 与 reacted=false 的「试剂根本不匹配」是两回事：前者要提示用户点燃酒精灯，
   * 后者要提示换试剂。界面文案与讲解都需要区分，故单独立一个字段。
   */
  pendingCondition?: "heat";
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
  // 空容器才谈不上反应。原先要求"至少两种物质"，把分解反应整类挡在门外 ——
  // 加热高锰酸钾制氧气只有一种反应物，学生投料、点酒精灯、点混合，
  // 无论怎么操作都毫无反应。实测 185 种试剂单独投入时无一条规则会误命中
  // （所有规则的 match 本就要求物质配对），这道门槛纯属多余的保险。
  if (inputs.length === 0) {
    return noReaction(inputs);
  }

  for (const rule of reactions) {
    if (rule.match(inputs)) {
      // 规则声明必须加热时，常温下不给结果 —— 酯化、银镜、铝热这些反应
      // 方程式上写着 △ / 浓硫酸加热，引擎却在 25 ℃ 照样"发生"，
      // 学生按错误的直觉操作也能拿到正确现象，加热这一步就白学了。
      if (rule.requiresHeat && !isHeated(conditions)) {
        return pendingHeat(inputs, rule.name);
      }
      const result = { reacted: true, ...rule.build(inputs, conditions) };
      return withIndicatorColor(inputs, result);
    }
  }

  return noReaction(inputs);
}

/** 达到加热阈值：显式 heated 或温度不低于 HEAT_THRESHOLD */
export const HEAT_THRESHOLD = 60;

function isHeated(c: ReactionConditions): boolean {
  return c.heated === true || (c.temperature ?? 25) >= HEAT_THRESHOLD;
}

/** 试剂对了但缺加热：产物保持原样，等用户点燃酒精灯 */
function pendingHeat(inputs: Substance[], name: string): ReactionResult {
  return {
    ...noReaction(inputs),
    pendingCondition: "heat",
    description: `${name}需要加热才能进行：请点燃酒精灯（加热到 ${HEAT_THRESHOLD} ℃ 以上）后再观察。`,
  };
}

/** 会使指示剂响应的环境：酸、碱，以及溶于水显酸性的气体 */
const ACIDIC_GAS = ["CO2", "SO2", "Cl2"];

/**
 * 指示剂在场且体系呈酸性或碱性时，补上颜色变化。
 *
 * 指示剂不参与反应，它只把酸碱性可视化，因此不该与主反应二选一 ——
 * 「碳酸钠 + 盐酸 + 甲基橙」既冒气泡又褪色，两个现象同时发生。
 * 规则集是首条命中即返回，主反应规则不可能知道体系里有没有指示剂，
 * 所以这件事只能在引擎出口统一补。
 *
 * 反之，若主反应已报颜色变化（如高锰酸钾褪色），这里什么也不改。
 */
function withIndicatorColor(
  inputs: Substance[],
  result: ReactionResult,
): ReactionResult {
  if (result.colorChange) return result;
  if (!inputs.some((s) => s.category === "indicator")) return result;
  const responsive = inputs.some(
    (s) =>
      s.category === "acid" ||
      s.category === "base" ||
      ACIDIC_GAS.includes(s.formula),
  );
  // pH 明确升降也算：铵盐 + 碱放氨后溶液显碱性，酚酞照样变红
  if (!responsive && result.phTrend !== "increase" && result.phTrend !== "decrease") {
    return result;
  }
  return { ...result, colorChange: true };
}
