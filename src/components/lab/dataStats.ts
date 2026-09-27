// 数据记录表的计算层。
//
// 单独成文件而不是留在 DataTable.tsx 里：本项目的 vitest 没有配 JSX 转换，
// 从 .tsx 导出的纯函数无法被测试导入。定量实验的平均值与偏差是要给出结论的数字，
// 恰恰是最需要测试覆盖的部分，不能因为放错文件而测不到。
//
// 偏差公式与分组规则本身在 @/lib/quantitative —— AI 报告也要算同一句
// "平均值 X、相对偏差 Y%"，两处各实现一遍迟早对不上口径。这里只做面向表格的适配。
import { groupReadings, relativeDeviation, statsOf } from "@/lib/quantitative";
import type { TracePoint } from "./labStore";

export { relativeDeviation };

/** 一次读数记录（从 trace 里 mark 为「读数」的点提取） */
export interface Row {
  index: number;
  t: number;
  ph: number;
  temperature: number;
  volume: number;
  /** 所属测定组，见 groupReadings 的说明 */
  group: number;
}

/** 从过程曲线里挑出「读数」点并按体系状态分组 */
export function extractRows(trace: TracePoint[]): Row[] {
  return groupReadings(trace).map(({ point, group }, i) => ({
    index: i + 1,
    t: point.t,
    ph: point.ph,
    temperature: point.temperature,
    volume: point.volume,
    group,
  }));
}

/**
 * 最近一组读数：只有这些行处在同一体系状态下，才构成一次平行测定。
 * 之前各组仍留在表里（学生要看得到自己走过的过程），但不参与统计。
 */
export function latestGroup(rows: Row[]): Row[] {
  if (rows.length === 0) return [];
  const g = rows[rows.length - 1].group;
  return rows.filter((r) => r.group === g);
}

/**
 * 整组数据的最大相对偏差：温度与 pH 两路里飘得最厉害的那个。
 * 只要有一路不稳，这组数据就不该直接用来下结论。
 */
export function worstDeviation(rows: Row[]): number {
  // 单次测定时 statsOf 给 null（判据不适用），表格这里落回 0：
  // 界面只在 ≥2 行时才显示评语，取 0 不会被展示出来
  return statsOf(rows)?.worstDeviation ?? 0;
}
