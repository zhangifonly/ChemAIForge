// 原电池引擎测试：金属活动性定正负极、酸性析氢 / 中性吸氧。
import { describe, it, expect } from "vitest";
import { galvanicCell } from "./galvanic";

const acid = { formula: "H2SO4", name: "硫酸" };
const salt = { formula: "NaCl", name: "食盐水" };

describe("galvanicCell", () => {
  it("铜锌原电池（稀硫酸）：锌负极溶解、铜正极析氢", () => {
    const r = galvanicCell(["Zn", "Cu"], acid)!;
    expect(r.negative.metal).toBe("Zn");
    expect(r.positive.metal).toBe("Cu");
    expect(r.positive.kind).toBe("hydrogen");
    expect(r.oxygenAbsorption).toBe(false);
  });

  it("铁锌（食盐水）：锌作负极（牺牲阳极保护铁），吸氧腐蚀", () => {
    const r = galvanicCell(["Fe", "Zn"], salt)!;
    expect(r.negative.metal).toBe("Zn"); // 锌更活泼
    expect(r.positive.metal).toBe("Fe");
    expect(r.positive.kind).toBe("oxygen");
    expect(r.oxygenAbsorption).toBe(true);
  });

  it("单一金属铁（食盐水）：铁负极、碳正极吸氧腐蚀", () => {
    const r = galvanicCell(["Fe"], salt)!;
    expect(r.negative.metal).toBe("Fe");
    expect(r.positive.metal).toBe("C");
    expect(r.positive.kind).toBe("oxygen");
  });

  it("电子流向由负极到正极", () => {
    const r = galvanicCell(["Zn", "Cu"], acid)!;
    expect(r.electronFlow).toContain("负极");
    expect(r.electronFlow).toContain("正极");
  });

  it("无已知金属返回 null", () => {
    expect(galvanicCell(["NaCl"], salt)).toBeNull();
  });
});
