"use client";

// AI 导师对话面板：渲染对话气泡、输入框与流式打字效果，调用 /api/ai/tutor，
// 并把当前 LabCanvas 状态（来自全局 labStore）作为 labState 一并发送。
// 画布关键反应事件（沉淀/气体/变色）会自动触发一条情境提示询问。
import { useCallback, useEffect, useRef, useState } from "react";
import { useLabStore } from "@/components/lab/labStore";
import { useTutorStream, type ChatMessage } from "./useTutorStream";
import { buildLabState, contextualPrompt } from "./labContext";

export function TutorChat({ experimentSlug }: { experimentSlug: string }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const { send, streaming, error } = useTutorStream();
  const scrollRef = useRef<HTMLDivElement>(null);

  // 把累计的助手文本写入最后一条助手气泡
  const onDelta = useCallback((full: string) => {
    setMessages((prev) => {
      const next = [...prev];
      next[next.length - 1] = { role: "assistant", content: full };
      return next;
    });
  }, []);

  // 发送一条用户消息：先落用户气泡+空助手气泡，再发起流式请求
  const submit = useCallback(
    async (text: string) => {
      const content = text.trim();
      if (!content || streaming) return;
      const history: ChatMessage[] = [
        ...messages,
        { role: "user", content },
      ];
      setMessages([...history, { role: "assistant", content: "" }]);
      // 取发送时刻的画布快照，避免闭包过期
      const labState = buildLabState(useLabStore.getState());
      await send({ experimentSlug, messages: history, labState, onDelta });
    },
    [messages, streaming, send, experimentSlug, onDelta],
  );

  // 监听画布关键反应事件，自动追加一条情境提示询问（每个结果仅触发一次）
  const lastResultRef = useRef<unknown>(null);
  useEffect(() => {
    return useLabStore.subscribe((state) => {
      const { result } = state;
      if (!result || result === lastResultRef.current) return;
      lastResultRef.current = result;
      const prompt = contextualPrompt(result);
      if (prompt) void submit(prompt);
    });
  }, [submit]);

  // 新消息或流式增量时滚到底部
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages]);

  return (
    <div className="flex h-full flex-col gap-3 rounded-2xl border border-foreground/15 bg-foreground/[0.02] p-4">
      <h2 className="text-sm font-semibold text-foreground/70">AI 实验导师</h2>

      <div
        ref={scrollRef}
        className="flex-1 space-y-3 overflow-y-auto pr-1"
        aria-live="polite"
      >
        {messages.length === 0 && (
          <p className="text-xs text-foreground/40">
            随时向我提问，或在画布中触发反应后我会主动提示。
          </p>
        )}
        {messages.map((m, i) => (
          <Bubble key={i} role={m.role} content={m.content} />
        ))}
        {error && (
          <p className="rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-600 dark:text-red-300">
            {error}
          </p>
        )}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit(input);
          setInput("");
        }}
        className="flex gap-2"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="输入你的问题…"
          className="min-w-0 flex-1 rounded-lg border border-foreground/20 bg-background px-3 py-2 text-sm outline-none focus:border-foreground/40"
        />
        <button
          type="submit"
          disabled={streaming || !input.trim()}
          className="rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {streaming ? "回复中…" : "发送"}
        </button>
      </form>
    </div>
  );
}

// 单条对话气泡：用户右对齐、助手左对齐；空助手内容显示打字光标
function Bubble({ role, content }: ChatMessage) {
  const isUser = role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm ${
          isUser
            ? "bg-foreground text-background"
            : "bg-foreground/8 text-foreground"
        }`}
      >
        {content || <span className="animate-pulse">▍</span>}
      </div>
    </div>
  );
}
