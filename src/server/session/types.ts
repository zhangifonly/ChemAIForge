// 实验会话相关共享常量与类型
// SQLite 不支持原生 enum，会话状态在应用层约束取值（见 schema.prisma 注释）

// 会话状态：进行中 / 已完成
export const SessionStatus = {
  IN_PROGRESS: "IN_PROGRESS",
  COMPLETED: "COMPLETED",
} as const;

export type SessionStatus = (typeof SessionStatus)[keyof typeof SessionStatus];

// 操作步骤：记录学生在实验台的一次动作（拖入试剂 / 混合 / 清空等）
export interface SessionStep {
  // 动作类型，自由文本但建议取自 LabAction（add / mix / reset）
  action: string;
  // 动作详情，结构随 action 变化（如混合时的方程式、读数等）
  detail?: Record<string, unknown>;
  // 客户端记录时间戳（ISO 字符串）
  at: string;
}

// 读数记录：某一时刻的 pH / 温度快照
export interface SessionMeasurement {
  ph: number;
  temperature: number;
  at: string;
}

// AI 实验报告：基于会话 steps/measurements 由 Claude 生成的结构化反馈
export interface ExperimentReport {
  // 实验结论概述
  conclusion: string;
  // 误差分析（读数波动、操作偏差等）
  errorAnalysis: string;
  // 改进建议清单
  improvements: string[];
  // 知识点掌握评估
  knowledgeAssessment: string;
  // 报告生成时间（ISO 字符串）
  generatedAt: string;
}

// 对外会话 DTO（steps/measurements 已反序列化为数组）
export interface SessionDTO {
  id: string;
  userId: string;
  experimentId: string;
  status: SessionStatus;
  steps: SessionStep[];
  measurements: SessionMeasurement[];
  report: ExperimentReport | null;
  startedAt: string;
  completedAt: string | null;
}
