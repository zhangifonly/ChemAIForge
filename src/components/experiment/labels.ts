// 实验分类/难度的中文显示标签，供卡片、筛选器与详情页共用
import {
  ExperimentCategory,
  ExperimentDifficulty,
} from "@/server/experiment/types";
import type {
  ExperimentCategory as Category,
  ExperimentDifficulty as Difficulty,
} from "@/server/experiment/types";

export const CATEGORY_LABELS: Record<Category, string> = {
  [ExperimentCategory.ACID_BASE]: "酸碱反应",
  [ExperimentCategory.ORGANIC]: "有机化学",
  [ExperimentCategory.THERMODYNAMICS]: "热力学",
};

export const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  [ExperimentDifficulty.EASY]: "入门",
  [ExperimentDifficulty.MEDIUM]: "进阶",
  [ExperimentDifficulty.HARD]: "挑战",
};

// 用于渲染筛选器选项的有序列表
export const CATEGORY_OPTIONS = Object.values(ExperimentCategory);
export const DIFFICULTY_OPTIONS = Object.values(ExperimentDifficulty);
