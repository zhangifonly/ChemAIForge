// AI 实验报告生成
// buildReportPrompt：基于会话 steps/measurements 与实验上下文构造 Claude Messages 请求体，
//   要求模型仅返回结构化 JSON（结论/误差分析/改进建议/知识点掌握评估）。
// generateReport：非流式调用 Claude，解析并校验返回的结构化报告。
import type { ExperimentDTO } from "@/types/experiment";
import type { ExperimentReport, SessionDTO } from "@/server/session/types";
import { getClaudeApiConfig } from "./config";

const DEFAULT_MAX_TOKENS = 1500;
const DEFAULT_TIMEOUT_MS = 60000;
/**
 * 注入 prompt 的步骤 / 读数明细条数上限。
 *
 * 会话最多留 500 条（MAX_SESSION_ENTRIES），每条 step 的 detail 里还带完整方程式，
 * 全量逐条列出轻易上万 token —— 又慢又贵，且模型注意力被淹没在重复的"混合"里。
 * 超限时只列最近 N 条，总数与区间统计仍按全量算，误差分析不受影响。
 */
const MAX_PROMPT_ENTRIES = 60;

// 取最近 N 条明细，并返回被省略的条数（用于在 prompt 里如实说明）
function recent<T>(list: T[]): { shown: T[]; omitted: number } {
  if (list.length <= MAX_PROMPT_ENTRIES) return { shown: list, omitted: 0 };
  return {
    shown: list.slice(list.length - MAX_PROMPT_ENTRIES),
    omitted: list.length - MAX_PROMPT_ENTRIES,
  };
}

// Claude Messages API 请求体（非流式）
export interface ReportRequestBody {
  model: string;
  system: string;
  max_tokens: number;
  messages: { role: "user"; content: string }[];
}

// 汇总测量读数为可读统计，供模型分析误差波动
function summarizeMeasurements(session: SessionDTO): string {
  if (session.measurements.length === 0) return "（本次实验未记录任何读数）";
  const phs = session.measurements.map((m) => m.ph);
  const temps = session.measurements.map((m) => m.temperature);
  const range = (xs: number[]) =>
    `最低 ${Math.min(...xs).toFixed(2)} / 最高 ${Math.max(...xs).toFixed(2)}`;
  // 区间统计按全量算，只有明细截断
  const { shown, omitted } = recent(session.measurements);
  const lines = shown.map(
    (m, i) =>
      `${i + 1 + omitted}. [${m.at}] pH=${m.ph.toFixed(2)}　温度=${m.temperature.toFixed(2)}℃`,
  );
  return [
    `共 ${session.measurements.length} 条读数。pH 区间：${range(phs)}；温度区间：${range(temps)}。`,
    omitted > 0 ? `明细（已省略较早的 ${omitted} 条，以下为最近 ${shown.length} 条）：` : "明细：",
    ...lines,
  ].join("\n");
}

// 汇总操作步骤序列
function summarizeSteps(session: SessionDTO): string {
  if (session.steps.length === 0) return "（本次实验未记录操作步骤）";
  const { shown, omitted } = recent(session.steps);
  const lines = shown.map((s, i) => {
    const detail = s.detail ? `　详情：${JSON.stringify(s.detail)}` : "";
    return `${i + 1 + omitted}. [${s.at}] ${s.action}${detail}`;
  });
  if (omitted === 0) return lines.join("\n");
  return [
    `共 ${session.steps.length} 步，已省略较早的 ${omitted} 步，以下为最近 ${shown.length} 步：`,
    ...lines,
  ].join("\n");
}

// 构造资深化学导师评估 system prompt，约束模型仅输出结构化 JSON
function buildSystemPrompt(): string {
  return [
    "你是一位资深化学实验导师，负责在虚拟实验结束后为学生生成结构化评估报告。",
    "请用简体中文撰写，语气专业且鼓励，结合实验目标、操作步骤与测量读数客观分析。",
    "你必须只返回一个 JSON 对象，禁止包含 Markdown 代码块标记或任何额外文字。",
    "JSON 结构如下（字段含义）：",
    "{",
    '  "conclusion": "实验结论概述（是否达成目标、关键现象）",',
    '  "errorAnalysis": "误差分析（读数波动、操作偏差及可能成因）",',
    '  "improvements": ["改进建议1", "改进建议2"],',
    '  "knowledgeAssessment": "对学生相关知识点掌握程度的评估"',
    "}",
  ].join("\n");
}

