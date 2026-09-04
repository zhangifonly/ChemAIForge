// AI 导师流式调用：重点是超时语义。流式回答本来就会持续输出十几秒到几十秒，
// 若按"总时长"计时，正常的长回答会被拦腰截断；正确语义是"多久没有新数据"。
import { describe, expect, it, vi } from "vitest";

vi.mock("./config", () => ({
  getClaudeApiConfig: () => ({
    baseUrl: "https://example.invalid",
    apiKey: "test-key",
    model: "claude-sonnet-4-6",
  }),
}));

import { buildTutorPrompt, streamTutorReply } from "./tutor";
import type { ExperimentDTO } from "@/types/experiment";

const experiment = {
  id: "exp-1",
  slug: "acid-base",
  title: "酸碱中和",
  category: "无机化学",
  difficulty: "BEGINNER",
  description: "盐酸与氢氧化钠的中和反应",
  objectives: ["理解中和反应"],
  reagents: ["盐酸", "氢氧化钠"],
  apparatus: ["烧杯"],
} as unknown as ExperimentDTO;

const sse = (text: string) =>
  `data: ${JSON.stringify({ type: "content_block_delta", delta: { type: "text_delta", text } })}\n\n`;

/** 构造一个按给定间隔逐块吐数据的假响应体 */
function bodyOf(chunks: string[], gapMs: number, signal?: AbortSignal) {
  const enc = new TextEncoder();
  let i = 0;
  return {
    getReader: () => ({
      read: () =>
        new Promise<{ done: boolean; value?: Uint8Array }>((resolve, reject) => {
          if (i >= chunks.length) return resolve({ done: true });
          const t = setTimeout(() => resolve({ done: false, value: enc.encode(chunks[i++]) }), gapMs);
          signal?.addEventListener("abort", () => {
            clearTimeout(t);
            const e = new Error("aborted");
            e.name = "AbortError";
            reject(e);
          });
        }),
      cancel: async () => {},
    }),
  };
}

async function collect(gen: AsyncGenerator<string>) {
  const out: string[] = [];
  for await (const t of gen) out.push(t);
  return out.join("");
}

describe("buildTutorPrompt", () => {
  it("注入实验上下文且不含密钥", () => {
    const body = buildTutorPrompt(experiment, { messages: [{ role: "user", content: "为什么" }] });
    expect(body.stream).toBe(true);
    expect(body.system).toContain("酸碱中和");
    expect(body.system).toContain("盐酸、氢氧化钠");
    expect(JSON.stringify(body)).not.toContain("test-key");
  });
});

describe("流式超时按空闲计时", () => {
  it("持续输出的长回答不会被截断（总时长远超空闲阈值）", async () => {
    // 6 块 × 40ms = 240ms 总时长，远超 100ms 的空闲阈值，但每块间隔只有 40ms
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_u: string, init?: RequestInit) => ({
        ok: true,
        status: 200,
        body: bodyOf(["一", "二", "三", "四", "五", "六"].map(sse), 40, init?.signal ?? undefined),
      })),
    );
    const text = await collect(
      streamTutorReply(experiment, {
        messages: [{ role: "user", content: "讲讲" }],
        timeoutMs: 100,
      }),
    );
    expect(text).toBe("一二三四五六");
    vi.unstubAllGlobals();
  });

  it("真的停止输出时按超时报错，而不是把 AbortError 原样透出", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_u: string, init?: RequestInit) => ({
        ok: true,
        status: 200,
        body: bodyOf([sse("开头")], 500, init?.signal ?? undefined),
      })),
    );
    await expect(
      collect(
        streamTutorReply(experiment, {
          messages: [{ role: "user", content: "讲讲" }],
          timeoutMs: 60,
        }),
      ),
    ).rejects.toThrow("AI 导师响应超时，请稍后重试。");
    vi.unstubAllGlobals();
  });
});
