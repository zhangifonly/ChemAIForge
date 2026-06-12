// 电解引擎测试：依据离子放电顺序校验阴/阳极产物（经典考点）。
import { describe, it, expect } from "vitest";
import { electrolyze } from "./electrolysis";

describe("electrolyze 放电顺序", () => {
  it("电解 CuCl2（惰性电极）：阴极铜、阳极氯气", () => {
    const r = electrolyze("CuCl2")!;
    expect(r.cathode.product).toBe("Cu");
    expect(r.cathode.kind).toBe("metal");
    expect(r.anode.product).toBe("Cl2");
    expect(r.colorFades).toBe(true);
  });

  it("电解 CuSO4（惰性电极）：阴极铜、阳极氧气（含氧酸根不放电）", () => {
    const r = electrolyze("CuSO4")!;
    expect(r.cathode.product).toBe("Cu");
    expect(r.anode.product).toBe("O2");
  });

  it("电解 NaCl 溶液：阴极氢气（Na+ 不放电）、阳极氯气", () => {
    const r = electrolyze("NaCl")!;
    expect(r.cathode.product).toBe("H2");
    expect(r.anode.product).toBe("Cl2");
    expect(r.colorFades).toBe(false);
  });

  it("电解 Na2SO4 溶液 ≈ 电解水：阴极氢气、阳极氧气", () => {
    const r = electrolyze("Na2SO4")!;
    expect(r.cathode.product).toBe("H2");
    expect(r.anode.product).toBe("O2");
  });

  it("活性铜阳极（电镀 / 精炼）：阳极溶解", () => {
    const r = electrolyze("CuSO4", { inertAnode: false })!;
    expect(r.cathode.product).toBe("Cu");
    expect(r.anode.kind).toBe("dissolve");
  });

  it("电解 AgNO3：阴极析银、阳极氧气", () => {
    const r = electrolyze("AgNO3")!;
    expect(r.cathode.product).toBe("Ag");
    expect(r.anode.product).toBe("O2");
  });

  it("未知电解质返回 null", () => {
    expect(electrolyze("NaNO3X")).toBeNull();
  });
});
