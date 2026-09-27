"use client";

// 电解实验台左侧面板：参数、开关、实时读数、称量。
// 纯展示组件，状态全部由 ElectrolysisLab 持有。
import { useTranslations } from "next-intl";
import { Link } from "@/lib/i18n/navigation";
import { useLabStore } from "../../labStore";
import {
  CURRENT_RANGE,
  TIME_SCALES,
  type AnodeMaterial,
  type ElectrolysisReadings,
  type ElectrolysisState,
} from "./model";

export interface ElectrolysisPanelProps {
  state: ElectrolysisState;
  readings: ElectrolysisReadings;
  anode: AnodeMaterial;
  current: number;
  timeScale: number;
  energized: boolean;
  microView: boolean;
  depleted: boolean;
  weighed: { measuredG: number; efficiency: number } | null;
  onAnode: (a: AnodeMaterial) => void;
  onCurrent: (a: number) => void;
  onTimeScale: (s: number) => void;
  onTogglePower: () => void;
  onMicroView: () => void;
  onWeigh: () => void;
  onReset: () => void;
}

export function ElectrolysisPanel(p: ElectrolysisPanelProps) {
  const t = useTranslations("electrolysisLab");
  const complete = useLabStore((s) => s.complete);
  const completed = useLabStore((s) => s.completed);
  const sessionId = useLabStore((s) => s.sessionId);
  const r = p.readings;
  const ran = p.state.chargeC > 0;

  return (
    <aside className="flex min-w-0 flex-col gap-4">
      {/* —— 参数 —— */}
      <section className="flex flex-col gap-3 rounded-2xl border border-foreground/10 bg-surface/60 p-4">
        <h3 className="text-sm font-semibold text-foreground/80">{t("setup")}</h3>

        <div className="flex flex-col gap-1.5">
          <span className="text-xs text-foreground/65">{t("anodeMaterial")}</span>
          <div className="grid grid-cols-2 gap-1.5">
            {(["graphite", "copper"] as const).map((a) => (
              <button
                key={a}
                type="button"
                aria-pressed={p.anode === a}
                onClick={() => p.onAnode(a)}
                className={`rounded-lg border px-2 py-2 text-xs font-medium transition ${
                  p.anode === a
                    ? "border-brand-500 bg-brand-500 text-white"
                    : "border-foreground/15 text-foreground/75 hover:border-brand-400/50"
                }`}
              >
                {t(`anode.${a}`)}
              </button>
            ))}
          </div>
        </div>

        <label className="flex flex-col gap-1.5">
          <span className="flex justify-between text-xs text-foreground/65">
            <span>{t("current")}</span>
            <span className="font-mono tabular-nums text-foreground/85">{p.current.toFixed(1)} A</span>
          </span>
          <input
            type="range"
            min={CURRENT_RANGE.min}
            max={CURRENT_RANGE.max}
            step={CURRENT_RANGE.step}
            value={p.current}
            onChange={(e) => p.onCurrent(Number(e.target.value))}
            className="h-8 accent-brand-500"
          />
        </label>

        <div className="flex flex-col gap-1.5">
          <span className="text-xs text-foreground/65">{t("timeScale")}</span>
          <div className="grid grid-cols-4 gap-1">
            {TIME_SCALES.map((s) => (
              <button
                key={s}
                type="button"
                aria-pressed={p.timeScale === s}
                onClick={() => p.onTimeScale(s)}
                className={`rounded-md py-2 text-xs tabular-nums transition ${
                  p.timeScale === s ? "bg-brand-500 font-semibold text-white" : "bg-foreground/5 text-foreground/70"
                }`}
              >
                {s}×
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={p.onTogglePower}
            disabled={p.depleted && !p.energized}
            className={`col-span-2 rounded-xl px-3 py-2.5 text-sm font-medium text-white shadow-soft transition disabled:opacity-40 ${
              p.energized ? "bg-rose-500 hover:bg-rose-600" : "bg-gradient-to-r from-brand-500 to-brand-600"
            }`}
          >
            {p.energized ? `⏻ ${t("powerOff")}` : `⚡ ${t("powerOn")}`}
          </button>
          <button
            type="button"
            aria-pressed={p.microView}
            onClick={p.onMicroView}
            className={`rounded-xl border px-3 py-2 text-sm transition ${
              p.microView ? "border-sky-500/60 bg-sky-500/10 text-sky-700 dark:text-sky-300" : "border-foreground/20"
            }`}
          >
            ⚛ {t("microView")}
          </button>
          <button type="button" onClick={p.onReset} className="rounded-xl border border-foreground/20 px-3 py-2 text-sm">
            {t("reset")}
          </button>
        </div>
      </section>

      {/* —— 实时读数 —— */}
      <section className="flex flex-col gap-2 rounded-2xl border border-foreground/10 bg-slate-900/90 p-4 text-slate-100">
        <h3 className="text-xs font-semibold tracking-wider text-slate-400">{t("readings")}</h3>
        <Row label={`⏱ ${formatDuration(p.state.seconds)}`} value={`${t("charge")} ${Math.round(p.state.chargeC)} C`} />
        <Row label={t("copperDeposited")} value={`${r.copperDepositedG.toFixed(4)} g`} accent />
        {p.anode === "graphite" ? (
          <Row label={t("oxygen")} value={`${r.oxygenMl.toFixed(1)} mL`} />
        ) : (
          <Row label={t("anodeDissolved")} value={`${r.anodeDissolvedG.toFixed(4)} g`} />
        )}
        <Row label={t("concentration")} value={`${r.cuConcentration.toFixed(3)} mol/L`} />
        <Row label="pH" value={r.ph.toFixed(2)} />
        {/* 电极反应：随阳极材料切换，这是本实验的核心对比 */}
        <div className="mt-1 flex flex-col gap-1 border-t border-white/10 pt-2 font-mono text-[11px] leading-relaxed text-slate-300">
          <span>{t("cathodeLabel")} Cu²⁺ + 2e⁻ → Cu</span>
          <span>
            {t("anodeLabel")} {p.anode === "graphite" ? "2H₂O − 4e⁻ → O₂↑ + 4H⁺" : "Cu − 2e⁻ → Cu²⁺"}
          </span>
        </div>
        {p.depleted ? (
          <p className="rounded-lg bg-amber-500/15 px-2 py-1.5 text-xs text-amber-200">{t("depleted")}</p>
        ) : null}
      </section>

      {/* —— 称量与完成 —— */}
      <section className="flex flex-col gap-2">
        <button
          type="button"
          onClick={p.onWeigh}
          disabled={!ran || p.energized}
          className="rounded-xl border border-brand-500/40 bg-brand-500/10 px-3 py-2.5 text-sm font-medium text-brand-700 transition disabled:opacity-40 dark:text-brand-300"
        >
          ⚖ {t("weigh")}
        </button>
        {p.weighed ? (
          <div className="grid grid-cols-3 gap-2 rounded-xl border border-foreground/10 bg-surface/60 p-3 text-center text-xs">
            <Stat label={t("measured")} value={`${p.weighed.measuredG.toFixed(4)} g`} />
            <Stat label={t("theoretical")} value={`${r.copperDepositedG.toFixed(4)} g`} />
            <Stat label={t("efficiency")} value={`${(p.weighed.efficiency * 100).toFixed(1)}%`} />
          </div>
        ) : null}
        <button
          type="button"
          onClick={complete}
          disabled={completed || !p.weighed}
          className="rounded-xl border border-emerald-500/40 px-3 py-2.5 text-sm text-emerald-700 transition disabled:opacity-40 dark:text-emerald-300"
        >
          {t("complete")}
        </button>
        {completed && sessionId ? (
          <Link
            href={`/sessions/${sessionId}/report`}
            className="rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 px-3 py-2.5 text-center text-sm font-medium text-white"
          >
            {t("viewReport")}
          </Link>
        ) : null}
      </section>
    </aside>
  );
}

function Row({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-2 text-xs">
      <span className="text-slate-400">{label}</span>
      <span className={`font-mono tabular-nums ${accent ? "text-base font-semibold text-emerald-300" : "text-slate-100"}`}>
        {value}
      </span>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-foreground/65">{label}</span>
      <span className="font-mono font-semibold tabular-nums">{value}</span>
    </div>
  );
}

/** 秒 → mm:ss（超过一小时显示 h:mm:ss） */
function formatDuration(s: number): string {
  const total = Math.floor(s);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const sec = total % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`;
}
