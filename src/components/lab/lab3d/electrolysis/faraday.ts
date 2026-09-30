// 法拉第定律验证：把多次称量得到的 (电量, 析出铜质量) 画在同一张图上，
// 过原点拟合一条直线，由斜率反推法拉第常数。
//
// 教学目的：学生换不同电流、通电不同时长后分别称量，会发现点子全落在同一条
// 过原点的直线上 —— 析出量只取决于电量 Q = I·t，与电流大小本身无关。
// 这是法拉第第一定律的核心，单看一次称量的"效率 99%"体会不到。
import { FARADAY, M_CU } from "./model";

export interface WeighPoint {
  /** 称量时的累计电量 C */
  chargeC: number;
  /** 天平读数 g */
  measuredG: number;
  /** 最近一段通电所用电流 A（仅用于图上区分点子颜色） */
  currentA: number;
}

export interface FaradayFit {
  /** 拟合斜率 g/C */
  slope: number;
  /** 由斜率反推的法拉第常数 C/mol：F = M / (z·k)，z = 2 */
  faradayExp: number;
  /** 相对公认值 96485 的偏差（有符号） */
  relativeError: number;
}

/**
 * 过原点最小二乘：k = Σ(Q·m) / Σ(Q²)。
 * 为什么强制过原点：Q = 0 时析出量必为 0，这是物理约束而非拟合自由度；
 * 带截距的拟合会把称量误差解释成一个没有意义的"零点铜"。
 */
export function fitFaraday(points: readonly WeighPoint[]): FaradayFit | null {
  let sxy = 0;
  let sxx = 0;
  for (const p of points) {
    if (p.chargeC <= 0) continue;
    sxy += p.chargeC * p.measuredG;
    sxx += p.chargeC * p.chargeC;
  }
  if (sxx === 0 || sxy <= 0) return null;
  const slope = sxy / sxx;
  const faradayExp = M_CU / (2 * slope);
  return { slope, faradayExp, relativeError: (faradayExp - FARADAY) / FARADAY };
}

/**
 * 追加一个称量点。同一电量（取整到 1 C）重复称量只保留一个点 ——
 * 同一次实验反复按称量读数一致，重复点会让拟合被同一个数据加权。
 */
export function addPoint(points: readonly WeighPoint[], p: WeighPoint): WeighPoint[] {
  const key = Math.round(p.chargeC);
  return [...points.filter((q) => Math.round(q.chargeC) !== key), p].sort(
    (a, b) => a.chargeC - b.chargeC,
  );
}

/** 坐标轴上限取 1/2/5 × 10ⁿ 中不小于 x 的最小值，刻度落在整数上 */
export function niceCeil(x: number): number {
  if (!(x > 0)) return 1;
  const exp = Math.floor(Math.log10(x));
  const base = 10 ** exp;
  for (const m of [1, 2, 5, 10]) {
    if (m * base >= x - 1e-12) return m * base;
  }
  return 10 * base;
}

/** 称量用的随机种子：同一电量同一读数，不同电量误差各自独立 */
export function weighSeed(runSeed: number, chargeC: number): number {
  return (runSeed ^ Math.imul(Math.round(chargeC) + 1, 0x9e3779b1)) >>> 0;
}
