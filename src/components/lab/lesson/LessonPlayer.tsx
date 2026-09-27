"use client";

// 实验分步讲解播放器（借鉴 mathviz 的口播 + 场景驱动）：按步确定性重放动作，
// 驱动 labStore 让立体烧杯随讲解自动演示。未参与讲解时不干预用户自由操作。
import { useEffect, useMemo, useState } from "react";
import { allExperiments } from "@/data/experiments";
import { useTutorBus } from "@/components/ai/tutorBus";
import { useLabStore } from "../labStore";
import { resolveSubstance } from "../reagents";
import { buildLesson, type LessonContent } from "./buildLesson";
import { audioSrc, hasVoice, type VoiceGender } from "./audioKey";
import { estimateNarrationMs, speechLang } from "./speechTiming";
import { HEAT_THRESHOLD } from "@/lib/chem/engine";
import { useLocale, useTranslations } from "next-intl";

const PHASE_STYLE: Record<string, string> = {
  theory: "bg-brand-500/12 text-brand-600 dark:text-brand-300",
  prep: "bg-sky-500/12 text-sky-600 dark:text-sky-300",
  operate: "bg-amber-500/12 text-amber-600 dark:text-amber-300",
  observe: "bg-violet-500/12 text-violet-600 dark:text-violet-300",
  conclude: "bg-emerald-500/12 text-emerald-600 dark:text-emerald-300",
};

