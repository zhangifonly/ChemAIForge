"use client";

// 实验分步讲解播放器（借鉴 mathviz 的口播 + 场景驱动）：按步确定性重放动作，
// 驱动 labStore 让立体烧杯随讲解自动演示。未参与讲解时不干预用户自由操作。
import { useEffect, useMemo, useState } from "react";
import { allExperiments } from "@/data/experiments";
import { useTutorBus } from "@/components/ai/tutorBus";
import { useLabStore } from "../labStore";
import { resolveSubstance } from "../reagents";
import { buildLesson } from "./buildLesson";
import { audioSrc, type VoiceRole } from "./audioKey";

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

  const { reset, addReagent, mix, setEnergized } = useLabStore();
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  // 是否已介入实验台（介入后才重放动作，避免打断用户自由操作）
  const [engaged, setEngaged] = useState(false);
  // 语音讲解：静音开关、倍速、音色（晓晓女声 / 云希男声，借鉴 mathviz）
  const [muted, setMuted] = useState(false);
  const [rate, setRate] = useState(1);
  const [voice, setVoice] = useState<VoiceRole>("xiaoxiao");

  // 确定性重放：从头执行到当前步，保证烧杯状态与讲解严格一致
  useEffect(() => {
    if (!engaged || steps.length === 0) return;
    reset();
    for (let i = 0; i <= index; i++) {
      const a = steps[i].action;
      if (!a) continue;
      if (a.kind === "add") addReagent(resolveSubstance(a.reagent));
      else if (a.kind === "mix") mix();
      else if (a.kind === "energize") setEnergized(true);
    }
  }, [index, engaged, steps, reset, addReagent, mix, setEnergized]);

  // 自动播放 + 语音讲解：优先播放预生成的高音质 mp3（edge-tts 晓晓），
  // mp3 缺失 / 加载失败时回退浏览器 speechSynthesis；都不可用则按字数计时推进。
  useEffect(() => {
    if (!playing) return;
    const advance = () =>
      setIndex((i) => {
        if (i >= steps.length - 1) {
          setPlaying(false);
          return i;
        }
        return i + 1;
      });

    const text = steps[index]?.narration ?? "";
    if (muted || !text) {
      if (index >= steps.length - 1) {
        setPlaying(false);
        return;
      }
      const t = window.setTimeout(advance, 4200);
      return () => clearTimeout(t);
    }

    let cancelled = false;
    let cleanup = () => {};

    // 回退：浏览器语音合成（音质较差，仅当 mp3 不可用时）
    const speakFallback = () => {
      const synth = typeof window !== "undefined" ? window.speechSynthesis : null;
      if (!synth) {
        const t = window.setTimeout(advance, Math.max(4000, text.length * 240));
        cleanup = () => clearTimeout(t);
        return;
      }
      synth.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = "zh-CN";
      u.rate = rate;
      u.onend = advance;
      synth.speak(u);
      const fb = window.setTimeout(advance, Math.max(4000, (text.length / rate) * 260));
      cleanup = () => {
        synth.cancel();
        clearTimeout(fb);
      };
    };

    // 优先：预生成 mp3
    const audio = new Audio(audioSrc(text, voice));
    audio.playbackRate = rate;
    audio.onended = advance;
    audio.onerror = () => {
      if (!cancelled) speakFallback();
    };
    audio
      .play()
      .then(() => {
        cleanup = () => {
          audio.pause();
          audio.src = "";
        };
      })
      .catch(() => {
        if (!cancelled) speakFallback();
      });

    return () => {
      cancelled = true;
      audio.onended = null;
      audio.onerror = null;
      audio.pause();
      cleanup();
    };
  }, [playing, index, muted, rate, voice, steps]);

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

      {/* 语音：静音开关 + 音色（晓晓♀/云希♂）+ 倍速 */}
      <div className="flex flex-wrap items-center justify-center gap-2 text-xs">
        <button
          type="button"
          onClick={() => setMuted((m) => !m)}
          className="flex items-center gap-1 rounded-full border border-foreground/15 px-2.5 py-1 text-foreground/70 transition-colors hover:border-brand-400/50 hover:bg-brand-500/5"
          title={muted ? "开启语音讲解" : "关闭语音讲解"}
        >
          {muted ? "🔇 已静音" : "🔊 语音讲解"}
        </button>
        {/* 音色切换 */}
        <div className="flex items-center gap-1 rounded-full bg-foreground/5 p-0.5">
          {([
            ["xiaoxiao", "晓晓♀"],
            ["yunxi", "云希♂"],
          ] as const).map(([v, label]) => (
            <button
              key={v}
              type="button"
              onClick={() => setVoice(v)}
              className={`rounded-full px-2 py-0.5 transition-colors ${
                voice === v
                  ? "bg-brand-500 text-white"
                  : "text-foreground/55 hover:text-foreground/80"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
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
