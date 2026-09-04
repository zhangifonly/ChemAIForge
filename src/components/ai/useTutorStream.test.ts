// SSE 载荷解析的容错：中间网关可能插入心跳或截断事件，
// 单条解析失败只能跳过这一条，不能让整轮对话连同已收到的正文一起丢掉。
import { describe, expect, it } from "vitest";
import { parseDetail, parseText } from "./useTutorStream";

describe("parseText", () => {
  it("正常载荷取出增量文本", () => {
    expect(parseText('{"text":"氢氧化钠"}')).toBe("氢氧化钠");
  });

  it("空字符串文本是合法增量，不能当成跳过", () => {
    expect(parseText('{"text":""}')).toBe("");
  });

  it("非法 JSON 返回 null 表示跳过而非抛错", () => {
    expect(parseText("{截断的")).toBeNull();
    expect(parseText(": keep-alive")).toBeNull();
  });

  it("缺 text 字段或类型不符时跳过", () => {
    expect(parseText('{"ping":1}')).toBeNull();
    expect(parseText('{"text":42}')).toBeNull();
  });
});

describe("parseDetail", () => {
  it("取出错误详情", () => {
    expect(parseDetail('{"detail":"上游 429"}')).toBe("上游 429");
  });

  it("缺失 / 非法 / 类型不符时给可读兜底", () => {
    expect(parseDetail(undefined)).toBe("未知错误");
    expect(parseDetail("oops")).toBe("未知错误");
    expect(parseDetail('{"detail":{"code":1}}')).toBe("未知错误");
  });
});
