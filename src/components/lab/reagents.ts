// 试剂物性映射层：将实验配置中的中文试剂名解析为引擎可识别的 Substance。
// 这里只描述"物质是什么"（化学式/类别），不含任何反应规则——
// 反应判定与现象计算一律交给 src/lib/chem/engine。
//
// 规则按数组顺序优先匹配（顺序敏感）：具体盐 / 有机物等需排在"酸/碱"等
// 通用关键字之前，避免"硝酸银"被误判为酸、"乙酸"被误判为通用酸等。
import type { Substance, SubstanceCategory } from "@/lib/chem/engine";
import { REAGENT_RULES } from "./reagentRules";

// 一条关键字 → 物性的匹配规则
export interface ReagentRule {
  keywords: string[];
  formula: string;
  category: SubstanceCategory;
}

// 将试剂标签解析为 Substance；无法识别时归为 other 类，仍可拖入但不触发反应
//
// ⚠️ 匹配策略是「命中的关键词最长者优先」，而非数组顺序优先。
// 原先按顺序取首个命中，于是任何短词只要排在前面就会吞掉包含它的长词：
// 「小苏打」被 #16 的「苏打」判成碳酸钠（实验里是碳酸氢钠）、「重铬酸钾」
// 被「铬酸钾」判成 K₂CrO₄（差一个氧、氧化性完全不同）、「磁性氧化铁」
// 被「氧化铁」判成 Fe₂O₃。靠人工把长词往前排是不可靠的 —— 表有 150 多条，
// 每加一条都要重新审视全表。取最长命中则天然正确：化学名越具体越长。
// 长度相同时仍按数组顺序，保留原有的显式优先级。
export function resolveSubstance(label: string): Substance {
  let best: { rule: ReagentRule; len: number } | null = null;
  for (const rule of REAGENT_RULES) {
    for (const kw of rule.keywords) {
      if (label.includes(kw) && (!best || kw.length > best.len)) {
        best = { rule, len: kw.length };
      }
    }
  }
  if (best) {
    const { formula, category } = best.rule;
    return { formula, name: label, category };
  }
  return { formula: label, name: label, category: "other" };
}
