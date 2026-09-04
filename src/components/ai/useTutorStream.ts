"use client";

// AI 导师对话的流式请求 hook：向 /api/ai/tutor 发送 POST，
// 解析 SSE（data: {text} / data: [DONE] / event: error）并将增量文本
// 逐步回传给调用方，由其拼接到对话气泡中。
import { useCallback, useEffect, useRef, useState } from "react";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface SendArgs {
  experimentSlug: string;
  messages: ChatMessage[];
  labState?: Record<string, unknown>;
  // 每次收到增量文本时回调（累计后的完整助手文本）
  onDelta: (full: string) => void;
}

// 解析一条 data 载荷里的增量文本；非法 JSON / 无 text 字段返回 null 表示"跳过"
export function parseText(payload: string): string | null {
  try {
    const obj = JSON.parse(payload) as { text?: unknown };
    return typeof obj.text === "string" ? obj.text : null;
  } catch {
    return null;
  }
}

// 解析 error 事件的 detail，缺失或非法时给出可读兜底
export function parseDetail(payload: string | undefined): string {
  if (!payload) return "未知错误";
  try {
    const obj = JSON.parse(payload) as { detail?: unknown };
    return typeof obj.detail === "string" ? obj.detail : "未知错误";
  } catch {
    return "未知错误";
  }
}

export function useTutorStream() {
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const send = useCallback(async (args: SendArgs) => {
    const { experimentSlug, messages, labState, onDelta } = args;
    setError(null);
    setStreaming(true);
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;

    try {
      const res = await fetch("/api/ai/tutor", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ experimentSlug, messages, labState }),
        signal: ac.signal,
      });

      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? `请求失败（${res.status}）`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let full = "";

      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        // 按 SSE 事件分隔（空行），逐条解析
        const events = buffer.split("\n\n");
        buffer = events.pop() ?? "";
        for (const evt of events) {
          if (evt.startsWith("event: error")) {
            const line = evt.split("\n").find((l) => l.startsWith("data:"));
            throw new Error(parseDetail(line?.slice(5)));
          }
          const dataLine = evt.split("\n").find((l) => l.startsWith("data:"));
          if (!dataLine) continue;
          const payload = dataLine.slice(5).trim();
          if (payload === "[DONE]") continue;
          // 解析失败只跳过这一条，不能让整轮对话中断：中间网关可能插入
          // 心跳注释或把一个事件截断，此时已收到的正文应当保留。
          const text = parseText(payload);
          if (text === null) continue;
          full += text;
          // 已被新一轮取代（abort 到达前仍可能读出缓冲里的事件）时停止回写，
          // 否则旧轮的文本会覆盖新轮气泡的内容。
          if (abortRef.current !== ac) return full;
          onDelta(full);
        }
      }
      return full;
    } catch (err) {
      if ((err as Error).name === "AbortError") return null;
      // 已被新一轮取代时不要覆盖新轮的状态
      if (abortRef.current !== ac) return null;
      setError(err instanceof Error ? err.message : String(err));
      return null;
    } finally {
      // 仅当自己仍是最新一轮时才置回空闲：上一轮被 abort 后其 finally 照样会执行，
      // 若无条件 setStreaming(false)，新一轮刚设的 true 会被旧轮抹掉，
      // 界面显示已空闲而实际仍在流式输出，用户可重复发送导致气泡串台。
      if (abortRef.current === ac) setStreaming(false);
    }
  }, []);

  // 主动中断在途请求（换实验时由调用方触发）
  const cancel = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setStreaming(false);
  }, []);

  // 卸载时中断在途请求：原先只在下一轮 send 时 abort，用户离开实验台（返回列表、
  // 关标签）后这轮流式请求仍挂着 —— 上游 AI 继续生成并计费，onDelta 也还在
  // setState 到已卸载的组件上。
  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  return { send, streaming, error, cancel };
}
