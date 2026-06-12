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
