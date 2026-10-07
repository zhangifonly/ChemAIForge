"use client";

// 焰色反应面板：本生灯开关、铂丝操作（蘸盐酸 / 蘸样品 / 放入火焰）、钴玻璃、
// 当前火焰中能辨认的元素，以及未知样品鉴定。纯展示组件，状态由 FlameLab 持有。
import { useTranslations } from "next-intl";
import { Card, CompleteBlock, Row, ghostBtn, primaryBtn } from "../showcase/ui";
import { FORMULA, SAMPLES, UNKNOWN_POOL, type Sample } from "./samples";
import type { Element } from "./model";
import type { WirePose } from "./FlameScene";

export interface Observation {
  sample: Sample;
  cobalt: boolean;
  visible: Element[];
  rgb: [number, number, number];
  contaminated: boolean;
}

export interface FlamePanelProps {
  lit: boolean;
  pose: WirePose;
  cobalt: boolean;
  clean: boolean;
  burning: boolean;
  visible: Element[];
  guess: { answer: string; correct: boolean } | null;
  hasObs: boolean;
  onLight: () => void;
  onAcid: () => void;
  onDip: (s: Sample) => void;
  onFlame: () => void;
  onCobalt: () => void;
  onGuess: (answer: string) => void;
  onReset: () => void;
}

export function FlamePanel(p: FlamePanelProps) {
  const t = useTranslations("flameLab");
  const inFlame = p.pose === "flame";
  return (
    <aside className="flex min-w-0 flex-col gap-4">
      <Card title={t("setup")}>
        <button type="button" onClick={p.onLight} className={p.lit ? `${ghostBtn} border-rose-400/50` : primaryBtn()}>
          {p.lit ? `⏻ ${t("extinguish")}` : `🔥 ${t("light")}`}
        </button>
        <span className="text-xs text-foreground/65">{t("wire")}</span>
        <div className="grid grid-cols-2 gap-1.5">
          <button type="button" onClick={p.onAcid} className={ghostBtn}>🧪 {t("dipAcid")}</button>
          <button type="button" onClick={p.onFlame} disabled={!p.lit} aria-pressed={inFlame} className={inFlame ? primaryBtn() : ghostBtn}>
            {inFlame ? t("outOfFlame") : t("intoFlame")}
          </button>
        </div>
        <span className="text-xs text-foreground/65">{t("dipSample")}</span>
        <div className="grid grid-cols-4 gap-1.5">
          {SAMPLES.map((s) => (
            <button
              key={s}
              type="button"
              aria-pressed={p.pose === s}
              onClick={() => p.onDip(s)}
              className={`rounded-lg border px-1 py-2 font-mono text-xs transition ${
                p.pose === s ? "border-brand-500 bg-brand-500 text-white" : "border-foreground/15 hover:border-brand-400/50"
              }`}
            >
              {FORMULA[s]}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          <button type="button" onClick={p.onCobalt} aria-pressed={p.cobalt} className={`${ghostBtn} ${p.cobalt ? "border-blue-500/60 bg-blue-500/10 text-blue-700 dark:text-blue-300" : ""}`}>
            🔷 {t("cobalt")}
          </button>
          <button type="button" onClick={p.onReset} className={ghostBtn}>{t("reset")}</button>
        </div>
      </Card>

      <Card title={t("readings")} dark>
        <Row label={t("wireState")} value={p.clean ? t("clean") : t("dirty")} />
        <Row
          label={t("seen")}
          value={<span data-testid="flame-visible">{p.burning ? (p.visible.length ? p.visible.map((e) => t(`el.${e}`)).join(" + ") : t("none")) : "—"}</span>}
          accent
        />
        <p className="text-[11px] leading-relaxed text-slate-400">{p.clean ? t("cleanHint") : t("dirtyHint")}</p>
      </Card>

      <Card title={t("unknownTitle")}>
        <p className="text-xs text-foreground/65">{t("unknownHint")}</p>
        <div className="grid grid-cols-3 gap-1.5">
          {UNKNOWN_POOL.map((els) => {
            const key = els.join("+");
            return (
              <button key={key} type="button" onClick={() => p.onGuess(key)} disabled={p.guess?.correct}
                aria-pressed={p.guess?.answer === key} className={`${ghostBtn} px-1 text-xs`}>
                {els.map((e) => t(`el.${e}`)).join("+")}
              </button>
            );
          })}
        </div>
        {p.guess ? (
          <p data-testid="flame-guess" data-correct={p.guess.correct}
            className={`rounded-lg px-2 py-1.5 text-xs ${p.guess.correct ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" : "bg-rose-500/15 text-rose-700 dark:text-rose-300"}`}>
            {p.guess.correct ? t("correct") : t("wrong")}
          </p>
        ) : null}
      </Card>

      <section className="flex flex-col gap-2">
        <CompleteBlock ready={p.hasObs} />
      </section>
    </aside>
  );
}
