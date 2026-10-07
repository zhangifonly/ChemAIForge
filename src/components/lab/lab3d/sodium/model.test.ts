// 钠与水反应模型的行为测试（先于实现编写）。
// 可能出错的方式：
//  1. 质量不守恒：已反应 + 剩余 ≠ 初始；氢气体积与反应的钠不按 2Na→H2 对应
//  2. 大块与小块反应时长关系错（应按缩球模型 t ∝ r ∝ m^(1/3)，不是 ∝ m）
//  3. 剩余质量变负、反应完后再推进仍在产气
//  4. 起始 pH 因 log(0) 得到 NaN / Infinity
//  5. 一帧 dt 极大（切回后台标签页）时一步越界
//  6. 水温升高与反应焓（−184 kJ/mol Na）对不上
//  7. 小块也"着火"、大块不着火
//  8. 酚酞在中性水里就显红
import { describe, expect, it } from "vitest";
import {
  PIECES,
  advance,
  initialState,
  phenolphthaleinPink,
  readings,
  totalReactionSeconds,
} from "./model";

const NA = 22.99;
const VM_25C = 24.465; // L/mol，25 ℃、1 atm

function runToEnd(mass: number) {
  let s = initialState(mass);
  for (let i = 0; i < 100000 && s.naRemainingG > 0; i++) s = advance(s, 0.02);
  return s;
}

describe("钠与水：质量与产气", () => {
  it("绿豆大小（0.05 g）反应完：氢气约 26.6 mL，pH 约 12.34", () => {
    const end = runToEnd(PIECES.small);
    const r = readings(end);
    expect(end.naRemainingG).toBe(0);
    expect(r.h2mL).toBeCloseTo((0.05 / NA / 2) * VM_25C * 1000, 1);
    expect(r.ph).toBeCloseTo(14 + Math.log10(0.05 / NA / 0.1), 2);
  });

  it("任意时刻已反应 + 剩余 = 初始质量", () => {
    let s = initialState(PIECES.medium);
    for (let i = 0; i < 200; i++) {
      s = advance(s, 0.05);
      expect(s.naReactedG + s.naRemainingG).toBeCloseTo(PIECES.medium, 9);
    }
  });

  it("反应完后继续推进不再变化", () => {
    const end = runToEnd(PIECES.small);
    const later = advance(end, 30);
    expect(readings(later).h2mL).toBe(readings(end).h2mL);
    expect(later.naRemainingG).toBe(0);
  });

  it("一步推进 1 小时也不会得到负质量", () => {
    const s = advance(initialState(PIECES.large), 3600);
    expect(s.naRemainingG).toBe(0);
    expect(s.naReactedG).toBeCloseTo(PIECES.large, 9);
  });
});

describe("钠与水：动力学与热", () => {
  it("小块在十几秒内反应完，符合课堂观察", () => {
    const t = totalReactionSeconds(PIECES.small);
    expect(t).toBeGreaterThan(8);
    expect(t).toBeLessThan(25);
  });

  it("质量 10 倍时反应时长约为 10^(1/3) 倍而不是 10 倍（温升加速使其略短）", () => {
    const ratio = totalReactionSeconds(0.5) / totalReactionSeconds(0.05);
    expect(ratio).toBeGreaterThan(1.6);
    expect(ratio).toBeLessThan(10 ** (1 / 3) + 0.05);
  });

  it("0.5 g 钠使 100 mL 水升温约 9.6 ℃", () => {
    const r = readings(runToEnd(0.5));
    const expected = ((0.5 / NA) * 184300) / (100 * 4.184);
    expect(r.tempC - 25).toBeCloseTo(expected, 1);
  });

  it("起始 pH 为 7，温度 25 ℃，没有 NaN", () => {
    const r = readings(initialState(PIECES.small));
    expect(r.ph).toBe(7);
    expect(r.tempC).toBe(25);
    expect(r.h2mL).toBe(0);
  });
});

describe("钠与水：现象判定", () => {
  it("只有大块钠会引燃氢气", () => {
    expect(readings(advance(initialState(PIECES.small), 1)).ignites).toBe(false);
    expect(readings(advance(initialState(PIECES.large), 1)).ignites).toBe(true);
    // 反应结束就不再燃烧
    expect(readings(runToEnd(PIECES.large)).ignites).toBe(false);
  });

  it("酚酞：中性无色，pH 8.2 以下近无色，pH 10 以上接近全红", () => {
    expect(phenolphthaleinPink(7)).toBe(0);
    expect(phenolphthaleinPink(8)).toBeLessThan(0.1);
    expect(phenolphthaleinPink(10)).toBeGreaterThan(0.9);
    expect(phenolphthaleinPink(12.3)).toBeGreaterThan(0.99);
  });
});
