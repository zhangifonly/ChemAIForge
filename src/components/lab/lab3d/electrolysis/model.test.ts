// 电解硫酸铜定量模型的守卫：数值逐项对照 docs/electrolysis-lab-vision.md 的化学事实表。
import { describe, expect, it } from "vitest";
import {
  FARADAY,
  INITIAL,
  M_CU,
  advance,
  copperLayerMicrons,
  isDepleted,
  readings,
  solutionColor,
  solutionTransmittance,
  weighCathode,
} from "./model";

const after = (currentA: number, minutes: number) =>
  advance({ chargeC: 0, seconds: 0 }, currentA, minutes * 60);

describe("法拉第定律", () => {
  it("1.0 A × 30 min 析出铜 0.593 g（愿景文档表中数值）", () => {
    expect(readings(after(1.0, 30), "graphite").copperDepositedG).toBeCloseTo(0.5927, 3);
  });

  it("1.0 A × 30 min 石墨阳极放出氧气 104.5 mL（STP）", () => {
    expect(readings(after(1.0, 30), "graphite").oxygenMl).toBeCloseTo(104.5, 0);
  });

  it("析出铜与电量成正比：电流加倍或时间加倍，析出量都加倍", () => {
    const base = readings(after(0.5, 20), "graphite").copperDepositedG;
    expect(readings(after(1.0, 20), "graphite").copperDepositedG).toBeCloseTo(base * 2, 6);
    expect(readings(after(0.5, 40), "graphite").copperDepositedG).toBeCloseTo(base * 2, 6);
  });

  it("每 2 mol 电子析出 1 mol 铜", () => {
    const q = 2 * FARADAY; // 恰好 2 mol 电子
    expect(readings({ chargeC: q, seconds: 1 }, "copper").copperDepositedG).toBeCloseTo(M_CU, 6);
  });
});

describe("阳极材料决定电极反应", () => {
  it("石墨阳极：放氧、溶液 Cu²⁺ 减少、逐渐变酸", () => {
    const r = readings(after(1.0, 30), "graphite");
    expect(r.oxygenMl).toBeGreaterThan(0);
    expect(r.cuConcentration).toBeLessThan(INITIAL.concentration);
    expect(r.ph).toBeLessThan(3.8);
    expect(r.anodeDissolvedG).toBe(0);
  });

  it("铜阳极（电解精炼）：不放氧、溶液浓度不变、阳极溶解量等于阴极析出量", () => {
    const r = readings(after(1.0, 30), "copper");
    expect(r.oxygenMl).toBe(0);
    expect(r.cuConcentration).toBe(INITIAL.concentration);
    expect(r.anodeDissolvedG).toBeCloseTo(r.copperDepositedG, 9);
  });

  it("石墨阳极：生成的 H⁺ 与转移电子等物质的量（4e⁻ ↔ 4H⁺）", () => {
    const s = after(1.0, 30);
    const ne = s.chargeC / FARADAY;
    expect(readings(s, "graphite").hPlusConcentration).toBeCloseTo(ne / INITIAL.volumeL, 9);
  });
});

describe("铜离子消耗与耗尽", () => {
  it("1.0 A 约 129 分钟后浓度降到 0.1 mol/L", () => {
    expect(readings(after(1.0, 129), "graphite").cuConcentration).toBeCloseTo(0.1, 2);
  });

  it("析出量不会超过溶液里原有的铜", () => {
    const r = readings(after(2.0, 10000), "graphite");
    expect(r.copperDepositedG).toBeCloseTo(INITIAL.concentration * INITIAL.volumeL * M_CU, 6);
    expect(r.cuConcentration).toBe(0);
  });

  it("浓度降到 0.02 mol/L 以下视为耗尽；铜阳极永不耗尽", () => {
    expect(isDepleted(after(1.0, 60), "graphite")).toBe(false);
    expect(isDepleted(after(1.0, 400), "graphite")).toBe(true);
    expect(isDepleted(after(1.0, 400), "copper")).toBe(false);
  });
});

describe("溶液颜色按 Beer–Lambert 非线性变淡", () => {
  it("透射率随浓度单调下降", () => {
    expect(solutionTransmittance(0)).toBe(1);
    expect(solutionTransmittance(0.1)).toBeGreaterThan(solutionTransmittance(0.3));
  });

  it("0.3 mol/L 仍是深蓝：透射率不足 5%（线性插值会错误地让它显得已经很淡）", () => {
    expect(solutionTransmittance(0.3)).toBeLessThan(0.05);
  });

  it("0.05 mol/L 才明显变淡：透射率过半", () => {
    expect(solutionTransmittance(0.05)).toBeGreaterThan(0.5);
  });

  it("颜色输出为合法十六进制，且浓度越高越深", () => {
    const lum = (hex: string) => parseInt(hex.slice(1, 3), 16) + parseInt(hex.slice(3, 5), 16);
    expect(solutionColor(0.5)).toMatch(/^#[0-9a-f]{6}$/);
    expect(lum(solutionColor(0.5))).toBeLessThan(lum(solutionColor(0.05)));
  });
});

describe("铜层与称量", () => {
  it("0.593 g 铜在 12 cm² 上约 55 μm", () => {
    expect(copperLayerMicrons(0.5927)).toBeCloseTo(55.1, 0);
  });

  it("称量值略低于理论值，电流效率 97%–99.5%", () => {
    const { measuredG, efficiency } = weighCathode(0.5927, 42);
    expect(measuredG).toBeLessThan(0.5927);
    expect(efficiency).toBeGreaterThan(0.96);
    expect(efficiency).toBeLessThan(1.0);
  });

  it("同一次实验反复称量读数一致", () => {
    expect(weighCathode(0.3, 7)).toEqual(weighCathode(0.3, 7));
  });

  it("未通电时称量为 0", () => {
    expect(weighCathode(0, 1).measuredG).toBeLessThan(0.0003);
  });
});
