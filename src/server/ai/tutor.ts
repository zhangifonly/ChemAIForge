// AI 导师对话封装
// buildTutorPrompt：根据当前实验与对话上下文构造 Claude Messages API 请求体，
//   system prompt 注入“资深化学导师”角色与实验上下文（标题/目标等）。
// streamTutorReply：发起带超时的流式调用，逐块产出文本增量。
import type { ExperimentDTO } from "@/types/experiment";
import { getClaudeApiConfig } from "./config";
import { localeMeta, SOURCE_LOCALE } from "@/lib/i18n/locales";

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
  /** 回答语言，缺省为源语言（旧调用方行为不变） */
  locale?: string;
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

/**
 * 送往上游的历史消息条数上限。
 *
 * 客户端每次提问都把完整对话历史全量重发，而导师的每条回答最多 1024 token。
 * 更要紧的是画布的「情境提示」会自动提问：学生每触发一次沉淀/气体/变色就多一轮
 * 完整问答，做十几次混合就攒出十几轮上千字的历史 —— 每轮都全量重发，
 * 越聊越慢越贵，撑到超过上游请求体上限时导师直接整个哑掉（报错而非降级）。
 * 报告生成那条链早就做了同类截断（report.ts 的 MAX_PROMPT_ENTRIES），
 * 导师这条一直漏着。
 *
 * 取 20 条（约 10 轮问答）：足够承载一次实验里的连续追问，又不会无界增长。
 */
export const MAX_HISTORY_MESSAGES = 20;

/**
 * 单条消息的字符上限。
 *
 * 条数管不住体积：labState 快照会拼到最后一条用户消息上，而恶意或异常的客户端
 * 可以直接塞一条几 MB 的 content —— 校验只要求 min(1)，没有上限。
 * 超长时保留头尾（问题的开头与最新的画布状态都在两端），中间用省略标记替代。
 */
export const MAX_MESSAGE_CHARS = 8000;

/** 裁掉超长单条消息，保留首尾以免丢掉问题本身与末尾的实验台状态 */
function truncateContent(content: string): string {
  if (content.length <= MAX_MESSAGE_CHARS) return content;
  const keep = Math.floor((MAX_MESSAGE_CHARS - 20) / 2);
  return `${content.slice(0, keep)}\n…（已省略过长内容）…\n${content.slice(-keep)}`;
}

/**
 * 裁剪对话历史：只留最近 MAX_HISTORY_MESSAGES 条，并逐条限制长度。
 *
 * Claude Messages API 要求首条必须是 user 角色，从尾部截取可能正好切出一条
 * assistant 打头的历史 —— 那会被上游直接拒掉，比不截断更糟。故截断后再丢掉
 * 开头多余的 assistant 条目。
 */
export function trimHistory(messages: TutorMessage[]): TutorMessage[] {
  const tail = messages.slice(-MAX_HISTORY_MESSAGES);
  let start = 0;
  while (start < tail.length && tail[start].role !== "user") start += 1;
  // 全是 assistant 的极端输入：退回原始末条（校验已保证至少一条），
  // 空 messages 会被上游拒绝，宁可发一条也不发零条。
  const kept = start < tail.length ? tail.slice(start) : messages.slice(-1);
  return kept.map((m) => ({ ...m, content: truncateContent(m.content) }));
}

/**
 * 空闲超时：多久收不到新数据才算卡死，而不是"整段对话的总时长上限"。
 *
 * 流式回答持续输出十几秒到几十秒是常态（max_tokens 有 1024），
 * 按总时长计时会把正常的长回答拦腰截断 —— 学生看到导师说到一半就断了。
 * 改成每收到一块增量就重新计时，只有真正停止输出才中断。
 */
const DEFAULT_TIMEOUT_MS = 30000;

// 构造资深化学导师 system prompt，注入实验标题/目标等上下文
// 回答语言跟随界面语言，理由同 report.ts 的 buildSystemPrompt
function buildSystemPrompt(experiment: ExperimentDTO, locale: string): string {
  const language = localeMeta(locale).englishName;
  const objectives = experiment.objectives.length
    ? experiment.objectives.map((o, i) => `${i + 1}. ${o}`).join("\n")
    : "（暂无明确目标）";
  const reagents = experiment.reagents.join("、") || "（无）";

  return [
    "你是一位资深化学导师，擅长在虚拟实验中循循善诱地引导学生。",
    // 语言指令要说清两件事，实测只写 "Answer in German" 时模型会先评论一句
    // 「你用英语提问了，但我应该用德语回答……」再作答 —— 学生看到的第一句话是在议论他的语言。
    //  1) 学生界面语言是什么；2) 学生可能用任何语言提问，一律用界面语言答、不要提及语言
    `The student's interface language is ${language}. Always reply in ${language}, regardless of what language the student writes in.`,
    "Never comment on or mention which language the student used; just answer the question directly.",
    "语气专业而鼓励，重视实验安全与科学原理。",
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
    system: buildSystemPrompt(experiment, context.locale ?? SOURCE_LOCALE),
    max_tokens: context.maxTokens ?? DEFAULT_MAX_TOKENS,
    stream: true,
    // 必须裁剪：客户端全量重发历史，不设上限最终会撑爆上游请求体
    messages: trimHistory(context.messages),
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
  const idleMs = context.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  let timeout: ReturnType<typeof setTimeout> | undefined;
  // 每收到一块增量就重新计时，只有真正停止输出才中断（见 DEFAULT_TIMEOUT_MS 说明）
  const armTimeout = () => {
    clearTimeout(timeout);
    timeout = setTimeout(() => controller.abort(), idleMs);
  };
  armTimeout();

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

  const reader = response.body.getReader();
  try {
    const decoder = new TextDecoder();
    let buffer = "";
    for (;;) {
      let chunk: ReadableStreamReadResult<Uint8Array>;
      try {
        chunk = await reader.read();
      } catch (err) {
        // 读取中途被空闲超时 abort 时抛的是 AbortError，不转换的话
        // 上层会把它当成"上游异常"原样透出，排障时完全指错方向
        if (err instanceof Error && err.name === "AbortError") {
          throw new Error("AI 导师响应超时，请稍后重试。");
        }
        throw err;
      }
      if (chunk.done) break;
      armTimeout(); // 收到数据即续期：正在稳定输出的长回答不该被判为超时
      buffer += decoder.decode(chunk.value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        const text = extractDelta(line);
        if (text) yield text;
      }
    }
  } finally {
    clearTimeout(timeout);
    // 主动断开上游：调用方提前 return()（用户关页面 / 重新提问）时，
    // 只清定时器不取消 reader，上游连接会一直挂着继续计费。
    // 已正常读完时 cancel 是无害的 no-op。
    await reader.cancel().catch(() => {});
  }
}
