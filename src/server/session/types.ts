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
  // 动作类型，自由文本。labStore 实际上报的取值：
  // add / remove / mix / reset / energize / de-energize / heat / cool，
  // 以及 3D 场景自定义的 titration-* 等（原样注入 AI 报告 prompt，模型按语义理解）
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
  /**
   * 体积 / mL（容器内液体总量）。定量实验的结论算式离不开体积
   * （中和滴定的 c(待测)=c(标准)·V(标准)/V(待测)），只有 pH 与温度算不出浓度。
   */
  volume?: number;
  /**
   * 产生这条记录的动作标记，取值与 operations.ts 的 label 一致（「读数」「加热」「混合」…）。
   * AI 报告靠它区分"学生主动读的数"与"混合/加热顺带留下的快照"：
   * 只有前者构成平行测定，混合前后的两条读数放一起算偏差会得出荒谬的结论。
   * 旧会话没有这个字段，因此可选。
   */
  mark?: string;
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

/**
 * 会话里是否有过任何实验操作。
 *
 * 会话在打开实验页时就建好（LabWorkbench 挂载即 initSession），而不是在第一次操作时，
 * 于是「点进来看一眼就走」也会留下一条会话。本地库实测 277 条里 212 条完全为空（77%）：
 * 「我的会话」被一整屏「进行中」的空记录淹没，点进去还能对着一场什么都没发生的实验
 * 生成 AI 报告 —— 模型只能凭实验简介编一份结论，既白耗配额又会误导学生。
 * 已有报告的也算有内容（历史上可能先生成过报告），不能从列表里消失。
 */
export function hasActivity(
  s: Pick<SessionDTO, "steps" | "measurements" | "report">,
): boolean {
  return s.steps.length > 0 || s.measurements.length > 0 || s.report !== null;
}
