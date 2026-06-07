"use client";

// AI 导师对话的流式请求 hook：向 /api/ai/tutor 发送 POST，
// 解析 SSE（data: {text} / data: [DONE] / event: error）并将增量文本
// 逐步回传给调用方，由其拼接到对话气泡中。
import { useCallback, useRef, useState } from "react";

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
            const detail = line ? JSON.parse(line.slice(5)).detail : "未知错误";
            throw new Error(detail);
          }
          const dataLine = evt.split("\n").find((l) => l.startsWith("data:"));
          if (!dataLine) continue;
          const payload = dataLine.slice(5).trim();
          if (payload === "[DONE]") continue;
          const text = JSON.parse(payload).text as string;
          full += text;
          onDelta(full);
        }
      }
      return full;
    } catch (err) {
      if ((err as Error).name === "AbortError") return null;
      setError(err instanceof Error ? err.message : String(err));
      return null;
    } finally {
      setStreaming(false);
    }
  }, []);

  return { send, streaming, error };
}
