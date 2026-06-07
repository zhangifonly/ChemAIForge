// 试剂物性映射层：将实验配置中的中文试剂名解析为引擎可识别的 Substance。
// 注意：这里只描述"物质是什么"（化学式/类别），不包含任何反应规则——
// 反应判定与现象计算一律交给 src/lib/chem/engine。
import type { Substance, SubstanceCategory } from "@/lib/chem/engine";

// 一条关键字 → 物性的匹配规则，按数组顺序优先匹配
interface ReagentRule {
  keywords: string[];
  formula: string;
  category: SubstanceCategory;
}

// 顺序敏感：特定盐类需排在"酸/碱"通用关键字之前，避免"硝酸银"被误判为酸
const RULES: ReagentRule[] = [
  { keywords: ["硝酸银"], formula: "AgNO3", category: "salt" },
  { keywords: ["氯化钠", "食盐"], formula: "NaCl", category: "salt" },
  { keywords: ["硝酸钾"], formula: "KNO3", category: "salt" },
  { keywords: ["锌"], formula: "Zn", category: "metal" },
  { keywords: ["铁"], formula: "Fe", category: "metal" },
  { keywords: ["镁"], formula: "Mg", category: "metal" },
  { keywords: ["铜"], formula: "Cu", category: "metal" },
  { keywords: ["铝"], formula: "Al", category: "metal" },
  { keywords: ["氢氧化钠", "烧碱"], formula: "NaOH", category: "base" },
  { keywords: ["氢氧化钙", "熟石灰"], formula: "Ca(OH)2", category: "base" },
  { keywords: ["氨水"], formula: "NH3·H2O", category: "base" },
  { keywords: ["酚酞", "石蕊", "指示剂"], formula: "indicator", category: "other" },
  { keywords: ["盐酸"], formula: "HCl", category: "acid" },
  { keywords: ["硫酸"], formula: "H2SO4", category: "acid" },
  { keywords: ["硝酸"], formula: "HNO3", category: "acid" },
  { keywords: ["蒸馏水", "水"], formula: "H2O", category: "water" },
];

// 将试剂标签解析为 Substance；无法识别时归为 other 类，仍可拖入但不触发反应
export function resolveSubstance(label: string): Substance {
  for (const rule of RULES) {
    if (rule.keywords.some((kw) => label.includes(kw))) {
      return { formula: rule.formula, name: label, category: rule.category };
    }
  }
  return { formula: label, name: label, category: "other" };
}
