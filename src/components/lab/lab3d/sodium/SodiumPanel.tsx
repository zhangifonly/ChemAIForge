"use client";

// 钠与水实验台面板：步骤按钮（切 → 滴酚酞 → 投入）、实时读数、"浮熔游响红"现象清单。
// 纯展示组件，状态由 SodiumLab 持有。
import { useTranslations } from "next-intl";
import { Card, CompleteBlock, Row, Seg, ghostBtn, primaryBtn } from "../showcase/ui";
import { PIECES, type PieceSize, type SodiumReadings } from "./model";
import type { SodiumPhase } from "./SodiumScene";

export type Observed = Record<"float" | "melt" | "swim" | "hiss" | "pink", boolean>;
const PHENOMENA = ["float", "melt", "swim", "hiss", "pink"] as const;

export interface SodiumPanelProps {
  size: PieceSize;
  phase: SodiumPhase;
  cut: boolean;
  phenol: boolean;
  muted: boolean;
  readings: SodiumReadings;
  seconds: number;
  observed: Observed;
  hasRuns: boolean;
  onSize: (s: PieceSize) => void;
  onCut: () => void;
  onPhenol: () => void;
  onDrop: () => void;
  onNext: () => void;
  onReset: () => void;
  onMute: () => void;
}

export function SodiumPanel(p: SodiumPanelProps) {
  const t = useTranslations("sodiumLab");
  const r = p.readings;
  const prep = p.phase === "prep";
  return (
    <aside className="flex min-w-0 flex-col gap-4">
      <Card title={t("setup")}>
        <span className="text-xs text-foreground/65">{t("pieceSize")}</span>
        <Seg
          options={["small", "medium", "large"] as const}
          value={p.size}
          onChange={p.onSize}
          disabled={!prep}
          label={(s) => (
            <span className="flex flex-col leading-tight">
              <span>{t(`size.${s}`)}</span>
              <span className="font-mono text-[10px] opacity-75">{PIECES[s]} g</span>
            </span>
          )}
        />
        {p.size === "large" ? (
          <p className="rounded-lg bg-amber-500/15 px-2 py-1.5 text-xs text-amber-700 dark:text-amber-300">⚠ {t("largeWarning")}</p>
        ) : null}
        <ol className="flex flex-col gap-1.5">
          <li>
            <button type="button" onClick={p.onCut} disabled={!prep || p.cut} className={`${ghostBtn} w-full text-start`}>
              {p.cut ? "✓" : "①"} {t("cut")}
            </button>
          </li>
          <li>
            <button type="button" onClick={p.onPhenol} disabled={p.phenol} className={`${ghostBtn} w-full text-start`}>
              {p.phenol ? "✓" : "②"} {t("phenol")}
            </button>
          </li>
          <li>
            {prep ? (
              <button type="button" onClick={p.onDrop} disabled={!p.cut} className={primaryBtn("w-full")}>
                ③ {t("drop")}
              </button>
            ) : (
              <button type="button" onClick={p.onNext} disabled={p.phase !== "done"} className={primaryBtn("w-full")}>
                ↻ {t("next")}
              </button>
            )}
          </li>
        </ol>
        {prep && !p.cut ? <p className="text-xs text-foreground/60">{t("cutHint")}</p> : null}
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={p.onMute} aria-pressed={p.muted} className={ghostBtn}>
            {p.muted ? "🔇" : "🔊"} {t("sound")}
          </button>
          <button type="button" onClick={p.onReset} className={ghostBtn}>
            {t("reset")}
          </button>
        </div>
      </Card>

      <Card title={t("readings")} dark>
        <Row label={`⏱ ${p.seconds.toFixed(1)} s`} value={`${t("remaining")} ${(r.naRemainingG * 1000).toFixed(1)} mg`} />
        <Row label={t("hydrogen")} value={`${r.h2mL.toFixed(1)} mL`} accent />
        <Row label={t("waterTemp")} value={`${r.tempC.toFixed(1)} ℃`} />
        <Row label="pH" value={r.ph.toFixed(2)} />
        <div className="mt-1 border-t border-white/10 pt-2 font-mono text-[11px] text-slate-300">2Na + 2H₂O → 2NaOH + H₂↑</div>
        {r.ignites ? <p className="rounded-lg bg-orange-500/20 px-2 py-1.5 text-xs text-orange-200">🔥 {t("burning")}</p> : null}
      </Card>

      <Card title={t("phenomenaTitle")}>
        <ul className="flex flex-col gap-1.5" data-testid="sodium-phenomena">
          {PHENOMENA.map((k) => {
            const seen = p.observed[k];
            return (
              <li
                key={k}
                data-seen={seen}
                className={`rounded-lg border px-2.5 py-1.5 text-xs transition ${
                  seen ? "border-brand-500/40 bg-brand-500/10" : "border-foreground/10 opacity-60"
                }`}
              >
                <span className="font-semibold">
                  {seen ? "✓" : "○"} {t(`phenomena.${k}.name`)}
                </span>
                {seen ? <span className="block text-foreground/70">{t(`phenomena.${k}.why`)}</span> : null}
              </li>
            );
          })}
        </ul>
        {!p.phenol && p.observed.float ? <p className="text-xs text-foreground/60">{t("pinkHint")}</p> : null}
      </Card>

      <section className="flex flex-col gap-2">
        <CompleteBlock ready={p.hasRuns} />
      </section>
    </aside>
  );
}
