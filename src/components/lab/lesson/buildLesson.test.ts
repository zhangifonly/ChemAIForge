// 讲解生成器数据驱动测试：保证 102 个实验都能派生出结构合理的分步讲解。
import { describe, it, expect } from "vitest";
import { allExperiments } from "@/data/experiments";
import { resolveSubstance } from "../reagents";
import {
  isElectrolysisSetup,
  isGalvanicSetup,
  usesConductivity,
} from "../vesselGeom";
import { buildLesson } from "./buildLesson";

describe("buildLesson 为每个实验生成合理讲解", () => {
  it.each(allExperiments.map((e) => [e.slug, e] as const))(
    "%s",
    (_slug, exp) => {
      const steps = buildLesson(exp);
      const electrochem =
        isElectrolysisSetup(exp.apparatus) ||
        isGalvanicSetup(exp.apparatus) ||
        usesConductivity(exp.apparatus);

      // 至少包含 原理 + 准备 + 操作 + 现象 四步
      expect(steps.length).toBeGreaterThanOrEqual(4);

      // 首步为原理且清空容器
      expect(steps[0].phase).toBe("原理");
      expect(steps[0].action).toEqual({ kind: "reset" });

      // 必有一个操作阶段步骤
      expect(steps.some((s) => s.phase === "操作")).toBe(true);

      // 混合类实验恰有一个混合步骤；电化学实验无混合步骤
      const mixSteps = steps.filter((s) => s.action?.kind === "mix");
      expect(mixSteps).toHaveLength(electrochem ? 0 : 1);

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