// 构造用户消息：注入实验上下文与会话数据汇总
function buildUserContent(
  experiment: ExperimentDTO,
  session: SessionDTO,
): string {
  const objectives = experiment.objectives.length
    ? experiment.objectives.map((o, i) => `${i + 1}. ${o}`).join("\n")
    : "（暂无明确目标）";

  return [
    "【实验信息】",
    `标题：${experiment.title}`,
    `分类：${experiment.category}　难度：${experiment.difficulty}`,
    `简介：${experiment.description}`,
    "实验目标：",
    objectives,
    "",
    "【操作步骤】",
    summarizeSteps(session),
    "",
    "【测量读数】",
    summarizeMeasurements(session),
    "",
    "请基于以上信息生成结构化实验报告 JSON。",
  ].join("\n");
}

// 构造 Claude Messages API 请求体（不含密钥，便于单测与日志审查）
export function buildReportPrompt(
  experiment: ExperimentDTO,
  session: SessionDTO,
  maxTokens = DEFAULT_MAX_TOKENS,
): ReportRequestBody {
  const { model } = getClaudeApiConfig();
  return {
    model,
    system: buildSystemPrompt(),
    max_tokens: maxTokens,
    messages: [{ role: "user", content: buildUserContent(experiment, session) }],
  };
}

// 从 Claude 非流式响应中提取首个文本块
function extractText(data: unknown): string {
  const content = (data as { content?: { type?: string; text?: string }[] })
    ?.content;
  if (!Array.isArray(content)) return "";
  return content
    .filter((b) => b?.type === "text" && typeof b.text === "string")
    .map((b) => b.text as string)
    .join("");
}

// 容错解析模型文本为结构化报告：剥离可能的代码块标记后 JSON.parse 并校验关键字段
function parseReportText(text: string): ExperimentReport {
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/, "")
    .trim();
  let obj: Record<string, unknown>;
  try {
    obj = JSON.parse(cleaned) as Record<string, unknown>;
  } catch {
    throw new Error("AI 返回的报告不是合法 JSON，无法解析。");
  }
  const improvements = Array.isArray(obj.improvements)
    ? (obj.improvements as unknown[]).map((x) => String(x))
    : [];
  return {
    conclusion: typeof obj.conclusion === "string" ? obj.conclusion : "",
    errorAnalysis:
      typeof obj.errorAnalysis === "string" ? obj.errorAnalysis : "",
    improvements,
    knowledgeAssessment:
      typeof obj.knowledgeAssessment === "string"
        ? obj.knowledgeAssessment
        : "",
    generatedAt: new Date().toISOString(),
  };
}

// 非流式调用 Claude 生成结构化实验报告。
// 统一处理超时（AbortController）与非 2xx 错误，抛出可读异常。
export async function generateReport(
  experiment: ExperimentDTO,
  session: SessionDTO,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<ExperimentReport> {
  const { baseUrl, apiKey } = getClaudeApiConfig();
  const body = buildReportPrompt(experiment, session);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  // 超时必须覆盖到读完响应体：原先在 fetch 的 finally 里就 clearTimeout，
  // 而 fetch 只等到响应头，之后 response.json() 读 body 已无任何超时保护 ——
  // 上游发完头就卡住时这里会永久挂起，接口请求一直悬着不返回。
  try {
    let response: Response;
    try {
      response = await fetch(`${baseUrl.replace(/\/$/, "")}/v1/messages`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        throw new Error("AI 报告生成超时，请稍后重试。");
      }
      throw new Error(
        `调用 AI 报告服务失败：${err instanceof Error ? err.message : String(err)}`,
      );
    }

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      throw new Error(
        `AI 报告服务返回错误（${response.status}）：${detail.slice(0, 200)}`,
      );
    }

    // 这里不能无条件 catch 成 null：读 body 时被超时 abort 也会走进 catch，
    // 于是超时被误报成"返回空内容"，排障时完全指错方向。只吞真正的解析失败。
    const data = await response.json().catch((err: unknown) => {
      if (err instanceof Error && err.name === "AbortError") throw err;
      return null;
    });
    const text = extractText(data);
    if (!text) throw new Error("AI 报告服务返回空内容。");
    return parseReportText(text);
  } catch (err) {
    // 读 body 阶段被超时 abort 时错误类型是 AbortError，转成同一句可读文案
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error("AI 报告生成超时，请稍后重试。");
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}
