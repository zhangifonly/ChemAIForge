// 读数折线图的坐标计算（纯函数，便于单测）
//
// 为什么用固定量程而不是按数据自适应归一化：
// pH 与温度是两个不同量纲的量，画在同一坐标系里。原先各自按 min~max 拉伸到满高度，
// 造成两种错觉 ——
//   1. pH 从 7 跌到 6.9、温度从 25 升到 90，两条线振幅一模一样，看不出谁变化大；
//   2. 更常见的是读数恒定（多数实验 pH 全程不变）：span 为 0 时回退成 1，
//      (v-min)/span 恒为 0，两条线一起贴在画布底边完全重合，红线盖住蓝线，
//      用户只看到一条线，以为图坏了。
// pH 与温度都有业务上的固定区间（labStore 的 deriveReadings / setTemperature
// 都把值夹在 0~14 与 0~100），按固定量程画才能让"位置"本身有含义。

// 画布尺寸与内边距（viewBox 坐标，随容器等比缩放）
export const CHART_W = 480;
export const CHART_H = 200;
export const CHART_PAD = 32;

// 两条曲线的固定量程，与 labStore 的读数夹取区间一致
export const PH_RANGE = { min: 0, max: 14 } as const;
export const TEMP_RANGE = { min: 0, max: 100 } as const;

export interface AxisRange {
  min: number;
  max: number;
}

/** 把第 i 个点（共 n 个）映射为横坐标；单点居中，避免贴在左边缘 */
export function pointX(i: number, n: number): number {
  if (n <= 1) return CHART_W / 2;
  return CHART_PAD + (i * (CHART_W - 2 * CHART_PAD)) / (n - 1);
}

/** 按固定量程把数值映射为纵坐标（y 轴向下，故大值在上）；超出量程夹到边界 */
export function pointY(value: number, range: AxisRange): number {
  const span = range.max - range.min;
  const ratio = span === 0 ? 0 : (value - range.min) / span;
  const clamped = Math.max(0, Math.min(1, ratio));
  return CHART_H - CHART_PAD - clamped * (CHART_H - 2 * CHART_PAD);
}

/** 生成 SVG polyline 的 points 字符串 */
export function toPolyline(values: number[], range: AxisRange): string {
  return values
    .map(
      (v, i) => `${pointX(i, values.length).toFixed(1)},${pointY(v, range).toFixed(1)}`,
    )
    .join(" ");
}

export interface AxisTick {
  /** 刻度值 */
  value: number;
  /** 该刻度在画布上的纵坐标 */
  y: number;
}

/**
 * 生成纵轴刻度（自底向顶均分为 count 段）。
 * 没有刻度的折线只能看出"有没有变"，看不出变到多少 —— 而报告页的误差分析
 * 正是要读具体数值，所以两条曲线各自标一侧刻度。
 */
export function axisTicks(range: AxisRange, count = 2): AxisTick[] {
  const ticks: AxisTick[] = [];
  for (let i = 0; i <= count; i += 1) {
    const value = range.min + ((range.max - range.min) * i) / count;
    ticks.push({ value, y: pointY(value, range) });
  }
  return ticks;
}
