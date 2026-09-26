// 导师接口入口校验：重点是「有上限」这件事本身。
// 服务端必须自己兜住体积，因为客户端可以绕过（直接打 API），
// 而对话历史是唯一会随使用无界增长的入参。
import { describe, expect, it } from "vitest";
import { tutorRequestSchema } from "./validation";

const base = { experimentSlug: "acid-base" };
const msgs = (n: number, chars = 4) =>
  Array.from({ length: n }, () => ({ role: "user" as const, content: "字".repeat(chars) }));

describe("tutorRequestSchema", () => {
  it("正常请求通过", () => {
    expect(
      tutorRequestSchema.safeParse({ ...base, messages: msgs(5) }).success,
    ).toBe(true);
  });

  it("空消息数组被拒", () => {
    expect(tutorRequestSchema.safeParse({ ...base, messages: [] }).success).toBe(false);
  });

  it("消息条数超上限被拒", () => {
    expect(tutorRequestSchema.safeParse({ ...base, messages: msgs(500) }).success).toBe(false);
  });

  it("单条内容超长被拒", () => {
    const r = tutorRequestSchema.safeParse({ ...base, messages: msgs(1, 50_000) });
    expect(r.success).toBe(false);
  });

  it("条数与单条长度都合法但总量过大时仍被拒", () => {
    // 100 条 × 每条 19000 字 = 190 万字，逐项校验都过得去，总量必须另兜一道
    const r = tutorRequestSchema.safeParse({ ...base, messages: msgs(100, 19_000) });
    expect(r.success).toBe(false);
  });

  it("入口阈值明显宽于 trimHistory，聊得久只会被静默裁剪而不是收到 400", () => {
    // 30 条已超过 trimHistory 的 20 条上限，但这是完全正常的使用，必须放行
    expect(tutorRequestSchema.safeParse({ ...base, messages: msgs(30, 500) }).success).toBe(true);
  });

  it("缺少实验标识被拒", () => {
    expect(tutorRequestSchema.safeParse({ messages: msgs(1) }).success).toBe(false);
  });
});
