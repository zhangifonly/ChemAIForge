// 焰色实验的可见性闸门。
//
// 焰色反应的全部看点就是那一簇颜色，而实验里除金属盐外总还有别的试剂：
// 盐酸（洗铂丝是标准操作）、蒸馏水。取「首个投入的试剂」当样品时，
// 学生先点盐酸就永远看到酒精灯蓝色本色 —— 现象没错，是取样错了。
// 这层锁住两件事：金属盐一定能挑出对应焰色，无焰色试剂一定挡不住它。
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { allExperiments } from "@/data/experiments";
import { resolveSubstance } from "@/components/lab/reagents";
import { usesFlameTest } from "@/components/lab/vesselGeom";
import { pickFlameSample } from "@/lib/chem/scenePlan";
import { DEFAULT_FLAME, flameColor } from "@/lib/chem/flameColor";
import type { Substance } from "@/lib/chem/engine";

/** 焰色实验及其试剂（解析后） */
const flameExps = allExperiments
  .filter((e) => usesFlameTest(e.apparatus))
  .map((e) => ({ slug: e.slug, subs: e.reagents.map((r) => resolveSubstance(r)) }));

/** 该试剂单独投入时能否显出焰色 */
const showsFlame = (s: Substance) =>
  flameColor(pickFlameSample([s]) ?? undefined).label !== DEFAULT_FLAME.label;

describe("焰色实验取样", () => {
  it("实验库里确有焰色实验（防止筛选条件失效让整组测试空跑）", () => {
    expect(flameExps.length).toBeGreaterThan(0);
  });

  it("每个焰色实验都至少含一味能显焰色的试剂", () => {
    for (const { slug, subs } of flameExps) {
      expect(subs.some(showsFlame), slug).toBe(true);
    }
  });

  it("无焰色试剂排在前面也挡不住金属盐（这正是 contents[0] 的错处）", () => {
    for (const { slug, subs } of flameExps) {
      const metal = subs.find(showsFlame)!;
      const others = subs.filter((s) => s !== metal);
      // 把所有无焰色试剂排到金属盐之前，模拟学生先点盐酸/蒸馏水
      const picked = pickFlameSample([...others, metal]);
      expect(flameColor(picked ?? undefined).label, `${slug} 应显 ${metal.name} 的焰色`).not.toBe(
        DEFAULT_FLAME.label,
      );
    }
  });

  it("空容器无样品，显酒精灯本色", () => {
    expect(pickFlameSample([])).toBeNull();
    expect(flameColor(undefined).label).toBe(DEFAULT_FLAME.label);
  });

  // 光测 pickFlameSample 抓不到这个 bug：错的是组件调它之前那行「取 contents[0]」。
  // 断言 2D 与 3D 走同一个取样函数，是这里能对源码施加的最直接约束。
  it("2D 画布用 pickFlameSample 取样，而不是自取 contents[0]", () => {
    const src = readFileSync(
      new URL("../../components/lab/LabCanvas.tsx", import.meta.url),
      "utf8",
    );
    expect(src).toContain("pickFlameSample(contents)");
    expect(src).not.toMatch(/flameSample\s*=\s*contents\[0\]/);
  });
});
