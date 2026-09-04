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
import { HEAT_THRESHOLD } from "@/lib/chem/engine";

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

  const { reset, addReagent, mix, setEnergized, setTemperature } = useLabStore();
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  // 是否已介入实验台（介入后才重放动作，避免打断用户自由操作）
  const [engaged, setEngaged] = useState(false);

  // 切换实验时把进度归零。App Router 在同位置复用本组件、状态不会自动丢弃：
  // 各实验讲解步数不同，从步数多的实验切到步数少的，steps[index] 会是 undefined，
  // 下面渲染 step.phase 就直接抛错白屏。用渲染期同步状态（React 官方模式），
  // 放到 useEffect 里则本次渲染仍会拿到越界下标。
  const [prevSlug, setPrevSlug] = useState(experimentSlug);
  if (prevSlug !== experimentSlug) {
    setPrevSlug(experimentSlug);
    setIndex(0);
    setPlaying(false);
    setEngaged(false);
  }
  // 语音讲解：静音开关、倍速、音色（晓晓女声 / 云希男声，借鉴 mathviz）
  const [muted, setMuted] = useState(false);
  const [rate, setRate] = useState(1);
  const [voice, setVoice] = useState<VoiceRole>("xiaoxiao");

  // 确定性重放：从头执行到当前步，保证烧杯状态与讲解严格一致。
  //
  // 全程静默：这些是演示动作，不是学生操作。每前进一步都要从头重放，
  // 不静默的话一次完整播放就往会话灌几十条 reset/add/mix（实测平均 27 条、
  // 最多 74 条），AI 报告里全是机械重复，学生真正做了什么反而被淹没。
  useEffect(() => {
    if (!engaged || steps.length === 0) return;
    const { setSilent } = useLabStore.getState();
    setSilent(true);
    try {
      reset();
      for (let i = 0; i <= index; i++) {
        const a = steps[i].action;
        if (!a) continue;
        if (a.kind === "add") addReagent(resolveSubstance(a.reagent));
        // 加热排在混合之前，此时 result 仍为 null，不会触发 setTemperature 里的重算
        else if (a.kind === "heat") setTemperature(HEAT_THRESHOLD + 20);
        else if (a.kind === "mix") mix();
        else if (a.kind === "energize") setEnergized(true);
      }
    } finally {
      // 必须 finally：中途抛错而标志留在 true，之后学生自己的操作就一条都记不上了
      setSilent(false);
    }
  }, [index, engaged, steps, reset, addReagent, mix, setEnergized, setTemperature]);

  // 自动播放 + 语音讲解：优先播放预生成的高音质 mp3（edge-tts 晓晓），
  // mp3 缺失 / 加载失败时回退浏览器 speechSynthesis；都不可用则按字数计时推进。
  useEffect(() => {
    if (!playing) return;
    // 一步只推进一次：onended 与兜底定时器可能先后都触发（音频正常放完、
    // 定时器随后到点），各调一次 advance 就会一口气跳过两步讲解。
    let advanced = false;
    const advance = () => {
      if (advanced) return;
      advanced = true;
      setIndex((i) => {
        if (i >= steps.length - 1) {
          setPlaying(false);
          return i;
        }
        return i + 1;
      });
    };

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
    let fellBack = false;

    // 统一的兜底定时器：三条播放路径（mp3 / 语音合成 / 纯计时）共用一个，
    // 保证任何一条卡住时讲解都能继续，且同时只存在一个待触发的定时器。
    let watchdog = 0;
    const armWatchdog = (ms: number) => {
      clearTimeout(watchdog);
      watchdog = window.setTimeout(advance, ms);
    };
    // 拿不到音频时长时按字数估算播放时长（中文约每字 260ms，随倍速缩放）
    const estimateMs = () => Math.max(4000, (text.length / rate) * 260);

    // 回退：浏览器语音合成（音质较差，仅当 mp3 不可用时）
    const speakFallback = () => {
      // mp3 缺失时 error 事件与 play() 的 rejection 会各触发一次回退。
      // 不加这道闸就会起两个 utterance + 两个兜底定时器，而 cleanup 只留得下后赋值的那个，
      // 前一个定时器无人清理，稍后自行 advance 一次 —— 讲解凭空跳掉一步。
      if (fellBack) return;
      fellBack = true;
      const synth = typeof window !== "undefined" ? window.speechSynthesis : null;
      if (!synth) {
        armWatchdog(estimateMs()); // 没有语音合成能力，退化成纯计时推进
        return;
      }
      synth.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = "zh-CN";
      u.rate = rate;
      u.onend = advance;
      synth.speak(u);
      armWatchdog(estimateMs());
      cleanup = () => synth.cancel();
    };

    // 优先：预生成 mp3
    const audio = new Audio(audioSrc(text, voice));
    audio.playbackRate = rate;
    audio.onended = advance;
    audio.onerror = () => {
      if (!cancelled) speakFallback();
    };
    // mp3 播到一半卡住时 onended 与 onerror 都不会再触发（播放已经开始过），
    // 没有兜底就永久停在这一步、而按钮还显示"播放中"。另两条路径本来就有
    // 定时器兜底，唯独这条没有。
    // 时长已知就按真实长度算（留 3 秒余量，绝不能早于音频自然结束），否则按字数估。
    // loadedmetadata 与 play() 谁先谁后不定，故两处共用一个函数：后执行的那次
    // 总能用上更准的 duration，不会把已校准的值覆盖回粗糙的估算。
    const armPlaybackWatchdog = () => {
      if (fellBack) return;
      armWatchdog(
        Number.isFinite(audio.duration)
          ? (audio.duration / rate) * 1000 + 3000
          : estimateMs() + 3000,
      );
    };
    audio.onloadedmetadata = armPlaybackWatchdog;
    audio
      .play()
      .then(() => {
        armPlaybackWatchdog();
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
      clearTimeout(watchdog);
      audio.onended = null;
      audio.onerror = null;
      audio.onloadedmetadata = null;
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
  // 兜底：下标越界时退回首步，而不是让 step.phase 抛错把整页打成白屏
  const step = steps[index] ?? steps[0];

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