export function LessonPlayer({
  experimentSlug,
  content = {},
}: {
  experimentSlug: string;
  /** 本地化的实验描述 / 目标 / 术语译名，由服务端页面注入（客户端不能 await 装载） */
  content?: LessonContent;
}) {
  const t = useTranslations("lesson");
  const locale = useLocale();
  const tPhase = useTranslations("lesson.phase");
  const steps = useMemo(() => {
    const seed = allExperiments.find((e) => e.slug === experimentSlug);
    return seed ? buildLesson(seed, (k, v) => t(k, v), content) : [];
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
  // 按性别而非具体音色名选：60 个语种的音色名各不相同，
  // 界面上学生要选的本来也只是"男声/女声"
  const [voice, setVoice] = useState<VoiceGender>("female");

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
    // 拿不到音频时长时按字数估算（按文字系统区分系数，见 speechTiming）
    const estimateMs = () => estimateNarrationMs(text, rate);

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
      // 必须跟随当前语言：写死 zh-CN 会让浏览器用中文发音去念日文、德文，
      // 读出来的东西没人听得懂。51 个 basic 语种全靠这条回退路径出声。
      u.lang = speechLang(locale);
      u.rate = rate;
      u.onend = advance;
      synth.speak(u);
      armWatchdog(estimateMs());
      cleanup = () => synth.cancel();
    };

    /**
     * 中间一级：请服务端按需合成。
     *
     * 预生成的 mp3 只覆盖中文（57 语种 × 双声共 8.8 GB，放不进仓库也放不进
     * 部署机），其余语种靠这条路出声。合成约 1.6 秒，故播完当前一步就预取
     * 下一步（见 prefetch），听起来是连续的。
     * 服务端说 501（无音色）或 503（繁忙）就继续退到浏览器语音。
     */
    const synthViaServer = async () => {
      if (fellBack || cancelled) return;
      // 没有音色的语种服务端必回 501，直接走浏览器语音，省一次往返
      if (!hasVoice(locale)) {
        speakFallback();
        return;
      }
      try {
        const res = await fetch("/api/tts", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ text, locale, gender: voice }),
        });
        if (!res.ok) throw new Error(String(res.status));
        const blob = await res.blob();
        if (cancelled || fellBack) return;
        playAudio(URL.createObjectURL(blob), true);
      } catch {
        speakFallback();
      }
    };

    // 统一的播放装配：静态 mp3 与服务端合成的 blob 共用
    function playAudio(src: string, isBlob = false) {
      const audio = new Audio(src);
      audio.playbackRate = rate;
      audio.onended = advance;
      audio.onerror = () => {
        if (cancelled) return;
        // 静态文件不存在时走服务端合成；blob 都播不了就只能靠浏览器语音
        if (isBlob) speakFallback();
        else void synthViaServer();
      };
      const armPlaybackWatchdog = () => {
        if (fellBack) return;
        armWatchdog(
          Number.isFinite(audio.duration)
            ? (audio.duration / rate) * 1000 + 3000
            : estimateMs() + 3000,
        );
      };
      audio.onloadedmetadata = armPlaybackWatchdog;
      audio.play().then(armPlaybackWatchdog).catch(() => {
        if (cancelled) return;
        if (isBlob) speakFallback();
        else void synthViaServer();
      });
      cleanup = () => {
        // 必须解绑：不解绑的话已被替换掉的音频播完仍会 advance 一次，
        // 讲解会凭空跳步
        audio.onended = null;
        audio.onerror = null;
        audio.onloadedmetadata = null;
        audio.pause();
        if (isBlob) URL.revokeObjectURL(src);
      };
    }

    // 优先：预生成的静态 mp3（中文已全量生成）。取不到就走服务端按需合成。
    playAudio(audioSrc(text, voice, locale));

    // 预取下一步：按需合成要约 1.6 秒，播这一步时先把下一句备好，
    // 翻页时就能直接命中服务端缓存（实测 4ms）。
    // 只预取、不播放，失败静默忽略 —— 它只是优化，不该影响当前播放。
    const nextStep = steps[index + 1];
    if (nextStep && !muted && hasVoice(locale)) {
      void fetch("/api/tts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text: nextStep.narration, locale, gender: voice }),
      }).catch(() => {});
    }

    return () => {
      cancelled = true;
      clearTimeout(watchdog);
      // 音频句柄由 playAudio 持有，停止与释放 blob 都在它设的 cleanup 里
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
          {t("cardTitle")}
        </h2>
        <span className="text-xs tabular-nums text-foreground/65">
          {index + 1} / {steps.length}
        </span>
      </div>

      {/* 当前步：阶段标签 + 标题 + 字幕 */}
      <div className="flex flex-col gap-2 rounded-xl bg-gradient-to-br from-brand-500/[0.06] to-transparent p-4">
        <div className="flex items-center gap-2">
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-medium ${PHASE_STYLE[step.phase]}`}
          >
            {tPhase(step.phase)}
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
                t("askTutor", { title: step.title, narration: step.narration }),
              )
          }
          className="mt-1 inline-flex w-fit items-center gap-1 rounded-full border border-brand-400/40 bg-brand-500/5 px-3 py-1 text-xs font-medium text-brand-600 transition-colors hover:bg-brand-500/12 dark:text-brand-300"
        >
          🤖 {t("askTutorButton")}
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
            className={`relative h-5 flex-1 rounded-full before:absolute before:inset-x-0 before:top-1/2 before:h-1.5 before:-translate-y-1/2 before:rounded-full before:transition-colors ${
              i <= index ? "before:bg-brand-500" : "before:bg-foreground/12 hover:before:bg-foreground/25"
            }`}
          />
        ))}
      </div>

      {/* 控制条 */}
      <div className="flex items-center justify-center gap-2">
        <CtrlButton onClick={() => go(index - 1)} disabled={index === 0} label={t("prev")}>
          ‹
        </CtrlButton>
        <button
          type="button"
          onClick={togglePlay}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-r from-brand-500 to-brand-600 text-white shadow-soft transition-transform hover:scale-105 active:scale-95"
          title={playing ? t("pause") : t("play")}
        >
          {playing ? "❚❚" : "▶"}
        </button>
        <CtrlButton
          onClick={() => go(index + 1)}
          disabled={index >= steps.length - 1}
          label={t("next")}
        >
          ›
        </CtrlButton>
      </div>

      {/* 语音：静音开关 + 音色（女声 / 男声）+ 倍速。
          edge-tts 没有音色的语种（亚美尼亚语、旁遮普语、菲律宾语）不显示音色选择：
          那里只能靠浏览器内置语音，多数系统也没有这几种，选男声女声都不会出声。
          如实告诉用户"本语言暂无语音、讲解按字幕自动推进"，比给一组点了没反应的按钮好 */}
      {!hasVoice(locale) ? (
        <p className="text-center text-[11px] text-foreground/65">{t("noVoice")}</p>
      ) : null}
      {/* 旁遮普语语音来自 CC-BY-SA 4.0 模型，许可要求署名（见 THIRD_PARTY_NOTICES.md） */}
      {locale === "pa" ? (
        <p className="text-center text-[11px] sm:text-[10px] text-foreground/65">
          Voice: VITS Open Bible — Punjabi (CC BY-SA 4.0)
        </p>
      ) : null}
      <div
        className={`flex flex-wrap items-center justify-center gap-2 text-xs ${
          hasVoice(locale) ? "" : "hidden"
        }`}
      >
        <button
          type="button"
          onClick={() => setMuted((m) => !m)}
          className="flex items-center gap-1 rounded-full border border-foreground/15 px-3 py-1.5 text-foreground/70 sm:px-2.5 sm:py-1 transition-colors hover:border-brand-400/50 hover:bg-brand-500/5"
          title={muted ? t("voiceOn") : t("voiceOff")}
        >
          {muted ? t("muted") : t("voiceLabel")}
        </button>
        {/* 音色切换 */}
        <div className="flex items-center gap-1 rounded-full bg-foreground/5 p-0.5">
          {([
            ["female", t("voiceFemale")],
            ["male", t("voiceMale")],
          ] as const).map(([v, label]) => (
            <button
              key={v}
              type="button"
              onClick={() => setVoice(v)}
              className={`rounded-full px-2.5 py-1.5 transition-colors sm:px-2 sm:py-0.5 ${
                voice === v
                  ? "bg-brand-500 text-white"
                  : "text-foreground/65 hover:text-foreground/80"
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
              className={`rounded-full px-2.5 py-1.5 tabular-nums transition-colors sm:px-2 sm:py-0.5 ${
                rate === s
                  ? "bg-brand-500 text-white"
                  : "text-foreground/65 hover:text-foreground/80"
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
