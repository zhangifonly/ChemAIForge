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

import {
  buildTutorPrompt,
  streamTutorReply,
  trimHistory,
  MAX_HISTORY_MESSAGES,
  MAX_MESSAGE_CHARS,
} from "./tutor";
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

// 对话历史必须有上限：客户端每次提问都全量重发，而画布的情境提示会自动追加问答，
// 不裁剪则历史线性增长，最终超过上游请求体上限，导师直接报错哑掉。
describe("对话历史裁剪", () => {
  /** 生成交替的 user/assistant 历史，末条恒为 user（真实提问的形状） */
  const history = (n: number) =>
    Array.from({ length: n }, (_, i) => ({
      role: (n - i) % 2 === 1 ? ("user" as const) : ("assistant" as const),
      content: `第${i + 1}条`,
    }));

  it("超长历史只保留最近若干条，且末条（最新提问）不丢", () => {
    const kept = trimHistory(history(80));
    expect(kept.length).toBeLessThanOrEqual(MAX_HISTORY_MESSAGES);
    expect(kept[kept.length - 1].content).toBe("第80条");
  });

  it("裁剪后首条仍是 user，不会被上游拒绝", () => {
    // 取偶数条时尾部窗口正好以 assistant 打头，这是最容易踩的一刀
    for (const n of [MAX_HISTORY_MESSAGES + 1, MAX_HISTORY_MESSAGES + 2, 99, 100]) {
      const kept = trimHistory(history(n));
      expect(kept[0].role, `n=${n}`).toBe("user");
    }
  });

  it("短历史原样保留，不做无谓改动", () => {
    // 用奇数条，形状为 user/assistant/…/user，即真实提问轮次的样子
    const short = history(5);
    expect(trimHistory(short)).toEqual(short);
  });

  it("以 assistant 打头的历史即使很短也会被削掉开头（上游硬要求首条是 user）", () => {
    const kept = trimHistory([
      { role: "assistant", content: "上轮回答" },
      { role: "user", content: "追问" },
    ]);
    expect(kept).toEqual([{ role: "user", content: "追问" }]);
  });

  it("单条超长内容被截断，且保留头尾（问题开头与末尾的实验台状态）", () => {
    const huge = `开头标记${"填".repeat(MAX_MESSAGE_CHARS)}结尾标记`;
    const [only] = trimHistory([{ role: "user", content: huge }]);
    expect(only.content.length).toBeLessThan(MAX_MESSAGE_CHARS + 50);
    expect(only.content.startsWith("开头标记")).toBe(true);
    expect(only.content.endsWith("结尾标记")).toBe(true);
    expect(only.content).toContain("已省略");
  });

  it("全是 assistant 的异常历史也至少发出一条，不会发空数组", () => {
    const kept = trimHistory([
      { role: "assistant", content: "甲" },
      { role: "assistant", content: "乙" },
    ]);
    expect(kept).toHaveLength(1);
    expect(kept[0].content).toBe("乙");
  });

  it("buildTutorPrompt 实际应用了裁剪", () => {
    const body = buildTutorPrompt(experiment, { messages: history(60) });
    expect(body.messages.length).toBeLessThanOrEqual(MAX_HISTORY_MESSAGES);
    expect(body.messages[0].role).toBe("user");
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
