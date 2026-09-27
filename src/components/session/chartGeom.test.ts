import { describe, expect, it } from "vitest";
import {
  CHART_H,
  CHART_PAD,
  CHART_W,
  PH_RANGE,
  TEMP_RANGE,
  axisTicks,
  pointX,
  pointY,
  toPolyline,
} from "./chartGeom";

const TOP = CHART_PAD;
const BOTTOM = CHART_H - CHART_PAD;

describe("pointX", () => {
  it("单点居中，不贴左边缘", () => {
    expect(pointX(0, 1)).toBe(CHART_W / 2);
  });

  it("多点首尾贴内边距、均匀分布", () => {
    expect(pointX(0, 3)).toBe(CHART_PAD);
    expect(pointX(2, 3)).toBe(CHART_W - CHART_PAD);
    expect(pointX(1, 3)).toBe(CHART_W / 2);
  });
});

describe("pointY", () => {
  it("量程下限落在底边、上限落在顶边", () => {
    expect(pointY(PH_RANGE.min, PH_RANGE)).toBe(BOTTOM);
    expect(pointY(PH_RANGE.max, PH_RANGE)).toBe(TOP);
  });

  it("中性 pH 7 落在 pH 轴正中", () => {
    expect(pointY(7, PH_RANGE)).toBe((TOP + BOTTOM) / 2);
  });

  it("超出量程的值夹到边界，不会画到画布外", () => {
    expect(pointY(-5, PH_RANGE)).toBe(BOTTOM);
    expect(pointY(999, TEMP_RANGE)).toBe(TOP);
  });
});

describe("固定量程消除的两个视觉错觉", () => {
  // 回归：原实现按各自 min~max 自适应拉伸，span 为 0 时回退 1，
  // 恒定的 pH 与恒定的温度都被压到 (v-min)/span=0，两条线一起贴底边完全重合。
  it("恒定的 pH 与恒定的温度不再重合", () => {
    const ph = toPolyline([7, 7, 7], PH_RANGE);
    const temp = toPolyline([25, 25, 25], TEMP_RANGE);
    expect(ph).not.toBe(temp);
    // 且都不该贴在底边（那是量程下限的位置，不是"没变化"的位置）
    expect(ph).not.toContain(`,${BOTTOM.toFixed(1)}`);
    expect(temp).not.toContain(`,${BOTTOM.toFixed(1)}`);
  });

  it("恒定读数画成水平线，纵坐标反映真实数值", () => {
    const ys = toPolyline([7, 7, 7], PH_RANGE)
      .split(" ")
      .map((p) => p.split(",")[1]);
    expect(new Set(ys).size).toBe(1);
    expect(Number(ys[0])).toBeCloseTo((TOP + BOTTOM) / 2, 1);
  });

  // 回归：原实现下"pH 微跌 0.1"与"温度暴涨 65℃"振幅完全一样。
  it("变化幅度小的曲线振幅也小，不再被拉伸到满高度", () => {
    const smallSwing = toPolyline([7, 6.9], PH_RANGE);
    const bigSwing = toPolyline([25, 90], TEMP_RANGE);
    const amplitude = (points: string) => {
      const ys = points.split(" ").map((p) => Number(p.split(",")[1]));
      return Math.abs(ys[0] - ys[1]);
    };
    expect(amplitude(smallSwing)).toBeLessThan(2);
    expect(amplitude(bigSwing)).toBeGreaterThan(80);
  });
});

describe("axisTicks", () => {
  it("默认给出下限/中值/上限三档刻度", () => {
    expect(axisTicks(PH_RANGE)).toEqual([
      { value: 0, y: BOTTOM },
      { value: 7, y: (TOP + BOTTOM) / 2 },
      { value: 14, y: TOP },
    ]);
  });

  it("温度轴刻度覆盖 0~100 的业务量程", () => {
    const ticks = axisTicks(TEMP_RANGE);
    expect(ticks.map((t) => t.value)).toEqual([0, 50, 100]);
  });
});
