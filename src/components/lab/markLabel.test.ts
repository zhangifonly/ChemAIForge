import { describe, expect, it } from "vitest";
import { markLabel } from "./markLabel";
import { plainT } from "@/lib/i18n/plainT";
import enMessages from "../../../messages/en.json";
import zhMessages from "../../../messages/zh.json";

const tOpEn = plainT(enMessages, "op");
const tLabEn = plainT(enMessages, "lab");
const termEn = (zh: string) => ({ 盐酸: "hydrochloric acid", 氢氧化钠: "sodium hydroxide" })[zh] ?? zh;

describe("曲线标记的显示文本", () => {
  it("混合标记换成当前语言", () => {
    expect(markLabel("混合", tOpEn, tLabEn, termEn)).not.toMatch(/[一-鿿]/);
  });

  it("操作名标记走 op 词条", () => {
    const text = markLabel("读数", tOpEn, tLabEn, termEn);
    expect(text).toBe(tOpEn("read.label"));
    expect(text).not.toMatch(/[一-鿿]/);
  });

  it("加 / 移除试剂的标记里，试剂名走术语表", () => {
    const add = markLabel("加盐酸", tOpEn, tLabEn, termEn);
    expect(add).toContain("hydrochloric acid");
    expect(add).not.toMatch(/[一-鿿]/);
    expect(markLabel("移除氢氧化钠", tOpEn, tLabEn, termEn)).toContain("sodium hydroxide");
  });

  it("「移除」不会被「加」的前缀判断误吞", () => {
    // 两者都以试剂名结尾；判断顺序错了会把"移除X"当成"加"一个叫"除X"的试剂
    const text = markLabel("移除盐酸", tOpEn, tLabEn, termEn);
    expect(text).toBe(tLabEn("removeReagent", { name: "hydrochloric acid" }));
  });

  it("中文界面下与存储原文一致：源语言不能被改写", () => {
    const tOp = plainT(zhMessages, "op");
    const tLab = plainT(zhMessages, "lab");
    const id = (s: string) => s;
    expect(markLabel("混合", tOp, tLab, id)).toBe("混合");
    expect(markLabel("读数", tOp, tLab, id)).toBe("读数");
    expect(markLabel("加盐酸", tOp, tLab, id)).toBe("加盐酸");
  });

  it("未知标记原样返回，便于发现漏了哪一类", () => {
    expect(markLabel("某种新动作", tOpEn, tLabEn, termEn)).toBe("某种新动作");
  });
});
