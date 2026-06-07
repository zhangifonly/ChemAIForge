// 实验查询 API 的统一返回类型
// DB 中 reagents/apparatus/objectives 以 JSON 字符串存储，
// 经 service 层反序列化后对外暴露为字符串数组。
import type {
  ExperimentCategory,
  ExperimentDifficulty,
} from "@/server/experiment/types";

// 对外返回的实验数据传输对象
export interface ExperimentDTO {
  id: string;
  slug: string;
  title: string;
  description: string;
  category: ExperimentCategory;
  difficulty: ExperimentDifficulty;
  reagents: string[];
  apparatus: string[];
  objectives: string[];
  estimatedMinutes: number;
  createdAt: string;
}

// 列表查询过滤条件
export interface ExperimentFilter {
  category?: ExperimentCategory;
  difficulty?: ExperimentDifficulty;
  q?: string; // 按 title 模糊匹配
}
