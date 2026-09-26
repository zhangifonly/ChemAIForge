import { describe, expect, it } from "vitest";

import { allExperiments } from "@/data/experiments";

import { availableOperations } from "./operations";
import { hasHeatSource } from "./vesselGeom";

describe("外部热源判定", () => {
  it("配了酒精灯 / 水浴 / 坩埚的实验有热源", () => {
    expect(hasHeatSource(["酒精灯", "试管"])).toBe(true);
    expect(hasHeatSource(["水浴装置", "烧杯"])).toBe(true);
    expect(hasHeatSource(["坩埚", "泥三角"])).toBe(true);
  });

  it("中和热测定没有热源：它要求绝热，不该画出酒精灯", () => {
    expect(
      hasHeatSource(["量热计", "温度计", "量筒", "环形玻璃搅拌棒"]),
    ).toBe(false);
  });

  it("空仪器清单没有热源", () => {
    expect(hasHeatSource([])).toBe(false);
  });

  it("与操作栏的 heat 判定完全一致，两处不会一边给加热按钮一边不画火焰", () => {
    for (const exp of allExperiments) {
      const canHeat = availableOperations(exp.apparatus).some(
        (op) => op.id === "heat",
      );
      expect(
        hasHeatSource(exp.apparatus),
        `${exp.slug} 的热源判定与加热操作不一致`,
      ).toBe(canHeat);
    }
  });
});
