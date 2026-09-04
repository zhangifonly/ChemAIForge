// 试剂关键字 → 物性映射表（顺序敏感，具体优先于通用）
// 拆分到独立文件以便维护；resolveSubstance 按本数组顺序匹配。
import type { ReagentRule } from "./reagents";

// 注意排序：
// 1) 具体盐 / 配合物试剂（含"酸"字但实为盐，如"硝酸银""硫氰酸钾"）置于通用酸之前
// 2) 有机物中的"乙酸/甲酸"等弱酸单列，避免落入通用酸
// 3) 指示剂、催化剂等辅助物质单列
export const REAGENT_RULES: ReagentRule[] = [
  // —— 子串陷阱最深的几条，必须最先匹配 ——
  // "亚铁氰化钾" 含子串 "铁氰化钾"；"硫代硫酸钠" 含子串 "硫酸钠"/"硫酸"；
  // "乙二胺四乙酸" 含子串 "乙酸"。任一被后面的通用规则先命中都会解析成错误物质。
  { keywords: ["亚铁氰化钾", "黄血盐"], formula: "K4[Fe(CN)6]", category: "salt" },
  { keywords: ["铁氰化钾", "赤血盐"], formula: "K3[Fe(CN)6]", category: "salt" },
  { keywords: ["硫代硫酸钠", "海波"], formula: "Na2S2O3", category: "salt" },
  { keywords: ["EDTA", "乙二胺四乙酸"], formula: "Na2EDTA", category: "salt" },
  { keywords: ["铬黑T", "铬黑 T"], formula: "EBT", category: "indicator" },
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
  { keywords: ["碳酸氢铵"], formula: "NH4HCO3", category: "carbonate" },
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
  // 银器表面的黑色锈层。必须登记在裸"银"之前，否则被吞成 Ag 单质，
  // 电解还原除黑实验就失去反应物
  { keywords: ["硫化银"], formula: "Ag2S", category: "salt" },
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
  { keywords: ["氯化钴"], formula: "CoCl2", category: "salt" },
  { keywords: ["氯化镍"], formula: "NiCl2", category: "salt" },
  { keywords: ["硫酸镍"], formula: "NiSO4", category: "salt" },
  // 锰盐：须先于通用「硫酸」，否则「硫酸锰」被吞成 H₂SO₄
  { keywords: ["硫酸锰"], formula: "MnSO4", category: "salt" },
  { keywords: ["氯化锰"], formula: "MnCl2", category: "salt" },
  // 锶盐 / 锂盐：焰色反应常用，须先于通用「硝酸」
  { keywords: ["硝酸锶"], formula: "Sr(NO3)2", category: "salt" },
  { keywords: ["氯化锶"], formula: "SrCl2", category: "salt" },
  { keywords: ["氯化锂"], formula: "LiCl", category: "salt" },
  { keywords: ["硝酸锂"], formula: "LiNO3", category: "salt" },
  // 铬酸钾：须先于裸「钾」，否则被吞成金属钾单质；
  // 而「重铬酸钾」含子串「铬酸钾」，必须再先一步登记
  { keywords: ["重铬酸钾"], formula: "K2Cr2O7", category: "oxidizer" },
  { keywords: ["铬酸钾"], formula: "K2CrO4", category: "salt" },
  // 铝盐：必须登记在此，否则「氯化铝」被裸"铝"吞成金属单质、
  // 「硫酸铝」被通用"硫酸"吞成 H₂SO₄
  { keywords: ["氯化铝", "三氯化铝"], formula: "AlCl3", category: "salt" },
  { keywords: ["硫酸铝"], formula: "Al2(SO4)3", category: "salt" },
  // 碳酸银：须先于通用"碳酸"，否则被解析成碳酸 H₂CO₃。
  // 类别是 carbonate 而非 salt —— 其余碳酸盐都是 carbonate，写成 salt 会让它
  // 遇酸不放 CO₂（实测 Ag₂CO₃ + 稀硝酸 判成不反应，化学上是错的）。
  { keywords: ["碳酸银"], formula: "Ag2CO3", category: "carbonate" },
  { keywords: ["氟化钠"], formula: "NaF", category: "salt" },
  { keywords: ["氯化钙"], formula: "CaCl2", category: "salt" },
  { keywords: ["氯化钠", "食盐"], formula: "NaCl", category: "salt" },
  { keywords: ["硝酸钾"], formula: "KNO3", category: "salt" },
  { keywords: ["硫酸钠"], formula: "Na2SO4", category: "salt" },
  { keywords: ["硫酸钾"], formula: "K2SO4", category: "salt" },
  // —— 卤化银（感光材料 / 配位溶解）——
  // 必须先于"溴化钾/碘化钾"之外的裸卤素与裸银规则：否则"溴化银"被"溴"吞成 Br₂、
  // "氯化银"被"银"吞成 Ag 单质
  { keywords: ["氯化银"], formula: "AgCl", category: "salt" },
  { keywords: ["溴化银"], formula: "AgBr", category: "salt" },
  { keywords: ["碘化银"], formula: "AgI", category: "salt" },
  // —— 卤化物（沉淀 / 置换用）——
  { keywords: ["溴化钾"], formula: "KBr", category: "salt" },
  { keywords: ["溴化钠"], formula: "NaBr", category: "salt" },
  { keywords: ["碘化钾"], formula: "KI", category: "salt" },
  { keywords: ["碘化钠"], formula: "NaI", category: "salt" },
  // —— 溶解度表新增的可溶盐（沉淀组合用）——
  { keywords: ["硝酸铅"], formula: "Pb(NO3)2", category: "salt" },
  { keywords: ["磷酸钠"], formula: "Na3PO4", category: "salt" },
  { keywords: ["硝酸镁"], formula: "Mg(NO3)2", category: "salt" },
  { keywords: ["硝酸钙"], formula: "Ca(NO3)2", category: "salt" },
  { keywords: ["硝酸亚铁"], formula: "Fe(NO3)2", category: "salt" },
  // 硝酸钠须登记在此，否则被通用「硝酸」吞成 HNO₃
  { keywords: ["硝酸钠"], formula: "NaNO3", category: "salt" },
  { keywords: ["氯化钾"], formula: "KCl", category: "salt" },
);

