// 定量实验的统计核心：读数分组与相对平均偏差。
//
// 为什么放在 lib 而不是留在 components/lab/dataStats.ts：实验台的数据记录表和
// AI 报告都要给出"平均值 X、相对偏差 Y%"这句结论。两处各实现一遍偏差公式，
// 迟早出现界面说 0.4%、报告说 3.2% 的情况 —— 学生无从判断哪个数是真的。
// 判据只有一份实现，两边才必然一致。

/** 一次读数的公共形状：TracePoint（前端曲线）与 SessionMeasurement（会话记录）的交集 */
export interface Reading {
  ph: number;
  temperature: number;
  volume?: number;
  /** 产生这个点的动作标记，取值与 operations.ts 的 label 一致 */
  mark?: string;
}

/** 读数操作的标记文本，与 operations.ts 的 read.label 一致 */
export const READ_MARK = "读数";

/**
 * 挑出「读数」点并按体系状态分组，返回每个点及其组号。
 *
 * 体系一被改动（取用试剂 / 混合 / 加热）就换一组：平行测定的前提是"同一体系重复测"，
 * 混合前后的两个读数不是两次平行测定，把它们放一起算偏差会得出"偏差 80%"这种
 * 毫无意义的结论。加热、搅拌、取用产生的采样点本身不是测量值，只作分组边界。
 */
export function groupReadings<T extends Reading>(
  points: T[],
): { point: T; group: number }[] {
  const out: { point: T; group: number }[] = [];
  let group = 0;
  for (const p of points) {
    if (p.mark === READ_MARK) {
      out.push({ point: p, group });
      continue;
    }
    // 首次读数之前的改动不算分组边界，否则第一组永远是空的
    if (p.mark && out.length > 0) group += 1;
  }
  return out;
}

/** 算术平均值；空数组返回 null（没有数据不等于平均值为 0） */
export function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

/**
 * 相对平均偏差（%）：Σ|xi − x̄| / (n · x̄) × 100。
 *
 * 用它而不是标准差：中学化学定量实验的规范判据就是相对平均偏差，
 * 且平行测定通常只有 2-3 次，样本量太小时标准差没有统计意义。
 * 少于 2 个值返回 null —— 单次测定谈不上偏差。
 * 均值为 0 时也返回 null：除下去是 Infinity，那不是"偏差无穷大"而是判据不适用。
 */
export function relativeDeviation(values: number[]): number | null {
  if (values.length < 2) return null;
  const m = mean(values);
  if (m === null || m === 0) return null;
  const sum = values.reduce((a, v) => a + Math.abs(v - m), 0);
  return (sum / (values.length * Math.abs(m))) * 100;
}

/** 数据一致性的三档判定，界面评语与报告口径共用 */
export type Consistency = "good" | "fair" | "poor";

/**
 * 按最大相对偏差给出一致性档位（先声明，供下方 statsOf 使用）。
 * 阈值 1% / 5% 取自中学定量实验的通行要求：平行测定相对偏差一般应在 1% 以内，
 * 超过 5% 属于必须查明原因后重做，不能直接取平均。
 */
export function consistencyOf(worst: number): Consistency {
  if (worst <= 1) return "good";
  if (worst <= 5) return "fair";
  return "poor";
}

/** 一组平行测定的统计结果 */
export interface GroupStats {
  count: number;
  phMean: number;
  temperatureMean: number;
  /** 未记录体积的旧会话为 null */
  volumeMean: number | null;
  /** pH / 温度两路里最大的相对平均偏差（%），单次测定时为 null */
  worstDeviation: number | null;
  consistency: Consistency | null;
}

/**
 * 取一组读数的统计量。
 * 温度与 pH 两路取更差的那个：只要有一路不稳，这组数据就不该直接用来下结论。
 */
export function statsOf(rows: Reading[]): GroupStats | null {
  if (rows.length === 0) return null;
  const volumes = rows
    .map((r) => r.volume)
    .filter((v): v is number => v !== undefined);
  // 单次测定不给偏差：算不出，也不该拿 0 冒充「完全一致」
  const worst =
    rows.length >= 2
      ? Math.max(
          relativeDeviation(rows.map((r) => r.temperature)) ?? 0,
          relativeDeviation(rows.map((r) => r.ph)) ?? 0,
        )
      : null;
  return {
    count: rows.length,
    phMean: mean(rows.map((r) => r.ph)) ?? 0,
    temperatureMean: mean(rows.map((r) => r.temperature)) ?? 0,
    volumeMean: volumes.length > 0 ? mean(volumes) : null,
    worstDeviation: worst,
    consistency: worst === null ? null : consistencyOf(worst),
  };
}

/** 按体系状态把「读数」分成若干组平行测定，顺序与实验进行顺序一致 */
export function readingGroups<T extends Reading>(points: T[]): T[][] {
  const groups = new Map<number, T[]>();
  for (const { point, group } of groupReadings(points)) {
    const list = groups.get(group);
    if (list) list.push(point);
    else groups.set(group, [point]);
  }
  return [...groups.values()];
}
