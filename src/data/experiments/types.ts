// 实验目录数据类型
// 每个实验是纯数据：既用于写入数据库（seed），也用于数据驱动测试。
// probe 描述该实验"核心反应"的可验证特征：把 reagentKeys 经试剂库解析后送入
// 反应引擎，断言产出的现象与 expect 一致 —— 这保证每个实验在系统里"真能反应"。
import type {
  ExperimentCategory,
  ExperimentDifficulty,
} from "@/server/experiment/types";

/** 反应探针的预期现象（仅声明关心的维度，未声明的不校验） */
export interface ReactionExpectation {
  /** 是否应发生反应 */
  reacted: boolean;
  /** 是否产气 */
  gas?: boolean;
  /** 是否产沉淀 */
  precipitate?: boolean;
  /** 是否变色 */
  colorChange?: boolean;
  /** 热效应 */
  thermal?: "exothermic" | "endothermic" | "none";
}

/** 核心反应探针：用于测试与画布默认演示 */
export interface ReactionProbe {
  /** 参与核心反应的试剂中文名（须能被 resolveSubstance 解析）*/
  reagentKeys: string[];
  /** 预期现象 */
  expect: ReactionExpectation;
}

/** 一条实验的完整定义 */
export interface ExperimentSeed {
  slug: string;
  title: string;
  description: string;
  category: ExperimentCategory;
  difficulty: ExperimentDifficulty;
  reagents: string[];
  apparatus: string[];
  objectives: string[];
  estimatedMinutes: number;
  /** 核心反应探针；纯观察 / 测量类实验可省略（无强反应） */
  probe?: ReactionProbe;
}
