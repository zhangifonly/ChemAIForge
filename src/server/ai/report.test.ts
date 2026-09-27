// AI 报告 prompt 构造：重点是长会话不能把 prompt 撑爆（明细截断而统计仍按全量）。
import { describe, expect, it, vi } from "vitest";

vi.mock("./config", () => ({
  getClaudeApiConfig: () => ({
    baseUrl: "https://example.invalid",
    apiKey: "test-key",
    model: "claude-sonnet-4-6",
  }),
}));

import { buildReportPrompt, generateReport, parseReportText } from "./report";
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

// 学生在实验台上已经看到「本组平均 X、相对偏差 Y%」，报告必须拿到同一批数字，
// 否则模型只能重新定性描述一遍「读数有波动」，把已经算出的结论丢掉。
describe("定量统计注入 prompt", () => {
  // 覆盖 measurements：session() 的读数不带 mark，构不成平行测定
  function withReadings(ms: SessionDTO["measurements"]): SessionDTO {
    return { ...session(0, 0), measurements: ms };
  }

  it("两次同体系读数给出平均值、相对偏差与一致性结论", () => {
    const text = content(
      withReadings([
        { ph: 7, temperature: 24, at: "t0", volume: 20, mark: "读数" },
        { ph: 7, temperature: 26, at: "t1", volume: 20, mark: "读数" },
      ]),
    );
    expect(text).toContain("定量统计");
    expect(text).toContain("平均温度=25.00℃");
    expect(text).toContain("平均体积=20.00 mL");
    expect(text).toContain("最大相对平均偏差=4.00%");
  });

  it("只有混合快照时如实说明无法计算，不编造偏差", () => {
    const text = content(
      withReadings([{ ph: 7, temperature: 40, at: "t0", mark: "混合" }]),
    );
    expect(text).toContain("未使用「读数」操作");
    expect(text).not.toContain("最大相对平均偏差");
  });

  it("明细里带上动作标记，模型能分辨读数与顺带快照", () => {
    const text = content(
      withReadings([{ ph: 7, temperature: 25, at: "t0", volume: 15, mark: "读数" }]),
    );
    expect(text).toContain("体积=15.00mL");
    expect(text).toContain("动作：读数");
  });

  it("system prompt 要求引用具体数字而非定性改写", () => {
    const body = buildReportPrompt(experiment, session(0, 0));
    expect(body.system).toContain("必须原样引用");
    expect(body.system).toContain("不得自行编造未给出的数值");
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

// 报告解析的容错边界。逐字段回退空串本是好事，但它会把「这段 JSON 根本不是报告」
// 伪装成生成成功：报告存了库，页面从「尚未生成」变成四个「（暂无内容）」，
// 学生得自己看出不对再去点重新生成。上游空内容、JSON 非法都会抛错，唯独这档漏了。
describe("parseReportText", () => {
  const full = JSON.stringify({
    conclusion: "达成目标",
    errorAnalysis: "读数波动小",
    improvements: ["多次测量取平均"],
    knowledgeAssessment: "掌握良好",
  });

  it("正常 JSON 解析出四个字段", () => {
    const r = parseReportText(full);
    expect(r.conclusion).toBe("达成目标");
    expect(r.improvements).toEqual(["多次测量取平均"]);
    expect(r.generatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("剥离 Markdown 代码块标记", () => {
    expect(parseReportText("```json\n" + full + "\n```").conclusion).toBe("达成目标");
  });

  it("非法 JSON 抛错", () => {
    expect(() => parseReportText("这不是 JSON")).toThrow("不是合法 JSON");
  });

  it("四项全空时抛错，而不是产出一份空报告", () => {
    // 模型返回顶层数组 / 外面多包一层 / 字段名全不对，都会落到这里
    expect(() => parseReportText("[]")).toThrow("缺少全部关键字段");
    expect(() => parseReportText('{"report":{"conclusion":"x"}}')).toThrow("缺少全部关键字段");
    expect(() => parseReportText('{"结论":"达成目标"}')).toThrow("缺少全部关键字段");
    expect(() => parseReportText('{"conclusion":"   "}')).toThrow("缺少全部关键字段");
  });

  it("只要有一项拿得到就不算失败（部分缺字段仍是有价值的报告）", () => {
    const r = parseReportText('{"conclusion":"达成目标"}');
    expect(r.conclusion).toBe("达成目标");
    expect(r.errorAnalysis).toBe("");
    expect(r.improvements).toEqual([]);
  });

  it("只有 improvements 一项也算有效报告", () => {
    expect(parseReportText('{"improvements":["下次控温"]}').improvements).toEqual(["下次控温"]);
  });

  it("improvements 里的对象元素转成可读文本，不再是 [object Object]", () => {
    const r = parseReportText(
      '{"improvements":[{"建议":"控制温度","理由":"放热明显"},"直接一句话"]}',
    );
    expect(r.improvements).toEqual(["控制温度：放热明显", "直接一句话"]);
    expect(r.improvements.join()).not.toContain("[object Object]");
  });

  it("improvements 里拿不出文本的元素被丢弃，而不是塞一行垃圾", () => {
    const r = parseReportText('{"conclusion":"x","improvements":[null,{},[],"  ","有效建议"]}');
    expect(r.improvements).toEqual(["有效建议"]);
  });
});

describe("报告 JSON 容错解析", () => {
  const body = (c: string) =>
    JSON.stringify({ conclusion: c, errorAnalysis: "x", improvements: ["y"], knowledgeAssessment: "z" });

  it("德语 „…“ 里未转义的直引号不再让整份报告失败", () => {
    // 模型原样输出：„exotherm" 收尾的 " 没有转义，它让 JSON 在这里断开
    const text =
      '{"conclusion":"Die Reaktion ist „exotherm" und setzt Wärme frei.","errorAnalysis":"x","improvements":["y"],"knowledgeAssessment":"z"}';
    expect(parseReportText(text).conclusion).toBe('Die Reaktion ist „exotherm" und setzt Wärme frei.');
  });

  it("JSON 前后夹解释文字也能取出", () => {
    expect(parseReportText(`Hier ist der Bericht:\n${body("ok")}\nViel Erfolg!`).conclusion).toBe("ok");
  });

  it("代码围栏包裹也能取出", () => {
    expect(parseReportText("```json\n" + body("ok") + "\n```").conclusion).toBe("ok");
  });

  it("正常 JSON 不受影响，已转义的引号保持原样", () => {
    expect(parseReportText(body('he said "hi"')).conclusion).toBe('he said "hi"');
  });
});
