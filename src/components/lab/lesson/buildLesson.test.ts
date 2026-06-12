// 讲解生成器数据驱动测试：保证 102 个实验都能派生出结构合理的分步讲解。
import { describe, it, expect } from "vitest";
import { allExperiments } from "@/data/experiments";
import { resolveSubstance } from "../reagents";
import { buildLesson } from "./buildLesson";

describe("buildLesson 为每个实验生成合理讲解", () => {
  it.each(allExperiments.map((e) => [e.slug, e] as const))(
    "%s",
    (_slug, exp) => {
      const steps = buildLesson(exp);

      // 至少包含 原理 + 一种试剂 + 操作 + 现象 四步
      expect(steps.length).toBeGreaterThanOrEqual(4);

      // 首步为原理且清空容器
      expect(steps[0].phase).toBe("原理");
      expect(steps[0].action).toEqual({ kind: "reset" });

      // 恰有一个混合步骤
      const mixSteps = steps.filter((s) => s.action?.kind === "mix");
      expect(mixSteps).toHaveLength(1);

      // 每个取用步骤的试剂都能被解析为具体物质
      for (const s of steps) {
        if (s.action?.kind === "add") {
          expect(s.action.reagent.length).toBeGreaterThan(0);
          expect(resolveSubstance(s.action.reagent).formula.length).toBeGreaterThan(0);
        }
        // 每步都有口播文字
        expect(s.narration.length).toBeGreaterThan(0);
      }
    },
  );
});
