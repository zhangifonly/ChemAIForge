// AI 实验报告生成
// buildReportPrompt：基于会话 steps/measurements 与实验上下文构造 Claude Messages 请求体，
//   要求模型仅返回结构化 JSON（结论/误差分析/改进建议/知识点掌握评估）。
// generateReport：非流式调用 Claude，解析并校验返回的结构化报告。
import type { ExperimentDTO } from "@/types/experiment";
import type {
  ExperimentReport,
  SessionDTO,
  SessionMeasurement,
} from "@/server/session/types";
import { getClaudeApiConfig } from "./config";
import { localeMeta, SOURCE_LOCALE } from "@/lib/i18n/locales";
import { summarizeQuantitative } from "./quantSummary";

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
  const lines = shown.map((m, i) => measurementLine(m, i + 1 + omitted));
  return [
    `共 ${session.measurements.length} 条读数。pH 区间：${range(phs)}；温度区间：${range(temps)}。`,
    omitted > 0 ? `明细（已省略较早的 ${omitted} 条，以下为最近 ${shown.length} 条）：` : "明细：",
    ...lines,
  ].join("\n");
}

// 单条明细：带上体积与动作标记，模型才能看出哪条是主动读数、哪条是混合顺带的快照
function measurementLine(m: SessionMeasurement, no: number): string {
  const parts = [`pH=${m.ph.toFixed(2)}`, `温度=${m.temperature.toFixed(2)}℃`];
  if (m.volume !== undefined) parts.push(`体积=${m.volume.toFixed(2)}mL`);
  const mark = m.mark ? `　动作：${m.mark}` : "";
  return `${no}. [${m.at}] ${parts.join("　")}${mark}`;
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
//
// 输出语言跟随界面语言：学生在日语界面里做实验，报告也该是日语。
// 用英文语言名指示模型（"in Japanese"）而不是用该语言自己写指令 ——
// 前者对 60 个语种都能一致生效，后者要先有 60 份指令译文才能开始。
function buildSystemPrompt(locale: string): string {
  const language = localeMeta(locale).englishName;
  return [
    "你是一位资深化学实验导师，负责在虚拟实验结束后为学生生成结构化评估报告。",
    `Write ALL output in ${language}. 语气专业且鼓励，结合实验目标、操作步骤与测量读数客观分析。`,
    // 学生在实验台上已经看到了带具体数字的数据表，报告若只写「读数存在波动」等于把结论丢掉
    "已给出的定量统计（平均值、相对平均偏差、数据一致性判定）必须原样引用到误差分析中，",
    "不得回避具体数字改写成定性描述，也不得自行编造未给出的数值。",
    "你必须只返回一个 JSON 对象，禁止包含 Markdown 代码块标记或任何额外文字。",
    "JSON 结构如下（字段含义）：",
    "{",
    '  "conclusion": "实验结论概述（是否达成目标、关键现象）",',
    '  "errorAnalysis": "误差分析（必须引用给定的平均值与相对平均偏差具体数字，再分析成因）",',
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
    // 放在明细之后：先给原始数据，再给已经算好的结论，模型不必自己去做算术
    "【定量统计（已按实验台数据表的口径算好，请直接引用）】",
    summarizeQuantitative(session.measurements),
    "",
    "请基于以上信息生成结构化实验报告 JSON。",
  ].join("\n");
}

// 构造 Claude Messages API 请求体（不含密钥，便于单测与日志审查）
export function buildReportPrompt(
  experiment: ExperimentDTO,
  session: SessionDTO,
  maxTokens = DEFAULT_MAX_TOKENS,
  // 默认源语言：未传语言的旧调用方（含测试）行为不变
  locale: string = SOURCE_LOCALE,
): ReportRequestBody {
  const { model } = getClaudeApiConfig();
  return {
    model,
    system: buildSystemPrompt(locale),
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

/**
 * 归一化一条改进建议。
 *
 * 模型被要求返回字符串数组，但实际常给 `[{ "建议": "…", "理由": "…" }]` 这类对象。
 * 原先一律 String(x)，对象就变成 "[object Object]" 直接渲染到报告页上 ——
 * 学生看到的改进建议是一行乱码。拿不出可读文本时返回 null，由调用方丢弃，
 * 宁可少一条建议也不摆一行垃圾。
 */
function normalizeImprovement(x: unknown): string | null {
  if (typeof x === "string") return x.trim() || null;
  if (typeof x === "number" || typeof x === "boolean") return String(x);
  if (x && typeof x === "object" && !Array.isArray(x)) {
    // 取对象里的字符串字段拼起来（键名可能是"建议"/"suggestion"/"detail"，不作假设）
    const parts = Object.values(x as Record<string, unknown>)
      .filter((v): v is string => typeof v === "string" && v.trim().length > 0)
      .map((v) => v.trim());
    return parts.length ? parts.join("：") : null;
  }
  return null;
}

// 容错解析模型文本为结构化报告：剥离可能的代码块标记后 JSON.parse 并校验关键字段
export function parseReportText(text: string): ExperimentReport {
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
    ? (obj.improvements as unknown[])
        .map(normalizeImprovement)
        .filter((s): s is string => s !== null)
    : [];
  const conclusion = typeof obj.conclusion === "string" ? obj.conclusion : "";
  const errorAnalysis =
    typeof obj.errorAnalysis === "string" ? obj.errorAnalysis : "";
  const knowledgeAssessment =
    typeof obj.knowledgeAssessment === "string" ? obj.knowledgeAssessment : "";

  // 四项全空 = 这段 JSON 根本不是一份报告（模型返回了顶层数组、外面又包了一层
  // { "report": {…} }、或在 JSON 前后夹了解释文字）。逐字段回退空串本是容错，
  // 但全空时它把"解析失败"伪装成了"生成成功"：报告被存库、页面从「尚未生成」
  // 变成四个「（暂无内容）」，学生得自己看出不对再去点重新生成。
  // 上游返回空内容、JSON 解析失败都会抛错，唯独这一档漏了 —— 补齐。
  if (
    !conclusion.trim() &&
    !errorAnalysis.trim() &&
    !knowledgeAssessment.trim() &&
    improvements.length === 0
  ) {
    throw new Error("AI 返回的报告缺少全部关键字段，无法解析。");
  }

  return {
    conclusion,
    errorAnalysis,
    improvements,
    knowledgeAssessment,
    generatedAt: new Date().toISOString(),
  };
}

// 非流式调用 Claude 生成结构化实验报告。
// 统一处理超时（AbortController）与非 2xx 错误，抛出可读异常。
export async function generateReport(
  experiment: ExperimentDTO,
  session: SessionDTO,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  locale: string = SOURCE_LOCALE,
): Promise<ExperimentReport> {
  const { baseUrl, apiKey } = getClaudeApiConfig();
  const body = buildReportPrompt(experiment, session, undefined, locale);

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
