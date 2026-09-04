// 「声明变色」与「液色真的变了」的一致性测试。
//
// 引擎里的通用规则常返回占位化学式（`Zn-salt`、`salt`），占位符查不到色表，
// productTint 便回退到「按反应物阳离子反推」—— 取的是**反应物**的颜色，
// 于是反应前后液色一模一样：31 个金属置换实验全都声明了 colorChange: true，
// 3D 里却一动不动，而「蓝色褪成浅绿」正是这类实验唯一的观察点。
//
// 无色产物也必须显式登记为澄清色，不能靠「查不到」来表示无色 ——
// 返回 null 同样让 3D 保持原色。这个测试把两种情形一起钉在 CI 上。
import { describe, expect, it } from "vitest";
import { allExperiments } from "@/data/experiments";
import { resolveSubstance } from "@/components/lab/reagents";
import { react } from "@/lib/chem/engine";
import { resolveProductTint } from "@/lib/chem/productTint";
import { SOLUTION_TINT } from "@/lib/chem/appearance";

/** 反应前容器里的液色：取第一个有特征色的溶质，与 mixedTint 口径一致 */
function beforeTint(subs: ReturnType<typeof resolveSubstance>[]) {
  for (const s of subs) {
    const t = SOLUTION_TINT[s.formula];
    if (t) return t;
  }
  return null;
}

function sameTint(
  a: ReturnType<typeof beforeTint>,
  b: ReturnType<typeof beforeTint>,
) {
  if (!a || !b) return false;
  return a.top === b.top && a.bottom === b.bottom;
}

describe("变色声明与液色一致性", () => {
  // 只查「液色是唯一可见变化」的情形。以下三类不在范围内，它们的看点在别处：
  //   1. 产沉淀或产气 —— 变化由浑浊/气泡承载，液色不变属正常
  //   2. 产物里含反应物本身（平衡体系）—— 看点是随温度/浓度往复变色，静态比对无意义
  //   3. 相转移与分层（萃取）—— 看点是碘从水层进入有机层，靠 phase 而非液色表现
  it("声明 colorChange 且反应物有色时，产物液色必须与反应前不同", () => {
    const bad: string[] = [];
    for (const exp of allExperiments) {
      if (!exp.probe?.expect.colorChange) continue;
      const subs = exp.probe.reagentKeys.map(resolveSubstance);
      const r = react(subs);
      if (!r.reacted || !r.colorChange) continue;
      if (r.producesPrecipitate || r.producesGas) continue;
      // 平衡体系：产物列表里出现了反应物，说明这是可逆平衡而非净转化
      const inputF = new Set(subs.map((s) => s.formula));
      if (r.products.some((p) => inputF.has(p.formula))) continue;
      // 萃取：产物只剩有机溶剂，可见变化是分层与相转移
      if (r.products.every((p) => p.category === "organic")) continue;
      const before = beforeTint(subs);
      if (!before) continue; // 反应物无色，反应后上色属正常，跳过
      const after = resolveProductTint(r.products, subs);
      if (after === null || sameTint(before, after)) {
        bad.push(`${exp.slug}: ${exp.probe.reagentKeys.join("+")} 液色未变`);
      }
    }
    expect(bad).toEqual([]);
  });
});

// 指示剂只把酸碱性可视化，它不参与反应，也不该把反应本身盖掉。
//
// indicator-acid-base 的判据只是「指示剂 + 酸或碱」，几乎任何含酸碱的体系都满足，
// 因此它必须是全引擎最后一条。它曾排在 extendedReactions 末尾看似"最后"，
// 实则后面还有 metalAcid / acidBaseNeutralization 两条基础兜底 —— 于是
// 36 个实验被判成纯变色：中和不放热了、制氨气/制氯气/制 SO₂ 都不产气了，
// 加指示剂本是为了观察反应，反而把反应观察没了。
describe("指示剂不遮蔽真实反应", () => {
  const S = (...names: string[]) => names.map(resolveSubstance);

  it("加指示剂后反应本身完全不变，只是额外标记变色", () => {
    const cases: Array<[string[], string[]]> = [
      [["盐酸", "氢氧化钠"], ["酚酞"]], // 中和：必须仍然放热、趋于中性
      [["锌", "盐酸"], ["石蕊"]], // 金属置换：必须仍然产氢气
      [["二氧化锰", "浓盐酸"], ["石蕊"]], // 制氯气：必须仍然产气
    ];
    for (const [base, indicator] of cases) {
      const plain = react(S(...base), { temperature: 80 });
      const withInd = react(S(...base, ...indicator), { temperature: 80 });
      const label = base.join("+");
      expect(withInd.equation, label).toBe(plain.equation);
      expect(withInd.producesGas, label).toBe(plain.producesGas);
      expect(withInd.thermal, label).toBe(plain.thermal);
      expect(withInd.phTrend, label).toBe(plain.phTrend);
      // 指示剂的作用只体现在这一项上
      expect(withInd.colorChange, label).toBe(true);
    }
  });

  it("确实没有别的反应时，指示剂变色才作为唯一现象报出", () => {
    const r = react(S("盐酸", "酚酞"));
    expect(r.reacted).toBe(true);
    expect(r.equation).toBe("指示剂 + 酸/碱 → 变色");
  });
});
