import { describe, expect, it } from "vitest";
import { allExperiments } from "@/data/experiments";
import { availableOperations, type OperationId } from "./operations";

const ids = (apparatus: string[]): OperationId[] =>
  availableOperations(apparatus).map((o) => o.id);

describe("按仪器派生可用操作", () => {
  it("玻璃棒给出搅拌", () => {
    expect(ids(["烧杯", "玻璃棒"])).toContain("stir");
  });

  it("试管给出振荡而非搅拌（试管里不搅拌）", () => {
    const r = ids(["试管", "试管架"]);
    expect(r).toContain("shake");
    expect(r).not.toContain("stir");
  });

  it("酒精灯同时给出加热与冷却", () => {
    const r = ids(["试管", "酒精灯"]);
    expect(r).toContain("heat");
    expect(r).toContain("cool");
  });

  it("没有加热手段就不给冷却", () => {
    expect(ids(["点滴板", "胶头滴管"])).not.toContain("cool");
  });

  it("静置与读数不依赖仪器，任何配置下都可用", () => {
    expect(ids([])).toEqual(["settle", "read"]);
  });

  it("操作顺序与真实操作先后一致", () => {
    expect(ids(["烧杯", "玻璃棒", "酒精灯", "温度计", "漏斗"])).toEqual([
      "stir",
      "heat",
      "cool",
      "settle",
      "read",
    ]);
  });
});

describe("加热步长按热源区分", () => {
  const deltaOf = (apparatus: string[]) =>
    availableOperations(apparatus).find((o) => o.id === "heat")?.deltaT;

  it("水浴升温比明火慢（受水温限制、受热均匀）", () => {
    expect(deltaOf(["水浴", "试管"])).toBeLessThan(deltaOf(["酒精灯", "试管"])!);
  });

  it("坩埚灼烧升温最快", () => {
    expect(deltaOf(["坩埚", "坩埚钳"])).toBeGreaterThan(
      deltaOf(["酒精灯", "试管"])!,
    );
  });

  it("冷却是加热的反向且幅度相同", () => {
    const ops = availableOperations(["酒精灯", "烧杯"]);
    const h = ops.find((o) => o.id === "heat")!;
    const c = ops.find((o) => o.id === "cool")!;
    expect(c.deltaT).toBe(-h.deltaT);
  });
});

describe("全库覆盖", () => {
  it("每个实验至少有两个可用操作（否则操作面板仍是空架子）", () => {
    const thin: string[] = [];
    for (const exp of allExperiments) {
      if (availableOperations(exp.apparatus).length < 2) thin.push(exp.slug);
    }
    expect(thin).toEqual([]);
  });

  it("操作描述与提示都非空（要进实验记录与报告）", () => {
    const bad: string[] = [];
    for (const exp of allExperiments) {
      for (const op of availableOperations(exp.apparatus)) {
        if (!op.effect || !op.hint || !op.glyph) bad.push(`${exp.slug}/${op.id}`);
      }
    }
    expect(bad).toEqual([]);
  });
});