// —— 碱 / 氧化物（含金属字，须排在裸金属单质之前；
//    且氢氧化物须先于氧化物，否则"氢氧化钙"会被"氧化钙"子串吞掉）——
REAGENT_RULES.push(
  { keywords: ["氢氧化钠", "烧碱", "火碱"], formula: "NaOH", category: "base" },
  { keywords: ["氢氧化钾"], formula: "KOH", category: "base" },
  // 石灰乳与熟石灰同为 Ca(OH)₂，但形态不同（浊液/粉末 vs 澄清溶液），
  // 差异由渲染层按 name 判定，见 phasePlan.isTurbidSubstance 与 scenePlan.pickSolid
  { keywords: ["氢氧化钙", "熟石灰", "石灰乳", "石灰水"], formula: "Ca(OH)2", category: "base" },
  { keywords: ["氢氧化钡"], formula: "Ba(OH)2", category: "base" },
  { keywords: ["氢氧化铝"], formula: "Al(OH)3", category: "base" },
  // 不溶性碱：必须登记在氧化物之前，否则"氢氧化铁"会被"氧化铁"子串吞成 Fe₂O₃，
  // 也必须在裸金属之前，否则"氢氧化亚铁"会被"铁"吞成金属单质
  { keywords: ["氢氧化铁"], formula: "Fe(OH)3", category: "base" },
  { keywords: ["氢氧化亚铁"], formula: "Fe(OH)2", category: "base" },
  { keywords: ["氢氧化铜"], formula: "Cu(OH)2", category: "base" },
  { keywords: ["氢氧化锌"], formula: "Zn(OH)2", category: "base" },
  { keywords: ["氢氧化镁"], formula: "Mg(OH)2", category: "base" },
  { keywords: ["氢氧化镍"], formula: "Ni(OH)2", category: "base" },
  { keywords: ["氢氧化钴"], formula: "Co(OH)2", category: "base" },
  { keywords: ["氨水"], formula: "NH3·H2O", category: "base" },
  { keywords: ["氧化铜"], formula: "CuO", category: "oxide" },
  { keywords: ["氧化铁", "铁锈"], formula: "Fe2O3", category: "oxide" },
  { keywords: ["氧化镁"], formula: "MgO", category: "oxide" },
  { keywords: ["氧化钙", "生石灰"], formula: "CaO", category: "oxide" },
  { keywords: ["氧化铝", "三氧化二铝"], formula: "Al2O3", category: "oxide" },
  // 二氧化铅：铅酸电池正极材料，须先于金属"铅"匹配（否则"二氧化铅"含"铅"被吞）
  { keywords: ["二氧化铅"], formula: "PbO2", category: "oxide" },
  { keywords: ["二氧化锰"], formula: "MnO2", category: "oxidizer" },
  // 以下四条必须登记在此（金属规则之前），否则会被裸"钠/铁/锌"吞成金属单质：
  // "过氧化钠"含"钠"、"四氧化三铁"含"铁"、"氧化锌"含"锌"
  { keywords: ["过氧化钠"], formula: "Na2O2", category: "oxide" },
  { keywords: ["氧化钠"], formula: "Na2O", category: "oxide" },
  { keywords: ["四氧化三铁", "磁性氧化铁"], formula: "Fe3O4", category: "oxide" },
  { keywords: ["氧化锌"], formula: "ZnO", category: "oxide" },
);


