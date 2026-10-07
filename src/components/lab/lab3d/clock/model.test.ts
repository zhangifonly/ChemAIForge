// 碘钟反应动力学模型的行为测试（先于实现编写）。
// 体系：H2O2 + 2I⁻ + 2H⁺ → I2 + 2H2O（慢，速率 k[H2O2][I⁻]）；I2 + 2S2O3²⁻ → 2I⁻ + S4O6²⁻（瞬间）。
// 可能出错的方式：
//  1. 诱导期数量级不对（课堂上是几十秒）
//  2. 对 I⁻ 的级数不是 1（加倍 KI 诱导期应减半）
//  3. 硫代硫酸钠加倍时诱导期没有近似加倍
//  4. 温度效应与 Ea≈56 kJ/mol 不符；从数据拟合 Arrhenius 求不回 Ea
//  5. 硫代硫酸钠过量（≥2×H2O2）时仍然变蓝
//  6. 诱导期内就有蓝色、或到点后变蓝不够"突然"
//  7. 没加淀粉也变蓝（应只显黄棕色）
//  8. 硫代硫酸钠浓度变负、I2 随时间减少
//  9. 计时读数的"实验误差"不可复现或过大
import { describe, expect, it } from "vitest";
import { R, EA, fitLine, inductionTime, measuredTime, mixture, type ClockParams } from "./model";

const BASE: ClockParams = { ki: 0.05, h2o2: 0.05, thio: 0.005, tempC: 25, starch: true };
const t0 = inductionTime(BASE);

describe("碘钟：诱导期", () => {
  it("基准配方的诱导期在 15–40 s", () => {
    expect(t0).toBeGreaterThan(15);
    expect(t0).toBeLessThan(40);
  });

  it("KI 加倍诱导期减半：对 I⁻ 一级", () => {
    expect(inductionTime({ ...BASE, ki: 0.1 }) / t0).toBeCloseTo(0.5, 2);
  });

  it("H2O2 加倍诱导期约减半，硫代硫酸钠加倍诱导期约加倍", () => {
    expect(inductionTime({ ...BASE, h2o2: 0.1 }) / t0).toBeGreaterThan(0.47);
    expect(inductionTime({ ...BASE, h2o2: 0.1 }) / t0).toBeLessThan(0.5);
    expect(inductionTime({ ...BASE, thio: 0.01 }) / t0).toBeGreaterThan(2);
    expect(inductionTime({ ...BASE, thio: 0.01 }) / t0).toBeLessThan(2.06);
  });

  it("升温 10 ℃ 诱导期缩短约一半", () => {
    const ratio = t0 / inductionTime({ ...BASE, tempC: 35 });
    expect(ratio).toBeGreaterThan(1.9);
    expect(ratio).toBeLessThan(2.3);
  });

  it("硫代硫酸钠不少于 H2O2 的两倍时永远不变蓝", () => {
    const p = { ...BASE, thio: 0.1 };
    expect(inductionTime(p)).toBe(Infinity);
    expect(mixture(p, 3600).blue).toBe(0);
  });
});

describe("碘钟：数据处理", () => {
  it("由四个温度的诱导期作 ln(1/t)–1/T 直线，斜率求回 Ea", () => {
    const pts = [15, 25, 35, 45].map((c) => [1 / (c + 273.15), Math.log(1 / inductionTime({ ...BASE, tempC: c }))] as [number, number]);
    const fit = fitLine(pts)!;
    expect(-fit.slope * R).toBeGreaterThan(EA * 0.97);
    expect(-fit.slope * R).toBeLessThan(EA * 1.03);
    expect(fit.r2).toBeGreaterThan(0.999);
  });

  it("ln(1/t)–ln[KI] 斜率为 1（反应级数）", () => {
    const pts = [0.02, 0.04, 0.08].map((c) => [Math.log(c), Math.log(1 / inductionTime({ ...BASE, ki: c }))] as [number, number]);
    expect(fitLine(pts)!.slope).toBeCloseTo(1, 3);
  });

  it("少于两个点或 x 全相同返回 null", () => {
    expect(fitLine([[1, 2]])).toBeNull();
    expect(fitLine([[1, 2], [1, 3]])).toBeNull();
  });

  it("计时读数：同一种子可复现，误差在 ±3% 内", () => {
    const a = measuredTime(BASE, 42), b = measuredTime(BASE, 42);
    expect(a).toBe(b);
    for (let s = 1; s < 50; s++) expect(Math.abs(measuredTime(BASE, s) / t0 - 1)).toBeLessThan(0.03);
  });
});

describe("碘钟：颜色突变", () => {
  it("诱导期内完全无色，到点后 2 秒内深蓝", () => {
    expect(mixture(BASE, t0 * 0.98).blue).toBe(0);
    expect(mixture(BASE, t0 + 2).blue).toBeGreaterThan(0.8);
  });

  it("不加淀粉：不显蓝，只显黄棕色", () => {
    const m = mixture({ ...BASE, starch: false }, t0 + 10);
    expect(m.blue).toBe(0);
    expect(m.yellow).toBeGreaterThan(0.2);
  });

  it("硫代硫酸钠单调减到 0 不为负，I2 单调不减", () => {
    let prevI2 = 0, prevS = Infinity;
    for (let t = 0; t <= 120; t += 0.5) {
      const m = mixture(BASE, t);
      expect(m.thio).toBeGreaterThanOrEqual(0);
      expect(m.thio).toBeLessThanOrEqual(prevS);
      expect(m.i2).toBeGreaterThanOrEqual(prevI2);
      prevI2 = m.i2;
      prevS = m.thio;
    }
  });
});
