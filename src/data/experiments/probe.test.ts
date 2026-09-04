// 实验反应探针测试
// 对每个带 probe 的实验：把 reagentKeys 解析为 Substance 送入反应引擎，
// 断言引擎产出的现象与 probe.expect 声明一致。
// 这是「实验真能反应」的核心校验 —— 引擎是事实来源，probe 是该实验的契约。
import { describe, expect, it } from "vitest";
import { allExperiments } from "@/data/experiments";
import { resolveSubstance } from "@/components/lab/reagents";
import { react } from "@/lib/chem/engine";
import { probeConditions } from "./probeInput";

const withProbe = allExperiments.filter((e) => e.probe);

describe("实验反应探针 - 覆盖率", () => {
  it("过半实验声明了可验证的核心反应探针", () => {
    expect(withProbe.length).toBeGreaterThanOrEqual(
      Math.floor(allExperiments.length / 2),
    );
  });
});

describe.each(withProbe.map((e) => [e.slug, e] as const))(
  "反应探针 - %s",
  (_slug, exp) => {
    const probe = exp.probe!;

    it("核心试剂均可被试剂库解析（非 other 兜底）", () => {
      for (const key of probe.reagentKeys) {
        const sub = resolveSubstance(key);
        // 解析命中具体物质时 formula 会不同于原始标签或类别非 other
        expect(sub.category !== "other" || sub.formula !== key).toBe(true);
      }
    });

    // probe 必须验的是用户在界面上真能拖出来的那瓶试剂。写简称（"硫酸"）而
    // reagents 里是"浓硫酸"时，两者解析成同一化学式，测试照样通过 —— 但一旦
    // 将来把浓硫酸与稀硫酸按脱水性/强氧化性区分开，probe 就静默验错了对象。
    it("探针试剂名与 reagents 列表逐字一致", () => {
      for (const key of probe.reagentKeys) {
        expect(exp.reagents, key).toContain(key);
      }
    });

    it("引擎计算现象与探针声明一致", () => {
      const inputs = probe.reagentKeys.map(resolveSubstance);
      const r = react(inputs, probeConditions(exp));
      const e = probe.expect;

      expect(r.reacted).toBe(e.reacted);
      if (e.gas !== undefined) expect(r.producesGas).toBe(e.gas);
      if (e.precipitate !== undefined)
        expect(r.producesPrecipitate).toBe(e.precipitate);
      if (e.colorChange !== undefined)
        expect(r.colorChange).toBe(e.colorChange);
      if (e.thermal !== undefined) expect(r.thermal).toBe(e.thermal);
    });

    // heated 与规则的 requiresHeat 必须对齐：只标了 probe.heated 而规则没标，
    // 常温下照样反应，加热这一步在教学上就白设了；反之则实验永远做不出来。
    it("加热声明与引擎条件判定一致", () => {
      const cold = react(probe.reagentKeys.map(resolveSubstance));
      if (probe.heated) {
        expect(cold.pendingCondition).toBe("heat");
      } else {
        expect(cold.pendingCondition).toBeUndefined();
      }
    });
  },
);
