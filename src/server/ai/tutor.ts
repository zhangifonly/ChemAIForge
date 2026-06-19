// AI 导师对话封装
// buildTutorPrompt：根据当前实验与对话上下文构造 Claude Messages API 请求体，
//   system prompt 注入“资深化学导师”角色与实验上下文（标题/目标等）。
// streamTutorReply：发起带超时的流式调用，逐块产出文本增量。
import type { ExperimentDTO } from "@/types/experiment";
import { getClaudeApiConfig } from "./config";

// 单条对话消息
export interface TutorMessage {
  role: "user" | "assistant";
  content: string;
}

// 调用上下文：历史消息与可选采样/超时参数
export interface TutorContext {
  messages: TutorMessage[];
  maxTokens?: number;
  timeoutMs?: number;
}

// Claude Messages API 请求体（流式）
export interface TutorRequestBody {
  model: string;
  system: string;
  max_tokens: number;
  stream: true;
  messages: TutorMessage[];
}

const DEFAULT_MAX_TOKENS = 1024;
const DEFAULT_TIMEOUT_MS = 30000;

// 构造资深化学导师 system prompt，注入实验标题/目标等上下文
function buildSystemPrompt(experiment: ExperimentDTO): string {
  const objectives = experiment.objectives.length
    ? experiment.objectives.map((o, i) => `${i + 1}. ${o}`).join("\n")
    : "（暂无明确目标）";
  const reagents = experiment.reagents.join("、") || "（无）";

  return [
    "你是一位资深化学导师，擅长在虚拟实验中循循善诱地引导学生。",
    "请用简体中文回答，语气专业而鼓励，重视实验安全与科学原理。",
    "回答应结合下方实验上下文，必要时提示风险，避免直接给出全部答案，鼓励学生思考。",
    "",
    "【输出格式】请使用 Markdown 组织回答，让内容清晰易读：",
    "- 用 **加粗** 标记关键概念、物质名称与结论；",
    "- 分点说明时用有序/无序列表；步骤多时可用小标题（###）分段；",
    "- 化学式与方程式用行内代码包裹，如 `2H₂ + O₂ → 2H₂O`，上下标尽量用 ₂ ³⁺ 等 Unicode 字符；",
    "- 安全提示用引用块（>）突出；适当时用表格对比；",
    "- 保持简洁，避免冗长，单次回答聚焦学生当前的问题。",
    "",
    "【当前实验】",
    `标题：${experiment.title}`,
    `分类：${experiment.category}　难度：${experiment.difficulty}`,
    `简介：${experiment.description}`,
    `可用试剂：${reagents}`,
    "实验目标：",
    objectives,
  ].join("\n");
}

// 构造 Claude Messages API 请求体（不含密钥，便于单测与日志审查）
export function buildTutorPrompt(
  experiment: ExperimentDTO,
  context: TutorContext,
): TutorRequestBody {
  const { model } = getClaudeApiConfig();
  return {
    model,
    system: buildSystemPrompt(experiment),
    max_tokens: context.maxTokens ?? DEFAULT_MAX_TOKENS,
    stream: true,
    messages: context.messages,
  };
}

// 从 Claude SSE 数据行中提取文本增量
function extractDelta(line: string): string | null {
  if (!line.startsWith("data:")) return null;
  const payload = line.slice(5).trim();
  if (!payload || payload === "[DONE]") return null;
  try {
    const event = JSON.parse(payload) as {
      type?: string;
      delta?: { type?: string; text?: string };
    };
    if (event.type === "content_block_delta" && event.delta?.text) {
      return event.delta.text;
    }
  } catch {
    // 忽略非 JSON 的心跳/事件行
  }
  return null;
}

// 发起流式调用，逐块产出导师回复文本增量。
// 统一处理超时（AbortController）与非 2xx 错误，抛出可读异常。
export async function* streamTutorReply(
  experiment: ExperimentDTO,
  context: TutorContext,
): AsyncGenerator<string, void, unknown> {
  const { baseUrl, apiKey } = getClaudeApiConfig();
  const body = buildTutorPrompt(experiment, context);

  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    context.timeoutMs ?? DEFAULT_TIMEOUT_MS,
  );

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
    clearTimeout(timeout);
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error("AI 导师响应超时，请稍后重试。");
    }
    throw new Error(
      `调用 AI 导师服务失败：${err instanceof Error ? err.message : String(err)}`,
    );
  }

  if (!response.ok || !response.body) {
    clearTimeout(timeout);
    const detail = await response.text().catch(() => "");
    throw new Error(
      `AI 导师服务返回错误（${response.status}）：${detail.slice(0, 200)}`,
    );
  }

  try {
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        const text = extractDelta(line);
        if (text) yield text;
      }
    }
  } finally {
    clearTimeout(timeout);
  }
}