// —— 氧化剂 / 还原剂 ——
REAGENT_RULES.push(
  { keywords: ["高锰酸钾"], formula: "KMnO4", category: "oxidizer" },
  { keywords: ["重铬酸钾"], formula: "K2Cr2O7", category: "oxidizer" },
  // 氯酸钾：必须登记在此，否则会被下方裸"钾"的金属规则吞成 K 单质
  { keywords: ["氯酸钾"], formula: "KClO3", category: "oxidizer" },
  { keywords: ["次氯酸钠", "漂白液"], formula: "NaClO", category: "oxidizer" },
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
  { keywords: ["冰晶石"], formula: "Na3AlF6", category: "other" },
  // 硫单质：只认"硫粉/硫黄/硫磺"，绝不可用裸"硫"——否则会吞掉硫酸/硫化钠等一大片
  { keywords: ["硫粉", "硫黄", "硫磺"], formula: "S", category: "other" },
  // 碳单质：燃烧、还原实验的常用可燃物。"木炭/活性炭/石墨"都算 C，
  // 但不能用裸"碳"——会吞掉碳酸钠等一大片
  { keywords: ["木炭", "活性炭", "炭粉", "石墨"], formula: "C", category: "other" },
  // 磷单质：只认"红磷/白磷"，绝不可用裸"磷"——会吞掉磷酸
  { keywords: ["红磷", "白磷"], formula: "P", category: "other" },
  { keywords: ["碘单质", "碘晶体"], formula: "I2", category: "other" },
);

