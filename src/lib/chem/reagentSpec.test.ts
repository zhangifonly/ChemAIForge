import { describe, expect, it } from "vitest";
import { amountOf, reagentSpec } from "./reagentSpec";
import { resolveSubstance } from "@/components/lab/reagents";
import { allExperiments } from "@/data/experiments";

describe("reagentSpec", () => {
  it("溶液默认 1.0 mol/L，瓶签写出浓度", () => {
    const s = reagentSpec("HCl", "acid");
    expect(s.phase).toBe("solution");
    expect(s.concentration).toBe(1.0);
    expect(s.label).toBe("1 mol/L");
    expect(s.unit).toBe("mL");
  });

  it("浓硫酸与饱和石灰水走精确覆盖，不用默认值", () => {
    // 这两条是覆盖表存在的理由：按 1 mol/L 处理会让定量结论错一到两个数量级
    expect(reagentSpec("H2SO4", "acid").concentration).toBe(18.4);
    expect(reagentSpec("Ca(OH)2", "base").concentration).toBe(0.02);
  });

  it("金属与氧化物按固体称量，单位为 g", () => {
    const zn = reagentSpec("Zn", "metal");
    expect(zn.phase).toBe("solid");
    expect(zn.unit).toBe("g");
    expect(reagentSpec("CuO", "oxide").phase).toBe("solid");
  });

  it("难溶盐按固体称量，不配成溶液", () => {
    // 碳酸盐类别里 Na2CO3 是溶液、CaCO3 是石灰石固体，只靠 category 分不出来
    expect(reagentSpec("Na2CO3", "carbonate").phase).toBe("solution");
    expect(reagentSpec("CaCO3", "carbonate").phase).toBe("solid");
    expect(reagentSpec("AgCl", "salt").phase).toBe("solid");
    expect(reagentSpec("Fe(OH)3", "base").phase).toBe("solid");
  });

  it("混合物 / 高分子归为 bulk，不参与 mol 计算", () => {
    // 油脂、纤维素没有确定摩尔质量，真实实验里也从不称到 mol
    const f = reagentSpec("fat", "organic");
    expect(f.phase).toBe("bulk");
    expect(f.label).toBe("取适量");
    expect(amountOf(f, 5)).toBeNull();
    expect(reagentSpec("cellulose", "organic").phase).toBe("bulk");
  });

  it("纯液体带密度，瓶签标 ρ", () => {
    const et = reagentSpec("C2H5OH", "organic");
    expect(et.phase).toBe("liquid");
    expect(et.density).toBe(0.789);
    expect(et.label).toContain("0.789");
  });

  it("指示剂不参与定量", () => {
    const p = reagentSpec("phenolphthalein", "indicator");
    expect(p.phase).toBe("indicator");
    expect(amountOf(p, 2)).toBeNull();
  });
});

describe("amountOf", () => {
  it("溶液按 c·V（注意 mL→L）", () => {
    // 25.00 mL 0.1 mol/L 一档在滴定里最常见
    const s = reagentSpec("NaOH", "base");
    expect(amountOf({ ...s, concentration: 0.1 }, 25)).toBeCloseTo(0.0025, 6);
  });

  it("固体按 m/M", () => {
    // 2.0 g CaCO3 ÷ 100.087 ≈ 0.01998 mol
    expect(amountOf(reagentSpec("CaCO3", "carbonate"), 2)).toBeCloseTo(0.01998, 5);
  });

  it("纯液体按 ρV/M", () => {
    // 10 mL 乙醇：0.789×10÷46.069 ≈ 0.1713 mol
    expect(amountOf(reagentSpec("C2H5OH", "organic"), 10)).toBeCloseTo(0.1713, 4);
  });
});

describe("全库覆盖", () => {
  // 回归闸门：501 个实验里出现的每一个试剂名，都要能拿到可用的规格。
  // 「可用」= 定量类（溶液/液体/固体）必须能算出物质的量，否则界面上的用量框
  // 会显示 NaN；指示剂/气体明确不定量，是合法的 null。
  it("所有实验用到的试剂都能算出物质的量或明确不定量", () => {
    const bad: string[] = [];
    for (const exp of allExperiments) {
      for (const label of exp.reagents) {
        const sub = resolveSubstance(label);
        const spec = reagentSpec(sub.formula, sub.category);
        const n = amountOf(spec, spec.defaultDose);
        if (
          spec.phase === "indicator" ||
          spec.phase === "gas" ||
          spec.phase === "bulk"
        ) {
          continue;
        }
        if (n === null || !Number.isFinite(n) || n <= 0) {
          bad.push(`${label}(${sub.formula}/${spec.phase})`);
        }
      }
    }
    expect([...new Set(bad)]).toEqual([]);
  });
});
