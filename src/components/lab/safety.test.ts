// 安全反馈测试：危险试剂触发提醒、浓硫酸+水强调“酸入水”、无反应给操作提示。
import { describe, it, expect } from "vitest";
import { safetyNotes, operationHint } from "./safety";
import type { ReactionResult } from "@/lib/chem/engine";

const item = (formula: string, category: any, name = formula) => ({
  formula,
  category,
  name,
});

describe("safetyNotes", () => {
  it("为强碱氢氧化钠给出腐蚀提醒", () => {
    const notes = safetyNotes([item("NaOH", "base", "氢氧化钠")]);
    expect(notes.some((n) => n.includes("腐蚀"))).toBe(true);
  });

  it("活泼金属钠给出取用提醒", () => {
    const notes = safetyNotes([item("Na", "metal", "钠")]);
    expect(notes.some((n) => n.includes("煤油"))).toBe(true);
  });

  it("浓硫酸与水共存时优先强调“酸入水”", () => {
    const notes = safetyNotes([
      item("H2SO4", "acid", "硫酸"),
      item("H2O", "water", "水"),
    ]);
    expect(notes[0]).toContain("浓硫酸缓缓注入水中");
  });

  it("无危险试剂时不产生提醒", () => {
    expect(safetyNotes([item("NaCl", "salt", "氯化钠")])).toHaveLength(0);
  });

  // 曾有 21 个用硝酸银、16 个用过氧化氢、12 个用溴水的实验一条提醒也没有 ——
  // 恰恰是这些"看起来像水"的试剂最容易被当成无害
  it.each([
    ["H2S", "gas", "硫化氢", "剧毒"],
    ["CO", "gas", "一氧化碳", "剧毒"],
    ["Br2", "oxidizer", "溴水", "剧毒"],
    ["AgNO3", "salt", "硝酸银", "腐蚀"],
    ["H2O2", "oxidizer", "过氧化氢", "灼伤"],
    ["Pb(NO3)2", "salt", "硝酸铅", "重金属"],
    ["C6H5OH", "organic", "苯酚", "酒精"],
    ["C6H6", "organic", "苯", "致癌"],
    ["CH3OH", "organic", "甲醇", "失明"],
    ["HF", "acid", "氢氟酸", "骨骼"],
    ["Hg", "metal", "汞", "硫粉"],
  ])("%s 给出针对性提醒", (formula, cat, name, keyword) => {
    const notes = safetyNotes([item(formula, cat, name)]);
    expect(notes.join("|")).toContain(keyword);
  });

  // 铝粉与氧化铁分开都无害，混在一起点燃却是 2000 ℃ 熔融铁飞溅 ——
  // 这类风险按化学式逐个登记必然漏掉，只能按组合判定
  it("铝热反应给出组合型危险提醒并置顶", () => {
    const notes = safetyNotes([
      item("Al", "metal", "铝粉"),
      item("Fe2O3", "oxide", "氧化铁"),
    ]);
    expect(notes[0]).toContain("熔融铁");
  });

  it("镁给出强光护眼提醒", () => {
    expect(safetyNotes([item("Mg", "metal", "镁条")]).join()).toContain("视网膜");
  });

  it("镉给出重金属提醒", () => {
    expect(safetyNotes([item("Cd", "metal", "镉片")]).join()).toContain("重金属");
  });

  // 上限 4 条是为了不刷屏，但截断顺序必须让剧毒优先：
  // 「硫化钠 + 硫酸 + 硫酸铜 + 氢氧化钠」里酸碱腐蚀提醒先命中，
  // 会把 H₂S 剧毒这条挤掉 —— 腐蚀漏掉只是不便，剧毒漏掉是事故
  it("提醒超过上限时剧毒类优先保留", () => {
    const notes = safetyNotes([
      item("H2SO4", "acid", "硫酸"),
      item("NaOH", "base", "氢氧化钠"),
      item("KMnO4", "oxidizer", "高锰酸钾"),
      item("AgNO3", "salt", "硝酸银"),
      item("H2S", "gas", "硫化氢"),
    ]);
    expect(notes.length).toBeLessThanOrEqual(4);
    expect(notes.join("|")).toContain("硫化氢剧毒");
  });
});

describe("operationHint", () => {
  it("混合后无反应给出操作提示", () => {
    const result = { reacted: false } as ReactionResult;
    const hint = operationHint(
      [item("NaCl", "salt"), item("KNO3", "salt")],
      result,
    );
    expect(hint).toContain("未发生明显反应");
  });

  it("发生反应时不提示", () => {
    const result = { reacted: true } as ReactionResult;
    expect(operationHint([item("HCl", "acid"), item("NaOH", "base")], result)).toBeNull();
  });
});
