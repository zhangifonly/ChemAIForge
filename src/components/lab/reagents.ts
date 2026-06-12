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
export function resolveSubstance(label: string): Substance {
  for (const rule of REAGENT_RULES) {
    if (rule.keywords.some((kw) => label.includes(kw))) {
      return { formula: rule.formula, name: label, category: rule.category };
    }
  }
  return { formula: label, name: label, category: "other" };
}
