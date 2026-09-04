// probe 覆盖率守卫。
//
// 背景：probe.test.ts 原先只断言「过半实验声明了 probe」，实验数从 102 涨到 500
// 的过程中这个门槛一直没跟上，导致 91 个实验的反应正确性从未被验证过就通过了 CI。
// 这里改成「除显式豁免外，每个实验都必须有 probe」——豁免逐个列举并写明理由，
// 新增实验若忘了写 probe 会直接失败，而不是被平均值淹没。
import { describe, expect, it } from "vitest";
import { allExperiments } from "@/data/experiments";
import { PROBE_EXEMPT } from "./probeExempt";
import { planRig } from "@/lib/chem/scenePlan";

describe("probe 覆盖率", () => {
  it("除豁免清单外，每个实验都声明了可验证的反应探针", () => {
    const missing = allExperiments
      .filter((e) => !e.probe && !PROBE_EXEMPT.has(e.slug))
      .map((e) => `${e.slug} (${e.category})`);
    expect(missing).toEqual([]);
  });

  it("豁免清单不含已经写了 probe 的实验（清理过期豁免）", () => {
    const stale = allExperiments
      .filter((e) => e.probe && PROBE_EXEMPT.has(e.slug))
      .map((e) => e.slug);
    expect(stale).toEqual([]);
  });

  it("豁免清单里的 slug 都真实存在（防拼写错误长期失效）", () => {
    const slugs = new Set(allExperiments.map((e) => e.slug));
    const ghosts = [...PROBE_EXEMPT].filter((s) => !slugs.has(s));
    expect(ghosts).toEqual([]);
  });

  it("被豁免的实验必须真有装置层看点，否则 3D 台上什么都不会发生", () => {
    const byslug = new Map(allExperiments.map((e) => [e.slug, e]));
    const empty: string[] = [];
    for (const slug of PROBE_EXEMPT) {
      const exp = byslug.get(slug);
      if (!exp) continue;
      if (planRig(exp.apparatus).kind === "none") empty.push(slug);
    }
    expect(empty).toEqual([]);
  });
});
