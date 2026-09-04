// 试剂解析层测试
//
// 核心不变量：命中的关键词最长者优先。这条语义存在的唯一理由是防子串遮蔽 ——
// 试剂表有 150+ 条，短词只要排在前面就会吞掉包含它的长词，而"化学名越具体越长"
// 恰好让"取最长"天然正确。下面的用例是曾经真实发生过的三次误判，
// 用它们锁住语义，防止有人把实现改回"按数组顺序取首个命中"。
import { describe, expect, it } from "vitest";
import { resolveSubstance } from "./reagents";
import { REAGENT_RULES } from "./reagentRules";

describe("试剂解析 - 子串遮蔽", () => {
  it.each([
    ["小苏打", "NaHCO3", "苏打(Na2CO3) 在前，不得吞掉小苏打"],
    ["苏打", "Na2CO3", "短词自身仍解析正确"],
    ["重铬酸钾", "K2Cr2O7", "铬酸钾(K2CrO4) 在前，差一个氧氧化性完全不同"],
    ["铬酸钾", "K2CrO4", ""],
    ["磁性氧化铁", "Fe3O4", "氧化铁(Fe2O3) 在前"],
    ["氧化铁", "Fe2O3", ""],
    ["硫化银", "Ag2S", "裸「银」在后，银器除黑靠这条"],
    ["三氯化铁", "FeCl3", "同义长词与短词化学式一致，任选皆可"],
  ])("%s → %s", (label, formula) => {
    expect(resolveSubstance(label).formula).toBe(formula);
  });

  it("解析结果保留原始标签作为名称", () => {
    const s = resolveSubstance("饱和碳酸钠溶液");
    expect(s.name).toBe("饱和碳酸钠溶液");
    expect(s.formula).toBe("Na2CO3");
  });

  it("无法识别的试剂归为 other 且化学式回落为标签", () => {
    const s = resolveSubstance("某种未登记试剂");
    expect(s.category).toBe("other");
    expect(s.formula).toBe("某种未登记试剂");
  });
});

describe("试剂表 - 数据自洽", () => {
  it("同一关键词不重复登记在多条规则中", () => {
    const seen = new Map<string, string>();
    const dup: string[] = [];
    for (const rule of REAGENT_RULES) {
      for (const kw of rule.keywords) {
        const prev = seen.get(kw);
        if (prev && prev !== rule.formula) {
          dup.push(`${kw}: ${prev} vs ${rule.formula}`);
        }
        seen.set(kw, rule.formula);
      }
    }
    expect(dup).toEqual([]);
  });

  it("每条规则都有关键词与化学式", () => {
    for (const rule of REAGENT_RULES) {
      expect(rule.keywords.length).toBeGreaterThan(0);
      expect(rule.formula.length).toBeGreaterThan(0);
    }
  });
});
