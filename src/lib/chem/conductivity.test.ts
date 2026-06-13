// 导电性引擎测试：强电解质明亮、弱电解质微亮、非电解质不亮。
import { describe, it, expect } from "vitest";
import { conductivity } from "./conductivity";
import type { Substance } from "./engine";

const sub = (formula: string, category: any, name: string): Substance => ({
  formula,
  category,
  name,
});

describe("conductivity", () => {
  it("盐酸（强酸）→ 强电解质、灯泡明亮", () => {
    const r = conductivity(sub("HCl", "acid", "盐酸"));
    expect(r.level).toBe("strong");
    expect(r.bulb).toBe(1);
  });

  it("乙酸（弱酸）→ 弱电解质、灯泡微亮", () => {
    const r = conductivity(sub("CH3COOH", "acid", "乙酸"));
    expect(r.level).toBe("weak");
    expect(r.bulb).toBeGreaterThan(0);
    expect(r.bulb).toBeLessThan(1);
  });

  it("氨水（弱碱）→ 弱电解质", () => {
    expect(conductivity(sub("NH3·H2O", "base", "氨水")).level).toBe("weak");
  });

  it("氯化钠（盐）→ 强电解质", () => {
    expect(conductivity(sub("NaCl", "salt", "氯化钠")).level).toBe("strong");
  });

  it("蔗糖 → 非电解质、灯泡不亮", () => {
    const r = conductivity(sub("C12H22O11", "organic", "蔗糖"));
    expect(r.level).toBe("none");
    expect(r.bulb).toBe(0);
  });
});
