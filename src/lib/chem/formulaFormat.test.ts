// 产物化学式的书写格式闸门。
//
// 产物 formula 不是给人读的文本，而是**查表的键**：PRECIPITATE_COLOR、
// SOLUTION_TINT、GAS_COLOR 都按它索引，下游规则也可能再拿它去匹配。
// 全角下标 `CaCO₃` 与色表里的 `CaCO3` 是两个不同的字符串，颜色便静默回退默认值 ——
// 碳酸钙碰巧是白色所以长期没暴露，`Ca(OH)₂` 则让钙与水反应的产物查不到任何表。
//
// 阅读用的全角写法属于 equation / description，不在此列。
import { describe, expect, it } from "vitest";
import { allExperiments } from "@/data/experiments";
import { resolveSubstance } from "@/components/lab/reagents";
import { react } from "@/lib/chem/engine";

/** 刻意保留的占位符：带「盐」字表示"某种盐"，由 productTint 按反应物反推 */
const PLACEHOLDER_SUFFIX = /盐$/;

describe("产物化学式格式", () => {
  it("产物 formula 不得使用全角上下标（占位符除外）", () => {
    const bad = new Set<string>();
    for (const exp of allExperiments) {
      if (!exp.probe) continue;
      const r = react(exp.probe.reagentKeys.map(resolveSubstance));
      if (!r.reacted) continue;
      for (const p of r.products) {
        if (PLACEHOLDER_SUFFIX.test(p.formula)) continue;
        if (/[₀-₉⁰-⁹]/.test(p.formula)) bad.add(`${p.formula} ← ${exp.slug}`);
      }
    }
    expect([...bad]).toEqual([]);
  });
});
