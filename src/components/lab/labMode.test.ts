// 实验台模式判定测试：锁定每个实验映射到唯一正确模式，防止检测逻辑回归。
import { describe, it, expect } from "vitest";
import { allExperiments } from "@/data/experiments";
import { resolveSubstance } from "./reagents";
import { resolveLabMode, type LabMode } from "./labMode";

const modeOf = (slug: string): LabMode => {
  const e = allExperiments.find((x) => x.slug === slug)!;
  return resolveLabMode(e.apparatus, e.reagents.map(resolveSubstance));
};

describe("resolveLabMode", () => {
  it("每个实验都落入四种模式之一", () => {
    for (const e of allExperiments) {
      const m = resolveLabMode(e.apparatus, e.reagents.map(resolveSubstance));
      expect(["conductivity", "electrolysis", "galvanic", "mixing"]).toContain(m);
    }
  });

  it("电解实验 → electrolysis", () => {
    expect(modeOf("copper-electrolysis")).toBe("electrolysis");
    expect(modeOf("electroplating-copper")).toBe("electrolysis");
  });

  it("原电池 / 腐蚀实验 → galvanic", () => {
    expect(modeOf("copper-zinc-cell")).toBe("galvanic");
    expect(modeOf("sacrificial-anode")).toBe("galvanic");
    expect(modeOf("iron-electrochemical-corrosion")).toBe("galvanic");
  });

  it("电导率实验 → conductivity", () => {
    expect(modeOf("weak-acid-ionization")).toBe("conductivity");
  });

  it("各模式数量守恒且非电化学多数为混合", () => {
    const counts = { conductivity: 0, electrolysis: 0, galvanic: 0, mixing: 0 };
    for (const e of allExperiments) {
      counts[resolveLabMode(e.apparatus, e.reagents.map(resolveSubstance))]++;
    }
    // 四模式之和须等于总数（每个实验恰好归一类）
    const sum = counts.conductivity + counts.electrolysis + counts.galvanic + counts.mixing;
    expect(sum).toBe(allExperiments.length);
    // 电解 / 原电池是少数特化模式，混合始终占多数
    expect(counts.electrolysis).toBeGreaterThan(0);
    expect(counts.galvanic).toBeGreaterThan(0);
    expect(counts.mixing).toBeGreaterThan(counts.electrolysis + counts.galvanic);
  });
});
