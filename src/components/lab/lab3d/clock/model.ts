// 碘钟反应（过氧化氢–碘化钾–硫代硫酸钠，Harcourt–Esson 体系）的动力学模型。
//
//   慢：H2O2 + 2I⁻ + 2H⁺ → I2 + 2H2O      速率 = k[H2O2][I⁻]
//   快：I2 + 2S2O3²⁻ → 2I⁻ + S4O6²⁻        （瞬间，把 I2 还原回 I⁻）
//
// 诱导期内 I⁻ 不断被再生，可视为常数，于是 H2O2 按准一级衰减：
//   [H2O2](t) = H0·e^(−k·I·t)，消耗的 S2O3²⁻ = 2H0(1 − e^(−kIt))
// 硫代硫酸钠耗尽的时刻即诱导期 t* = −ln(1 − S0/(2H0)) / (kI)。
// 之后 I2 累积，与淀粉生成深蓝色包合物（显色阈值约 10⁻⁵ mol/L），所以变蓝是"突然"的。
//
// k(T)：含酸催化项 k = k1 + k2[H⁺]，取 [H⁺]=0.2 mol/L（0.1 mol/L H2SO4）；
// 25 ℃ 时 k1 = 0.0115 L·mol⁻¹·s⁻¹、k2 = 0.173 L²·mol⁻²·s⁻¹；Arrhenius 活化能 56 kJ/mol。

export const R = 8.314;
export const EA = 56000; // J/mol
const K25 = 0.0115 + 0.173 * 0.2;
const T25 = 298.15;
/** 淀粉–碘显色的特征浓度（mol/L） */
const STARCH_C = 1.2e-5;
/** 三碘离子黄棕色的特征浓度（mol/L），远高于淀粉显色阈值 —— 不加淀粉时变色迟缓且淡 */
const I3_C = 6e-4;

export interface ClockParams {
  /** 混合后各物质浓度（mol/L） */
  ki: number;
  h2o2: number;
  thio: number;
  tempC: number;
  starch: boolean;
}

export function rateConstant(tempC: number): number {
  return K25 * Math.exp((-EA / R) * (1 / (tempC + 273.15) - 1 / T25));
}

export function inductionTime(p: ClockParams): number {
  const f = p.thio / (2 * p.h2o2);
  if (f >= 1) return Infinity;
  return -Math.log(1 - f) / (rateConstant(p.tempC) * p.ki);
}

export interface Mixture {
  h2o2: number;
  thio: number;
  i2: number;
  /** 淀粉–碘蓝色程度 0..1 */
  blue: number;
  /** I3⁻ 黄棕色程度 0..1 */
  yellow: number;
}

export function mixture(p: ClockParams, t: number): Mixture {
  const kI = rateConstant(p.tempC) * p.ki;
  const ts = inductionTime(p);
  const h2o2 = p.h2o2 * Math.exp(-kI * Math.max(0, t));
  let thio = 0, i2 = 0;
  if (t < ts) {
    thio = Math.max(0, p.thio - 2 * (p.h2o2 - h2o2));
  } else {
    // 过了诱导期：此后被氧化出的碘全部留在溶液里；碘不能超过碘离子总量的一半
    i2 = Math.min(p.ki / 2, p.h2o2 * Math.exp(-kI * ts) - h2o2);
  }
  const blue = p.starch ? 1 - Math.exp(-i2 / STARCH_C) : 0;
  const yellow = p.starch ? 0 : 1 - Math.exp(-i2 / I3_C);
  return { h2o2, thio, i2, blue, yellow };
}

/** 学生的秒表读数：真实诱导期 × (1 ± 2.5%)，误差由种子决定（同一次实验可复现） */
export function measuredTime(p: ClockParams, seed: number): number {
  let x = (seed ^ 0x9e3779b9) >>> 0;
  x = Math.imul(x ^ (x >>> 16), 0x85ebca6b) >>> 0;
  x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35) >>> 0;
  const u = ((x ^ (x >>> 16)) >>> 0) / 4294967296;
  return inductionTime(p) * (1 + (u - 0.5) * 0.05);
}

export interface LineFit { slope: number; intercept: number; r2: number }

export function fitLine(pts: readonly [number, number][]): LineFit | null {
  const n = pts.length;
  if (n < 2) return null;
  const mx = pts.reduce((s, p) => s + p[0], 0) / n;
  const my = pts.reduce((s, p) => s + p[1], 0) / n;
  let sxx = 0, sxy = 0, syy = 0;
  for (const [x, y] of pts) {
    sxx += (x - mx) ** 2;
    sxy += (x - mx) * (y - my);
    syy += (y - my) ** 2;
  }
  if (sxx === 0) return null;
  const slope = sxy / sxx;
  return { slope, intercept: my - slope * mx, r2: syy === 0 ? 1 : (sxy * sxy) / (sxx * syy) };
}
