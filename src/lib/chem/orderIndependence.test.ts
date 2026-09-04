// 投料顺序无关性测试。
//
// 反应是否发生只取决于体系里有什么，与试剂加入的先后无关。引擎里多条规则用
// 「遍历 inputs 取第一个命中者」的写法，一旦某物质同时出现在两张表里（如 Ca(OH)₂
// 既是阳离子源又是 OH⁻ 源），就会自己占掉一个角色导致配对失败——表现为「氯化镁 +
// 石灰乳」能沉镁、颠倒顺序却不反应。这个测试对全部实验的 probe 做正反序比对，
// 把这类顺序依赖钉死在 CI 上。
import { describe, expect, it } from "vitest";
import { allExperiments } from "@/data/experiments";
import { resolveSubstance } from "@/components/lab/reagents";
import { react } from "@/lib/chem/engine";

/** 取反应结果里与「现象」有关的字段，忽略方程式文字差异 */
function phenomena(subs: ReturnType<typeof resolveSubstance>[]) {
  const r = react(subs);
  return {
    reacted: r.reacted,
    gas: r.producesGas,
    precipitate: r.producesPrecipitate,
    colorChange: r.colorChange,
    thermal: r.thermal,
  };
}

describe("投料顺序无关性", () => {
  it("每个实验的 probe 试剂正序与逆序得到相同现象", () => {
    const offenders: string[] = [];
    for (const e of allExperiments) {
      if (!e.probe || e.probe.reagentKeys.length < 2) continue;
      const subs = e.probe.reagentKeys.map(resolveSubstance);
      const fwd = phenomena(subs);
      const rev = phenomena([...subs].reverse());
      if (JSON.stringify(fwd) !== JSON.stringify(rev)) {
        offenders.push(
          `${e.slug}: 正序 ${JSON.stringify(fwd)} vs 逆序 ${JSON.stringify(rev)}`,
        );
      }
    }
    expect(offenders).toEqual([]);
  });

  it("石灰乳沉镁不依赖投料顺序（回归：Ca(OH)₂ 自占阳离子源）", () => {
    const mg = resolveSubstance("氯化镁");
    const lime = resolveSubstance("氢氧化钙");
    expect(react([mg, lime]).producesPrecipitate).toBe(true);
    expect(react([lime, mg]).producesPrecipitate).toBe(true);
  });
});
