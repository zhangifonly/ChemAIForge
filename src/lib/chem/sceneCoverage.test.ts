// 3D 可见性闸门：每个实验在 3D 里都必须至少有一个可见变化。
//
// 这一层拦的是「声明了现象但 3D 画不出来」的静默失效，实际抓到过四类：
//   1. 配合物整体式漏登记色表 —— 氢氧化铜溶于氨水，深蓝是唯一看点却毫无变化
//   2. acidBaseEnv 只看投料 category —— 碳酸钠水解显碱性判不出，酚酞不变红
//   3. planRig 缺「电流计 / 导线」关键词 —— 四个原电池实验连装置都没有
//   4. pickGas 只认 category === "gas" —— CO₂ 标成 oxide，六个燃烧实验不冒泡
// 共同点是引擎判定完全正确，丢失都发生在「化学结论 → 视觉要素」这一步。
import { describe, expect, it } from "vitest";
import { allExperiments } from "@/data/experiments";
import { resolveSubstance } from "@/components/lab/reagents";
import { HEAT_THRESHOLD, react } from "@/lib/chem/engine";
import { probeConditions } from "@/data/experiments/probeInput";
import { inferGasFormula, pickGas, pickPrecipitate, planScene } from "@/lib/chem/scenePlan";
import { PRECIPITATE_COLOR, mixedTint } from "@/lib/chem/appearance";

/** 该实验在 3D 里是否有任何可见要素 */
function hasVisual(exp: (typeof allExperiments)[number]): boolean {
  const subs = exp.probe!.reagentKeys.map(resolveSubstance);
  // 需要加热的实验按加热条件驱动，否则引擎不给结果，3D 自然什么也画不出
  const heated = Boolean(exp.probe!.heated);
  const r = react(subs, probeConditions(exp));
  const p = planScene({
    contents: subs,
    result: r,
    apparatus: exp.apparatus,
    heated,
    temperature: heated ? HEAT_THRESHOLD + 20 : 25,
  });
  // mixedTint 收化学式数组，且无色时返回 CLEAR_TINT 而非 null
  const before = mixedTint(subs.map((s) => s.formula));
  const colorMoved =
    !!p.liquid && (p.liquid.top !== before.top || p.liquid.bottom !== before.bottom);
  return Boolean(
    colorMoved ||
      p.bubbles ||
      p.precipitate ||
      p.flame ||
      p.heating ||
      p.phase ||
      p.turbid ||
      p.crystal ||
      p.tempShift ||
      p.solid?.dissolving ||
      p.rig.kind !== "none",
  );
}

describe("3D 场景可见性", () => {
  it("每个带 probe 的实验都至少有一个可见变化", () => {
    const blind = allExperiments
      .filter((e) => e.probe)
      .filter((e) => !hasVisual(e))
      .map((e) => `${e.slug} [${e.category}] ${e.probe!.reagentKeys.join("+")}`);
    expect(blind).toEqual([]);
  });
});

describe("沉淀与气体的色表覆盖", () => {
  // 沉淀色表查不到时 precipitateColor 回退白色 #f5f7f9。对白色沉淀无妨，
  // 但黑色 Ag₂S、亮黄 PbCrO₄、粉红 Co(OH)₂、绿 Ni(OH)₂ 全被画成白色 ——
  // 而颜色恰恰是这些沉淀的鉴定依据，3D 里看到白色，结论就反了
  it("声明产沉淀时，沉淀物必须取得到且已登记颜色", () => {
    const bad: string[] = [];
    for (const exp of allExperiments) {
      if (!exp.probe) continue;
      const subs = exp.probe.reagentKeys.map(resolveSubstance);
      const r = react(subs, probeConditions(exp));
      if (!r.reacted || !r.producesPrecipitate) continue;
      // 与 planScene 同一口径：规则显式指定的沉淀物优先
      const f = r.precipitateFormula ?? pickPrecipitate(r.products);
      if (!f) bad.push(`${exp.slug}: 声明产沉淀但取不到沉淀物`);
      else if (!(f in PRECIPITATE_COLOR)) bad.push(`${exp.slug}: 沉淀 ${f} 未登记颜色`);
    }
    expect(bad).toEqual([]);
  });

  it("声明产气时，气体必须取得到", () => {
    const bad: string[] = [];
    for (const exp of allExperiments) {
      if (!exp.probe) continue;
      const subs = exp.probe.reagentKeys.map(resolveSubstance);
      const r = react(subs, probeConditions(exp));
      if (!r.reacted || !r.producesGas) continue;
      if (!pickGas(r.products) && !inferGasFormula(subs)) {
        bad.push(`${exp.slug}: 声明产气但取不到气体`);
      }
    }
    expect(bad).toEqual([]);
  });
});

// Lab3DCanvas 的按钮布局：自带热源的装置（HEATING_RIGS）隐藏独立的酒精灯按钮，
// 由装置开关一并管温度；其余装置显示酒精灯按钮。两条路径都必须能把温度带到阈值。
const HEATING_RIGS = new Set(["water-bath", "flame-test", "evaporation", "distillation"]);

describe("加热入口可达性", () => {
  // 曾出现过：11 个水浴实验的酒精灯按钮被隐藏，而"开始水浴加热"只改 3D 不改温度 ——
  // 引擎在常温下不给结果，于是这些实验在界面上完全做不出来，且毫无提示
  it("需加热的实验都存在把温度带到阈值的界面入口", () => {
    const bad: string[] = [];
    for (const exp of allExperiments) {
      if (!exp.probe?.heated) continue;
      const subs = exp.probe.reagentKeys.map(resolveSubstance);
      const kind = planScene({ contents: subs, result: react(subs), apparatus: exp.apparatus })
        .rig.kind;
      // 电化学实验两个按钮都不出，无法加热
      const ELECTRO_ONLY = kind === "electrolysis" || kind === "cell";
      if (ELECTRO_ONLY) bad.push(`${exp.slug}: rig=${kind} 无加热入口`);
      // 其余情形：HEATING_RIGS 走装置开关，非 HEATING_RIGS 走酒精灯按钮，均可达
      else if (!HEATING_RIGS.has(kind) && kind === "none" && exp.apparatus.length === 0) {
        bad.push(`${exp.slug}: 无器材、无装置，加热按钮不可用`);
      }
    }
    expect(bad).toEqual([]);
  });
});
