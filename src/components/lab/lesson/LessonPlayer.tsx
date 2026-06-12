"use client";

// 实验分步讲解播放器（借鉴 mathviz 的口播 + 场景驱动）：按步确定性重放动作，
// 驱动 labStore 让立体烧杯随讲解自动演示。未参与讲解时不干预用户自由操作。
import { useEffect, useMemo, useState } from "react";
import { allExperiments } from "@/data/experiments";
import { useTutorBus } from "@/components/ai/tutorBus";
import { useLabStore } from "../labStore";
import { resolveSubstance } from "../reagents";
import { buildLesson } from "./buildLesson";

const PHASE_STYLE: Record<string, string> = {
  原理: "bg-brand-500/12 text-brand-600 dark:text-brand-300",
  准备: "bg-sky-500/12 text-sky-600 dark:text-sky-300",
  操作: "bg-amber-500/12 text-amber-600 dark:text-amber-300",
  现象: "bg-violet-500/12 text-violet-600 dark:text-violet-300",
  结论: "bg-emerald-500/12 text-emerald-600 dark:text-emerald-300",
};

export function LessonPlayer({ experimentSlug }: { experimentSlug: string }) {
  const steps = useMemo(() => {
    const seed = allExperiments.find((e) => e.slug === experimentSlug);
    return seed ? buildLesson(seed) : [];
  }, [experimentSlug]);

  const { reset, addReagent, mix } = useLabStore();
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  // 是否已介入实验台（介入后才重放动作，避免打断用户自由操作）
  const [engaged, setEngaged] = useState(false);
  // 语音讲解：静音开关与倍速（借鉴 mathviz 的语音 + 速度）
  const [muted, setMuted] = useState(false);
  const [rate, setRate] = useState(1);

  // 确定性重放：从头执行到当前步，保证烧杯状态与讲解严格一致
  useEffect(() => {
    if (!engaged || steps.length === 0) return;
    reset();
    for (let i = 0; i <= index; i++) {
      const a = steps[i].action;
      if (!a) continue;
      if (a.kind === "add") addReagent(resolveSubstance(a.reagent));
      else if (a.kind === "mix") mix();
    }
  }, [index, engaged, steps, reset, addReagent, mix]);

  // 自动播放 + 语音讲解：朗读当前步口播，读完即推进；无语音时按固定节奏推进。
  useEffect(() => {
    if (!playing) return;
    const last = index >= steps.length - 1;
    const advance = () =>
      setIndex((i) => {
        if (i >= steps.length - 1) {
          setPlaying(false);
          return i;
        }
        return i + 1;
      });

    const synth =
      typeof window !== "undefined" ? window.speechSynthesis : null;
    const text = steps[index]?.narration ?? "";

    if (synth && !muted && text) {
      synth.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = "zh-CN";
      u.rate = rate;
      u.onend = advance;
      synth.speak(u);
      // 兜底：若 onend 异常未触发，按字数估算时长后推进
      const fallback = window.setTimeout(
        advance,
        Math.max(4000, (text.length / rate) * 260),
      );
      return () => {
        synth.cancel();
        clearTimeout(fallback);
      };
    }

    if (last) {
      setPlaying(false);
      return;
    }
    const t = window.setTimeout(advance, 4200);
    return () => clearTimeout(t);
  }, [playing, index, muted, rate, steps]);

  // 卸载时停止朗读
  useEffect(() => {
    return () => {
      if (typeof window !== "undefined") window.speechSynthesis?.cancel();
    };
  }, []);

  if (steps.length === 0) return null;
  const step = steps[index];

  const go = (next: number) => {
    setEngaged(true);
    setIndex(Math.max(0, Math.min(steps.length - 1, next)));
  };
  const togglePlay = () => {
    setEngaged(true);
    if (index >= steps.length - 1) setIndex(0);
    setPlaying((p) => !p);
  };

  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-foreground/10 bg-surface/70 p-5 shadow-soft backdrop-blur">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground/75">
          <span className="h-4 w-1 rounded-full bg-gradient-to-b from-brand-400 to-brand-600" />
          实验讲解
        </h2>
        <span className="text-xs tabular-nums text-foreground/45">
          {index + 1} / {steps.length}
        </span>
      </div>

      {/* 当前步：阶段标签 + 标题 + 字幕 */}
      <div className="flex flex-col gap-2 rounded-xl bg-gradient-to-br from-brand-500/[0.06] to-transparent p-4">
        <div className="flex items-center gap-2">
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-medium ${PHASE_STYLE[step.phase]}`}
          >
            {step.phase}
          </span>
          <span className="text-sm font-medium">{step.title}</span>
        </div>
        <p className="text-sm leading-relaxed text-foreground/80">
          {step.narration}
        </p>
        <button
          type="button"
          onClick={() =>
            useTutorBus
              .getState()
              .ask(
                `讲解到「${step.title}」这一步：${step.narration} 请结合此刻烧杯里的现象与读数，简明讲解其中的化学原理与方程式。`,
              )
          }
          className="mt-1 inline-flex w-fit items-center gap-1 rounded-full border border-brand-400/40 bg-brand-500/5 px-3 py-1 text-xs font-medium text-brand-600 transition-colors hover:bg-brand-500/12 dark:text-brand-300"
        >
          🤖 让导师讲讲这一步
        </button>
      </div>

      {/* 进度点 */}
      <div className="flex flex-wrap gap-1.5">
        {steps.map((s, i) => (
          <button
            key={s.id}
            type="button"
            onClick={() => go(i)}
            title={`${s.phase} · ${s.title}`}
            className={`h-1.5 flex-1 rounded-full transition-colors ${
              i <= index ? "bg-brand-500" : "bg-foreground/12 hover:bg-foreground/25"
            }`}
          />
        ))}
      </div>

      {/* 控制条 */}
      <div className="flex items-center justify-center gap-2">
        <CtrlButton onClick={() => go(index - 1)} disabled={index === 0} label="上一步">
          ‹
        </CtrlButton>
        <button
          type="button"
          onClick={togglePlay}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-r from-brand-500 to-brand-600 text-white shadow-soft transition-transform hover:scale-105 active:scale-95"
          title={playing ? "暂停" : "播放"}
        >
          {playing ? "❚❚" : "▶"}
        </button>
        <CtrlButton
          onClick={() => go(index + 1)}
          disabled={index >= steps.length - 1}
          label="下一步"
        >
          ›
        </CtrlButton>
      </div>

      {/* 语音：静音开关 + 倍速 */}
      <div className="flex items-center justify-center gap-3 text-xs">
        <button
          type="button"
          onClick={() => setMuted((m) => !m)}
          className="flex items-center gap-1 rounded-full border border-foreground/15 px-2.5 py-1 text-foreground/70 transition-colors hover:border-brand-400/50 hover:bg-brand-500/5"
          title={muted ? "开启语音讲解" : "关闭语音讲解"}
        >
          {muted ? "🔇 已静音" : "🔊 语音讲解"}
        </button>
        <div className="flex items-center gap-1 rounded-full bg-foreground/5 p-0.5">
          {[0.75, 1, 1.25, 1.5].map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setRate(s)}
              className={`rounded-full px-2 py-0.5 tabular-nums transition-colors ${
                rate === s
                  ? "bg-brand-500 text-white"
                  : "text-foreground/55 hover:text-foreground/80"
              }`}
            >
              {s}×
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

// 圆角方向按钮
function CtrlButton({
  onClick,
  disabled,
  label,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      className="flex h-9 w-9 items-center justify-center rounded-full border border-foreground/15 text-lg text-foreground/70 transition-colors hover:border-brand-400/50 hover:bg-brand-500/5 disabled:cursor-not-allowed disabled:opacity-30"
    >
      {children}
    </button>
  );
}
