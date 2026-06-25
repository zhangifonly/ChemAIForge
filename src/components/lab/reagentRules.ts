// 试剂关键字 → 物性映射表（顺序敏感，具体优先于通用）
// 拆分到独立文件以便维护；resolveSubstance 按本数组顺序匹配。
import type { ReagentRule } from "./reagents";

// 注意排序：
// 1) 具体盐 / 配合物试剂（含"酸"字但实为盐，如"硝酸银""硫氰酸钾"）置于通用酸之前
// 2) 有机物中的"乙酸/甲酸"等弱酸单列，避免落入通用酸
// 3) 指示剂、催化剂等辅助物质单列
export const REAGENT_RULES: ReagentRule[] = [
  // —— 银盐 / 钡盐 / 特定盐（含"酸"字但属盐，须最先匹配）——
  { keywords: ["硝酸银"], formula: "AgNO3", category: "salt" },
  { keywords: ["氯化钡"], formula: "BaCl2", category: "salt" },
  { keywords: ["硝酸钡"], formula: "Ba(NO3)2", category: "salt" },
  { keywords: ["硫氰酸钾", "硫氰化钾"], formula: "KSCN", category: "salt" },
  { keywords: ["硫氰酸钠"], formula: "NaSCN", category: "salt" },
  { keywords: ["硫氰酸铵"], formula: "NH4SCN", category: "salt" },
  // —— 铵盐（与碱共热产氨）——
  { keywords: ["氯化铵"], formula: "NH4Cl", category: "salt" },
  { keywords: ["硫酸铵"], formula: "(NH4)2SO4", category: "salt" },
  { keywords: ["硝酸铵"], formula: "NH4NO3", category: "salt" },
  { keywords: ["碳酸铵"], formula: "(NH4)2CO3", category: "carbonate" },
  // —— 碳酸盐 / 碳酸氢盐 ——
  { keywords: ["碳酸钠", "纯碱", "苏打"], formula: "Na2CO3", category: "carbonate" },
  { keywords: ["碳酸氢钠", "小苏打"], formula: "NaHCO3", category: "carbonate" },
  { keywords: ["碳酸钾"], formula: "K2CO3", category: "carbonate" },
  { keywords: ["碳酸钙", "石灰石", "大理石"], formula: "CaCO3", category: "carbonate" },
  // —— 亚硫酸盐 / 硫化物 ——
  { keywords: ["亚硫酸钠"], formula: "Na2SO3", category: "salt" },
  { keywords: ["亚硫酸氢钠"], formula: "NaHSO3", category: "salt" },
  { keywords: ["硫化亚铁"], formula: "FeS", category: "salt" },
  { keywords: ["硫化钠"], formula: "Na2S", category: "salt" },
];


// —— 铜盐 / 铁盐 / 镁盐 / 锌盐等可溶盐 ——
REAGENT_RULES.push(
  { keywords: ["硫酸铜", "蓝矾", "胆矾"], formula: "CuSO4", category: "salt" },
  { keywords: ["氯化铜"], formula: "CuCl2", category: "salt" },
  { keywords: ["硝酸铜"], formula: "Cu(NO3)2", category: "salt" },
  { keywords: ["氯化铁", "三氯化铁"], formula: "FeCl3", category: "salt" },
  { keywords: ["硫酸铁"], formula: "Fe2(SO4)3", category: "salt" },
  { keywords: ["硝酸铁"], formula: "Fe(NO3)3", category: "salt" },
  { keywords: ["硫酸亚铁"], formula: "FeSO4", category: "salt" },
  { keywords: ["氯化亚铁"], formula: "FeCl2", category: "salt" },
  { keywords: ["氯化镁"], formula: "MgCl2", category: "salt" },
  { keywords: ["硫酸镁"], formula: "MgSO4", category: "salt" },
  { keywords: ["硫酸锌"], formula: "ZnSO4", category: "salt" },
  { keywords: ["氯化钙"], formula: "CaCl2", category: "salt" },
  { keywords: ["氯化钠", "食盐"], formula: "NaCl", category: "salt" },
  { keywords: ["硝酸钾"], formula: "KNO3", category: "salt" },
  { keywords: ["硫酸钠"], formula: "Na2SO4", category: "salt" },
  { keywords: ["硫酸钾"], formula: "K2SO4", category: "salt" },
  // —— 卤化物（沉淀 / 置换用）——
  { keywords: ["溴化钾"], formula: "KBr", category: "salt" },
  { keywords: ["溴化钠"], formula: "NaBr", category: "salt" },
  { keywords: ["碘化钾"], formula: "KI", category: "salt" },
  { keywords: ["碘化钠"], formula: "NaI", category: "salt" },
);

