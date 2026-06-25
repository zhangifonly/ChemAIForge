// 数据一致性测试：probe 声明的核心反应试剂必须真实存在于该实验的 reagents 列表，
// 防止"probe 用列表外试剂"导致用户拖入实际试剂却无现象（如 fe2-fe3-conversion 旧问题）。
import { describe, it, expect } from "vitest";
import { allExperiments } from "@/data/experiments";
import { resolveSubstance } from "@/components/lab/reagents";

describe("实验数据一致性", () => {
  it("每个 probe 的 reagentKeys 都能由该实验的 reagents 覆盖（化学式一致）", () => {
    const offenders: string[] = [];
    for (const e of allExperiments) {
      if (!e.probe) continue;
      const reagentForms = new Set(
        e.reagents.map((r) => resolveSubstance(r).formula),
      );
      for (const key of e.probe.reagentKeys) {
        if (!reagentForms.has(resolveSubstance(key).formula)) {
          offenders.push(`${e.slug}: probe "${key}" 不在 reagents`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it("每个实验都有标题、描述、目标与正向时长", () => {
    for (const e of allExperiments) {
      expect(e.title.length).toBeGreaterThan(0);
      expect(e.description.length).toBeGreaterThanOrEqual(10);
      expect(e.objectives.length).toBeGreaterThan(0);
      expect(e.estimatedMinutes).toBeGreaterThan(0);
    }
  });
});
