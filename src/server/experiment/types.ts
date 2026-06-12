// 实验相关共享常量与类型
// SQLite 不支持原生 enum，集中在应用层约束 category/difficulty 取值

// 实验分类
export const ExperimentCategory = {
  ACID_BASE: "ACID_BASE", // 酸碱反应
  ORGANIC: "ORGANIC", // 有机化学
  THERMODYNAMICS: "THERMODYNAMICS", // 热力学
  REDOX: "REDOX", // 氧化还原
  PRECIPITATION: "PRECIPITATION", // 沉淀与复分解
  GAS: "GAS", // 气体制备与性质
  ELECTROCHEM: "ELECTROCHEM", // 电化学
  METAL: "METAL", // 金属与活动性
  ANALYSIS: "ANALYSIS", // 分析与检验
  COORDINATION: "COORDINATION", // 配位与显色
} as const;

export type ExperimentCategory =
  (typeof ExperimentCategory)[keyof typeof ExperimentCategory];

// 实验难度
export const ExperimentDifficulty = {
  EASY: "EASY",
  MEDIUM: "MEDIUM",
  HARD: "HARD",
} as const;

export type ExperimentDifficulty =
  (typeof ExperimentDifficulty)[keyof typeof ExperimentDifficulty];
