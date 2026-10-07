"use client";

// 碘钟面板：A 液配方（KI、Na2S2O3 浓度，是否加淀粉）、B 液 H2O2 浓度、恒温温度、
// 倒入开始 / 停止 / 再做一次。纯展示组件，状态由 ClockLab 持有。
import { useTranslations } from "next-intl";
import { Card, CompleteBlock, Row, Seg, ghostBtn, primaryBtn } from "../showcase/ui";
import { inductionTime, type ClockParams } from "./model";
import type { ClockPhase } from "./ClockScene";

const KI = [0.02, 0.03, 0.05, 0.08, 0.1] as const;
const H2O2 = [0.03, 0.05, 0.08] as const;
const THIO = [0.0025, 0.005, 0.01, 0.1] as const;
const SPEEDS = [1, 4] as const;

export interface ClockPanelProps {
  params: ClockParams;
  phase: ClockPhase;
  speed: number;
  elapsed: number;
  overdue: boolean;
  hasRuns: boolean;
  onParams: (p: Partial<ClockParams>) => void;
  onSpeed: (s: number) => void;
  onPour: () => void;
  onStop: () => void;
  onAgain: () => void;
  onReset: () => void;
}

export function ClockPanel(p: ClockPanelProps) {
  const t = useTranslations("clockLab");
  const ready = p.phase === "ready";
  const q = p.params;
  const tStar = inductionTime(q);
  return (
    <aside className="flex min-w-0 flex-col gap-4">
      <Card title={t("setup")}>
        <Field label={t("ki")}>
          <Seg options={KI} value={q.ki as (typeof KI)[number]} onChange={(ki) => p.onParams({ ki })} disabled={!ready} label={(v) => v.toFixed(2)} />
        </Field>
        <Field label={t("thio")}>
          <Seg options={THIO} value={q.thio as (typeof THIO)[number]} onChange={(thio) => p.onParams({ thio })} disabled={!ready} label={(v) => String(v)} />
        </Field>
        <Field label={t("h2o2")}>
          <Seg options={H2O2} value={q.h2o2 as (typeof H2O2)[number]} onChange={(h2o2) => p.onParams({ h2o2 })} disabled={!ready} label={(v) => v.toFixed(2)} />
        </Field>
        <label className="flex flex-col gap-1.5">
          <span className="flex justify-between text-xs text-foreground/65">
            <span>{t("temp")}</span>
            <span className="font-mono tabular-nums text-foreground/85">{q.tempC} ℃</span>
          </span>
          <input type="range" min={10} max={50} step={5} value={q.tempC} disabled={!ready}
            onChange={(e) => p.onParams({ tempC: Number(e.target.value) })} className="h-8 accent-brand-500" />
        </label>
        <label className="flex items-center gap-2 text-xs">
          <input type="checkbox" checked={q.starch} disabled={!ready} onChange={(e) => p.onParams({ starch: e.target.checked })} className="accent-brand-500" />
          {t("starch")}
        </label>
        <span className="text-xs text-foreground/65">{t("speed")}</span>
        <Seg options={SPEEDS} value={p.speed as (typeof SPEEDS)[number]} onChange={p.onSpeed} label={(s) => `${s}×`} />
        {ready ? (
          <button type="button" onClick={p.onPour} className={primaryBtn()}>⏱ {t("pour")}</button>
        ) : p.phase === "done" ? (
          <button type="button" onClick={p.onAgain} className={primaryBtn()}>↻ {t("again")}</button>
        ) : (
          <button type="button" onClick={p.onStop} disabled={p.phase !== "running"} className={`${ghostBtn} border-rose-400/50`}>⏹ {t("stop")}</button>
        )}
        <button type="button" onClick={p.onReset} className={ghostBtn}>{t("reset")}</button>
      </Card>

      <Card title={t("readings")} dark>
        <Row label={t("stopwatch")} value={<span data-testid="clock-time">{p.elapsed.toFixed(1)} s</span>} accent />
        {/* 理论值做完才揭晓，免得学生照着数字按秒表 */}
        {p.phase === "done" ? <Row label={t("theory")} value={Number.isFinite(tStar) ? `${tStar.toFixed(1)} s` : "∞"} /> : null}
        <div className="mt-1 flex flex-col gap-0.5 border-t border-white/10 pt-2 font-mono text-[11px] text-slate-300">
          <span>H₂O₂ + 2I⁻ + 2H⁺ → I₂ + 2H₂O <span className="text-slate-500">({t("slow")})</span></span>
          <span>I₂ + 2S₂O₃²⁻ → 2I⁻ + S₄O₆²⁻ <span className="text-slate-500">({t("fast")})</span></span>
        </div>
        {!Number.isFinite(tStar) ? <p className="rounded-lg bg-amber-500/15 px-2 py-1.5 text-xs text-amber-200">{t("excessThio")}</p> : null}
        {p.overdue ? <p className="rounded-lg bg-amber-500/15 px-2 py-1.5 text-xs text-amber-200">{t("overdue")}</p> : null}
        {!q.starch ? <p className="text-[11px] text-slate-400">{t("noStarch")}</p> : null}
      </Card>

      <section className="flex flex-col gap-2">
        <CompleteBlock ready={p.hasRuns} />
      </section>
    </aside>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs text-foreground/65">{label}</span>
      {children}
    </div>
  );
}
