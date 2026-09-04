// AI 报告 prompt 构造：重点是长会话不能把 prompt 撑爆（明细截断而统计仍按全量）。
import { describe, expect, it, vi } from "vitest";

vi.mock("./config", () => ({
  getClaudeApiConfig: () => ({
    baseUrl: "https://example.invalid",
    apiKey: "test-key",
    model: "claude-sonnet-4-6",
  }),
}));

import { buildReportPrompt, generateReport } from "./report";
import type { SessionDTO } from "@/server/session/types";
import type { ExperimentDTO } from "@/types/experiment";

const experiment = {
  id: "exp-1",
  slug: "acid-base",
  title: "酸碱中和",
  category: "无机化学",
  difficulty: "BEGINNER",
  description: "盐酸与氢氧化钠的中和反应",
  objectives: ["理解中和反应", "掌握 pH 变化"],
  reagents: ["盐酸", "氢氧化钠"],
  apparatus: ["烧杯"],
} as unknown as ExperimentDTO;

function session(stepCount: number, measureCount: number): SessionDTO {
  return {
    id: "sess-1",
    userId: "user-1",
    experimentId: "exp-1",
    status: "IN_PROGRESS",
    steps: Array.from({ length: stepCount }, (_, i) => ({
      action: "mix",
      detail: { equation: "HCl + NaOH → NaCl + H2O" },
      at: `t${i}`,
    })),
    measurements: Array.from({ length: measureCount }, (_, i) => ({
      ph: i % 14,
      temperature: 25 + (i % 30),
      at: `t${i}`,
    })),
    report: null,
    startedAt: "2026-01-01T00:00:00.000Z",
    completedAt: null,
  } as SessionDTO;
}

const content = (s: SessionDTO) =>
  buildReportPrompt(experiment, s).messages[0].content;

describe("buildReportPrompt", () => {
  it("短会话完整列出全部步骤与读数", () => {
    const text = content(session(5, 5));
    expect(text).toContain("5. [t4]");
    expect(text).not.toContain("已省略");
  });

  it("长会话截断明细但如实说明省略了多少", () => {
    const text = content(session(500, 500));
    expect(text).toContain("共 500 步");
    expect(text).toContain("已省略较早的 440 步");
    // 明细保留的是最近的，编号延续原序号而不是从 1 重排
    expect(text).toContain("500. [t499]");
    expect(text).not.toContain("\n1. [t0]");
  });

  it("读数统计按全量计算，不受明细截断影响", () => {
    const text = content(session(0, 500));
    expect(text).toContain("共 500 条读数");
    // 温度按 25+(i%30) 生成，全量区间应为 25~54
    expect(text).toContain("最低 25.00 / 最高 54.00");
  });

  it("空会话给出明确占位说明而非空白", () => {
    const text = content(session(0, 0));
    expect(text).toContain("未记录操作步骤");
    expect(text).toContain("未记录任何读数");
  });

  it("prompt 体积随会话增长受控（500 步不超过 20KB）", () => {
    expect(content(session(500, 500)).length).toBeLessThan(20000);
  });
});

describe("generateReport 的超时保护", () => {
  // fetch 只等到响应头就 resolve，读 body 是另一段等待。
  // 上游"发完头就卡住"时，若超时定时器已被清掉，这里会永久挂起。
  it("响应头已到但读取响应体卡住时按超时报错", async () => {
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => ({
      ok: true,
      status: 200,
      // 永不 resolve，只在 signal abort 时 reject —— 还原上游卡在 body 的情形
      json: () =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            const e = new Error("aborted");
            e.name = "AbortError";
            reject(e);
          });
        }),
      text: async () => "",
    }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      generateReport(experiment, session(1, 1), 30),
    ).rejects.toThrow("AI 报告生成超时，请稍后重试。");

    vi.unstubAllGlobals();
  });
});
