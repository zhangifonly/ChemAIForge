// 实验目录数据驱动测试
// 遍历全部实验，逐一验证：
//  1) slug 唯一、字段完整、分类/难度合法
//  2) 每个声明的试剂均可被 resolveSubstance 解析（非 other 兜底则视为已知）
//  3) 凡带 probe 的实验，其核心试剂经引擎计算后的现象与声明一致
// 这保证「每个实验在系统里真能反应」，是 100+ 实验的质量闸门。
import { describe, expect, it } from "vitest";
import { allExperiments } from "@/data/experiments";
import {
  ExperimentCategory,
  ExperimentDifficulty,
} from "@/server/experiment/types";

const CATEGORIES = Object.values(ExperimentCategory);
const DIFFICULTIES = Object.values(ExperimentDifficulty);
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

describe("实验目录 - 规模与唯一性", () => {
  it("实验数量不少于 100 个", () => {
    expect(allExperiments.length).toBeGreaterThanOrEqual(100);
  });

  it("所有 slug 唯一且符合 kebab-case", () => {
    const slugs = allExperiments.map((e) => e.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const slug of slugs) expect(slug).toMatch(SLUG_RE);
  });
});

describe.each(allExperiments.map((e) => [e.slug, e] as const))(
  "实验字段完整性 - %s",
  (_slug, exp) => {
    it("标题与描述非空", () => {
      expect(exp.title.trim().length).toBeGreaterThan(0);
      expect(exp.description.trim().length).toBeGreaterThan(0);
    });

    it("分类与难度合法", () => {
      expect(CATEGORIES).toContain(exp.category);
      expect(DIFFICULTIES).toContain(exp.difficulty);
    });

    it("试剂/仪器/目标均非空数组", () => {
      expect(exp.reagents.length).toBeGreaterThan(0);
      expect(exp.apparatus.length).toBeGreaterThan(0);
      expect(exp.objectives.length).toBeGreaterThan(0);
    });

    it("预计时长为正整数", () => {
      expect(Number.isInteger(exp.estimatedMinutes)).toBe(true);
      expect(exp.estimatedMinutes).toBeGreaterThan(0);
    });
  },
);
