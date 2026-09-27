import { describe, expect, it } from "vitest";

import {
  extractRows,
  latestGroup,
  relativeDeviation,
  worstDeviation,
} from "./dataStats";
import type { TracePoint } from "./labStore";

function p(t: number, mark?: string, temperature = 25): TracePoint {
  return { t, ph: 7, temperature, volume: 10, mark };
}

describe("从 trace 提取读数行", () => {
  it("只取「读数」标记的点，加热/搅拌等过程点不进表", () => {
    const rows = extractRows([
      p(0, "加盐酸"),
      p(1, "读数", 25),
      p(2, "加热"),
      p(3, "读数", 40),
      p(4),
    ]);
    expect(rows.map((r) => r.temperature)).toEqual([25, 40]);
  });

  it("序号从 1 连续编号，不沿用 trace 下标", () => {
    const rows = extractRows([p(0, "加热"), p(1, "读数"), p(9, "读数")]);
    expect(rows.map((r) => r.index)).toEqual([1, 2]);
    expect(rows.map((r) => r.t)).toEqual([1, 9]);
  });

  it("没有读数时返回空表", () => {
    expect(extractRows([p(0, "加热"), p(1)])).toEqual([]);
  });
});

describe("按体系状态分组", () => {
  it("体系被改动（混合/加热）后开新组，混合前后的读数不算平行测定", () => {
    const rows = extractRows([
      p(0, "读数", 25),
      p(1, "读数", 25),
      p(2, "混合"),
      p(3, "读数", 40),
    ]);
    expect(rows.map((r) => r.group)).toEqual([0, 0, 1]);
  });

  it("首次读数之前的取用不算分组边界（否则第一组永远是空的）", () => {
    const rows = extractRows([p(0, "加盐酸"), p(1, "加氢氧化钠"), p(2, "读数")]);
    expect(rows.map((r) => r.group)).toEqual([0]);
  });

  it("无标记的纯采样点不分组：加热滑杆连续采样不该打断一组测定", () => {
    const rows = extractRows([p(0, "读数"), p(1), p(2), p(3, "读数")]);
    expect(rows.map((r) => r.group)).toEqual([0, 0]);
  });

  it("latestGroup 只取最近一组，往组留在表里但不参与统计", () => {
    const rows = extractRows([
      p(0, "读数", 25),
      p(1, "混合"),
      p(2, "读数", 40),
      p(3, "读数", 41),
    ]);
    const cur = latestGroup(rows);
    expect(cur.map((r) => r.temperature)).toEqual([40, 41]);
    expect(rows).toHaveLength(3);
  });

  it("空表的 latestGroup 是空数组", () => {
    expect(latestGroup([])).toEqual([]);
  });
});

describe("相对平均偏差", () => {
  it("单次测量算不出偏差（平行测定至少 2 次）", () => {
    expect(relativeDeviation([25])).toBeNull();
    expect(relativeDeviation([])).toBeNull();
  });

  it("完全一致的读数偏差为 0", () => {
    expect(relativeDeviation([25, 25, 25])).toBe(0);
  });

  it("按 Σ|xi−x̄| / (n·x̄) 计算", () => {
    // 平均 25，偏差和 |24-25|+|26-25| = 2，2 / (2×25) = 4%
    expect(relativeDeviation([24, 26])).toBeCloseTo(4, 6);
  });

  it("均值为 0 时无意义，返回 null（避免除零得到 Infinity）", () => {
    expect(relativeDeviation([-1, 1])).toBeNull();
  });

  it("负均值取绝对值，偏差恒为非负", () => {
    const d = relativeDeviation([-24, -26]);
    expect(d).toBeCloseTo(4, 6);
  });
});

describe("整组数据的最大偏差", () => {
  const row = (temperature: number, ph: number) => ({
    index: 1,
    t: 0,
    temperature,
    ph,
    volume: 10,
    group: 0,
  });

  it("取温度与 pH 里飘得更厉害的那一路", () => {
    // 温度 24/26 → 4%；pH 7/7 → 0%。整体判据应是 4%
    const worst = worstDeviation([row(24, 7), row(26, 7)]);
    expect(worst).toBeCloseTo(4, 6);
  });

  it("温度稳但 pH 飘时同样报警，不会被稳的那一路掩盖", () => {
    // 温度 25/25 → 0%；pH 6/8 → 14.29%
    const worst = worstDeviation([row(25, 6), row(25, 8)]);
    expect(worst).toBeCloseTo(100 / 7, 4);
  });

  it("只有一行时无偏差可算，返回 0 而不是 NaN", () => {
    expect(worstDeviation([row(25, 7)])).toBe(0);
  });
});
