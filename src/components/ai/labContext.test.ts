// AI 导师的画布快照与情境提示：核心是让导师分得清"缺条件"与"试剂不匹配"，
// 否则学生问"为什么没反应"会被答成"换试剂"，而正确指引是点燃酒精灯。
import { describe, expect, it } from "vitest";
import { react } from "@/lib/chem/engine";
import { resolveSubstance } from "@/components/lab/reagents";
import { buildLabState, contextualPrompt } from "./labContext";
import { plainT } from "@/lib/i18n/plainT";
import zhMessages from "../../../messages/zh.json";

// 用中文词条跑：断言里按中文关键词校验，守的是"何时发问、问什么"的逻辑
const t = plainT(zhMessages, "tutor");

const S = (...names: string[]) => names.map(resolveSubstance);
const snap = (contents: ReturnType<typeof S>, result: ReturnType<typeof react> | null) => ({
  contents,
  result,
  readings: { ph: 7, temperature: 25 },
});

describe("buildLabState", () => {
  it("缺加热时给出未反应原因，不与试剂不匹配混为一谈", () => {
    const contents = S("乙酸", "乙醇", "硫酸");
    const state = buildLabState(snap(contents, react(contents)));
    const r = state["最近反应"] as Record<string, unknown>;
    expect(r["发生反应"]).toBe(false);
    expect(String(r["未反应原因"])).toContain("加热");
  });

  it("试剂不匹配时不带未反应原因字段", () => {
    const contents = S("氯化钠", "硝酸钾");
    const state = buildLabState(snap(contents, react(contents)));
    const r = state["最近反应"] as Record<string, unknown>;
    expect(r["发生反应"]).toBe(false);
    expect(r["未反应原因"]).toBeUndefined();
  });

  it("未混合时最近反应为 null", () => {
    expect(buildLabState(snap(S("盐酸"), null))["最近反应"]).toBeNull();
  });
});

describe("contextualPrompt", () => {
  it("缺加热时主动提问为什么必须加热", () => {
    const p = contextualPrompt(react(S("乙酸", "乙醇", "硫酸")), t);
    expect(p).not.toBeNull();
    expect(p).toContain("加热");
  });

  it("试剂不匹配时不打扰用户", () => {
    expect(contextualPrompt(react(S("氯化钠", "硝酸钾")), t)).toBeNull();
  });

  it("有明显现象的反应生成含方程式的提问", () => {
    const p = contextualPrompt(react(S("氯化钡", "硫酸")), t);
    expect(p).toContain("沉淀");
  });
});