// —— 碱 / 氧化物（含金属字，须排在裸金属单质之前；
//    且氢氧化物须先于氧化物，否则"氢氧化钙"会被"氧化钙"子串吞掉）——
REAGENT_RULES.push(
  { keywords: ["氢氧化钠", "烧碱", "火碱"], formula: "NaOH", category: "base" },
  { keywords: ["氢氧化钾"], formula: "KOH", category: "base" },
  { keywords: ["氢氧化钙", "熟石灰", "石灰水"], formula: "Ca(OH)2", category: "base" },
  { keywords: ["氢氧化钡"], formula: "Ba(OH)2", category: "base" },
  { keywords: ["氨水"], formula: "NH3·H2O", category: "base" },
  { keywords: ["氧化铜"], formula: "CuO", category: "oxide" },
  { keywords: ["氧化铁", "铁锈"], formula: "Fe2O3", category: "oxide" },
  { keywords: ["氧化镁"], formula: "MgO", category: "oxide" },
  { keywords: ["氧化钙", "生石灰"], formula: "CaO", category: "oxide" },
  { keywords: ["二氧化锰"], formula: "MnO2", category: "oxidizer" },
);


// —— 氧化剂 / 还原剂 ——
REAGENT_RULES.push(
  { keywords: ["高锰酸钾"], formula: "KMnO4", category: "oxidizer" },
  { keywords: ["重铬酸钾"], formula: "K2Cr2O7", category: "oxidizer" },
  { keywords: ["过氧化氢", "双氧水"], formula: "H2O2", category: "oxidizer" },
  { keywords: ["氯水", "氯气"], formula: "Cl2", category: "oxidizer" },
  { keywords: ["溴水", "溴"], formula: "Br2", category: "oxidizer" },
  { keywords: ["碘水", "碘酒", "碘单质", "碘"], formula: "I2", category: "oxidizer" },
  { keywords: ["草酸", "乙二酸"], formula: "H2C2O4", category: "reducer" },
  { keywords: ["二氧化硫"], formula: "SO2", category: "reducer" },
  // —— 指示剂 / 辅助 ——
  { keywords: ["酚酞"], formula: "phenolphthalein", category: "indicator" },
  { keywords: ["石蕊"], formula: "litmus", category: "indicator" },
  { keywords: ["甲基橙"], formula: "methyl-orange", category: "indicator" },
  { keywords: ["pH 试纸", "pH试纸", "广泛试纸"], formula: "ph-paper", category: "indicator" },
  { keywords: ["淀粉"], formula: "starch", category: "other" },
  { keywords: ["催化剂"], formula: "catalyst", category: "other" },
);

// —— 有机物（弱酸 / 醇 / 酚 / 酯 等，须先于通用酸匹配）——
REAGENT_RULES.push(
  { keywords: ["乙酸", "醋酸"], formula: "CH3COOH", category: "acid" },
  { keywords: ["甲酸"], formula: "HCOOH", category: "acid" },
  { keywords: ["苯酚", "石炭酸"], formula: "C6H5OH", category: "organic" },
  { keywords: ["乙醇", "酒精"], formula: "C2H5OH", category: "organic" },
  { keywords: ["甲醇"], formula: "CH3OH", category: "organic" },
  { keywords: ["乙醛"], formula: "CH3CHO", category: "organic" },
  { keywords: ["葡萄糖"], formula: "C6H12O6", category: "organic" },
  { keywords: ["乙烯"], formula: "C2H4", category: "organic" },
  { keywords: ["乙酸乙酯"], formula: "CH3COOC2H5", category: "organic" },
  { keywords: ["蔗糖"], formula: "C12H22O11", category: "organic" },
  // —— 通用强酸（放在所有含"酸"字的盐 / 有机酸之后）——
  { keywords: ["盐酸", "氢氯酸"], formula: "HCl", category: "acid" },
  { keywords: ["硫酸"], formula: "H2SO4", category: "acid" },
  { keywords: ["硝酸"], formula: "HNO3", category: "acid" },
  { keywords: ["磷酸"], formula: "H3PO4", category: "acid" },
  { keywords: ["碳酸"], formula: "H2CO3", category: "acid" },
  // —— 气体 / 水（兜底）——
  // 肥皂水：检验硬水的辅助试剂，须先于"水"匹配（否则"肥皂水"含"水"被当成 H₂O）
  { keywords: ["肥皂水", "肥皂"], formula: "soap-solution", category: "other" },
  { keywords: ["二氧化碳"], formula: "CO2", category: "gas" },
  { keywords: ["氧气"], formula: "O2", category: "gas" },
  { keywords: ["氢气"], formula: "H2", category: "gas" },
  { keywords: ["氨气"], formula: "NH3", category: "gas" },
  { keywords: ["蒸馏水", "去离子水", "水"], formula: "H2O", category: "water" },
);

// —— 金属单质（必须最后匹配：裸金属关键字会吞掉含该字的化合物名）——
REAGENT_RULES.push(
  { keywords: ["镁条", "镁带", "镁粉", "镁"], formula: "Mg", category: "metal" },
  { keywords: ["锌粒", "锌片", "锌"], formula: "Zn", category: "metal" },
  { keywords: ["铝片", "铝箔", "铝粉", "铝"], formula: "Al", category: "metal" },
  { keywords: ["铁片", "铁钉", "铁粉", "铁丝", "铁"], formula: "Fe", category: "metal" },
  { keywords: ["铜片", "铜丝", "铜"], formula: "Cu", category: "metal" },
  { keywords: ["金属钠", "钠块", "钠"], formula: "Na", category: "metal" },
  { keywords: ["金属钾", "钾"], formula: "K", category: "metal" },
  { keywords: ["金属钙", "钙"], formula: "Ca", category: "metal" },
  { keywords: ["银"], formula: "Ag", category: "metal" },
);