// —— 有机物（弱酸 / 醇 / 酚 / 酯 等，须先于通用酸匹配）——
REAGENT_RULES.push(
  // 这两条须置于本段最前：「苯甲酸乙酯」含子串「甲酸乙酯」、
  // 「苯乙烯」含子串「乙烯」，落到后面就会被解析成 HCOOC₂H₅ / C₂H₄
  { keywords: ["苯甲酸乙酯"], formula: "C6H5COOC2H5", category: "organic" },
  { keywords: ["苯乙烯"], formula: "C8H8", category: "organic" },
  // 酯类必须排在羧酸之前："乙酸乙酯" 含子串 "乙酸"、"甲酸甲酯" 含 "甲酸"，
  // 顺序颠倒会把酯解析成对应的酸（曾导致乙酸乙酯 → CH3COOH）
  { keywords: ["乙酸乙酯"], formula: "CH3COOC2H5", category: "organic" },
  { keywords: ["乙酸甲酯"], formula: "CH3COOCH3", category: "organic" },
  { keywords: ["甲酸甲酯"], formula: "HCOOCH3", category: "organic" },
  { keywords: ["甲酸乙酯"], formula: "HCOOC2H5", category: "organic" },
  { keywords: ["乙酸酐", "醋酸酐"], formula: "(CH3CO)2O", category: "organic" },
  { keywords: ["乙酸钠", "醋酸钠"], formula: "CH3COONa", category: "salt" },
  // 苯甲酸须先于"甲酸"：否则"苯甲酸"含子串"甲酸"被解析成 HCOOH，
  // 酯化时会打印出甲酸乙酯的方程式
  { keywords: ["苯甲酸"], formula: "C6H5COOH", category: "acid" },
  { keywords: ["乙酸", "醋酸"], formula: "CH3COOH", category: "acid" },
  { keywords: ["甲酸"], formula: "HCOOH", category: "acid" },
  { keywords: ["丙酸"], formula: "C2H5COOH", category: "acid" },
  { keywords: ["草酸二水", "乙二酸二水"], formula: "H2C2O4", category: "acid" },
  { keywords: ["柠檬酸"], formula: "C6H8O7", category: "acid" },
  { keywords: ["苯酚", "石炭酸"], formula: "C6H5OH", category: "organic" },
  { keywords: ["乙醇", "酒精"], formula: "C2H5OH", category: "organic" },
  { keywords: ["甲醇"], formula: "CH3OH", category: "organic" },
  { keywords: ["乙醛"], formula: "CH3CHO", category: "organic" },
  { keywords: ["葡萄糖"], formula: "C6H12O6", category: "organic" },
  { keywords: ["乙烯"], formula: "C2H4", category: "organic" },
  { keywords: ["乙炔"], formula: "C2H2", category: "organic" },
  { keywords: ["甘油", "丙三醇"], formula: "C3H8O3", category: "organic" },
  { keywords: ["丙酮"], formula: "CH3COCH3", category: "organic" },
  { keywords: ["甲苯"], formula: "C7H8", category: "organic" },
  // 以下四条必须先于裸"苯"：否则"苯胺""硝基苯""苯甲醛""苯乙烯"都会被吞成 C₆H₆
  { keywords: ["苯胺"], formula: "C6H5NH2", category: "organic" },
  { keywords: ["硝基苯"], formula: "C6H5NO2", category: "organic" },
  { keywords: ["苯甲醛"], formula: "C6H5CHO", category: "organic" },
  { keywords: ["苯"], formula: "C6H6", category: "organic" },
  // 醇类：多元醇与长链醇
  { keywords: ["乙二醇"], formula: "C2H6O2", category: "organic" },
  { keywords: ["异丙醇"], formula: "C3H8O", category: "organic" },
  { keywords: ["丙醇", "正丙醇"], formula: "C3H7OH", category: "organic" },
  { keywords: ["正丁醇", "丁醇"], formula: "C4H9OH", category: "organic" },
  // 糖类与高分子
  { keywords: ["麦芽糖"], formula: "C12H22O11", category: "organic" },
  { keywords: ["果糖"], formula: "C6H12O6", category: "organic" },
  { keywords: ["纤维素", "脱脂棉"], formula: "cellulose", category: "organic" },
  { keywords: ["汽油", "煤油", "石蜡油"], formula: "petroleum", category: "organic" },
  { keywords: ["蔗糖"], formula: "C12H22O11", category: "organic" },
  { keywords: ["油脂", "植物油", "花生油"], formula: "fat", category: "organic" },
  { keywords: ["四氯化碳"], formula: "CCl4", category: "organic" },
  { keywords: ["丁二酮肟"], formula: "C4H8N2O2", category: "indicator" },
  { keywords: ["水杨酸"], formula: "C7H6O3", category: "organic" },
  // —— 通用强酸（放在所有含"酸"字的盐 / 有机酸之后）——
  { keywords: ["盐酸", "氢氯酸"], formula: "HCl", category: "acid" },
  // 氯化氢气体：与盐酸同化学式但形态不同（干燥 HCl 不显酸性、不导电），
  // 白烟实验与氢气氯气化合实验里出现的是气态，原先未登记会落到 other 而不反应
  { keywords: ["氯化氢"], formula: "HCl", category: "gas" },
  { keywords: ["硫酸"], formula: "H2SO4", category: "acid" },
  { keywords: ["硝酸"], formula: "HNO3", category: "acid" },
  { keywords: ["磷酸"], formula: "H3PO4", category: "acid" },
  { keywords: ["碳酸"], formula: "H2CO3", category: "acid" },
  // —— 气体 / 水（兜底）——
  // 肥皂水：检验硬水的辅助试剂，须先于"水"匹配（否则"肥皂水"含"水"被当成 H₂O）
  { keywords: ["肥皂水", "肥皂"], formula: "soap-solution", category: "other" },
  { keywords: ["四氧化二氮"], formula: "N2O4", category: "gas" },
  { keywords: ["二氧化氮"], formula: "NO2", category: "gas" },
  { keywords: ["二氧化碳"], formula: "CO2", category: "gas" },
  { keywords: ["氧气"], formula: "O2", category: "gas" },
  { keywords: ["氢气"], formula: "H2", category: "gas" },
  { keywords: ["氨气"], formula: "NH3", category: "gas" },
  // 一氧化碳须排在"氧气"之后但不含"氧气"子串，独立成条；氯气/氮气同理
  { keywords: ["一氧化碳"], formula: "CO", category: "gas" },
  { keywords: ["氯气"], formula: "Cl2", category: "gas" },
  { keywords: ["氮气"], formula: "N2", category: "gas" },
  { keywords: ["硫化氢"], formula: "H2S", category: "gas" },
  { keywords: ["甲烷", "天然气", "沼气"], formula: "CH4", category: "gas" },
  { keywords: ["空气"], formula: "air", category: "gas" },
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
  { keywords: ["铅片", "铅块", "铅"], formula: "Pb", category: "metal" },
  // 电化学常用电极金属：锡、镍、镉，活动性介于铁与铜之间，用于置换梯度实验
  { keywords: ["锡片", "锡粒", "锡"], formula: "Sn", category: "metal" },
  { keywords: ["镍片", "镍粉", "镍"], formula: "Ni", category: "metal" },
  { keywords: ["镉片", "镉"], formula: "Cd", category: "metal" },
  { keywords: ["银"], formula: "Ag", category: "metal" },
);
