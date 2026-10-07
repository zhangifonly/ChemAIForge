"use client";

// 产氢曲线：每做完一块钠记一条 V(H₂)–t 曲线，虚线是该质量的理论终值。
// 下方对比表用"缩球模型"预测：反应时长 ∝ m^(1/3)。质量翻 8 倍时长只翻约 2 倍 ——
// 这是表面反应的特征，学生常误以为"多 8 倍的钠要 8 倍时间"。
import { useTranslations } from "next-intl";
import { niceCeil } from "../electrolysis/faraday";
import { NA_MOLAR, type PieceSize } from "./model";

export interface Run {
  size: PieceSize;
  massG: number;
  seconds: number;
  curve: [number, number][];
}

const COLOR: Record<PieceSize, string> = { small: "#0ea5e9", medium: "#8b5cf6", large: "#f97316" };
const W = 360, H = 200;
const PAD = { l: 44, r: 14, t: 12, b: 34 };
const theoryML = (m: number) => (m / NA_MOLAR / 2) * 24.465 * 1000;

export function H2Chart({
  runs,
  live,
}: {
  runs: Run[];
  live: { size: PieceSize; curve: [number, number][]; seconds: number; h2mL: number } | null;
}) {
  const t = useTranslations("sodiumLab.chart");
  const all = live ? [...runs, { size: live.size, massG: 0, seconds: live.seconds, curve: [...live.curve, [live.seconds, live.h2mL] as [number, number]] }] : runs;
  const tMax = niceCeil(Math.max(20, ...all.map((r) => r.seconds)));
  const vMax = niceCeil(Math.max(30, ...runs.map((r) => theoryML(r.massG)), live?.h2mL ?? 0));
  const x = (s: number) => PAD.l + (s / tMax) * (W - PAD.l - PAD.r);
  const y = (v: number) => H - PAD.b - (v / vMax) * (H - PAD.t - PAD.b);
  const ticks = [0, 0.25, 0.5, 0.75, 1];
  const base = runs[0];

  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-foreground/10 bg-surface/60 p-4">
      <h3 className="text-sm font-semibold text-foreground/80">{t("title")}</h3>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full max-w-xl" role="img" aria-label={t("ariaLabel", { count: runs.length })}>
        {ticks.map((f) => (
          <g key={f} className="text-foreground/50" fill="currentColor" fontSize={10}>
            <line x1={PAD.l} x2={W - PAD.r} y1={y(f * vMax)} y2={y(f * vMax)} stroke="currentColor" strokeOpacity={0.15} />
            <text x={PAD.l - 5} y={y(f * vMax) + 3} textAnchor="end">{Number((f * vMax).toPrecision(4))}</text>
            <text x={x(f * tMax)} y={H - PAD.b + 13} textAnchor="middle">{Number((f * tMax).toPrecision(4))}</text>
          </g>
        ))}
        <text x={(PAD.l + W - PAD.r) / 2} y={H - 4} textAnchor="middle" fontSize={11} className="fill-foreground/70">{t("xAxis")}</text>
        <text x={11} y={(PAD.t + H - PAD.b) / 2} textAnchor="middle" fontSize={11} className="fill-foreground/70" transform={`rotate(-90 11 ${(PAD.t + H - PAD.b) / 2})`}>{t("yAxis")}</text>
        {all.map((r, i) => (
          <g key={i} data-testid={i < runs.length ? "h2-run" : "h2-live"}>
            {r.massG > 0 && (
              <line x1={PAD.l} x2={W - PAD.r} y1={y(theoryML(r.massG))} y2={y(theoryML(r.massG))} stroke={COLOR[r.size]} strokeDasharray="4 3" strokeOpacity={0.6} />
            )}
            <polyline fill="none" stroke={COLOR[r.size]} strokeWidth={2} points={r.curve.map(([s, v]) => `${x(s)},${y(v)}`).join(" ")} />
          </g>
        ))}
      </svg>
      {runs.length > 0 ? (
        <table className="w-full max-w-xl text-xs tabular-nums" data-testid="h2-table">
          <thead className="text-foreground/60">
            <tr><th className="text-start font-normal">{t("mass")}</th><th className="font-normal">{t("measuredT")}</th><th className="font-normal">{t("predictedT")}</th><th className="font-normal">{t("volume")}</th></tr>
          </thead>
          <tbody>
            {runs.map((r, i) => (
              <tr key={i}>
                <td><span className="me-1 inline-block h-2 w-2 rounded-full" style={{ background: COLOR[r.size] }} />{r.massG} g</td>
                <td className="text-center font-mono">{r.seconds.toFixed(1)} s</td>
                <td className="text-center font-mono">{(base.seconds * Math.cbrt(r.massG / base.massG)).toFixed(1)} s</td>
                <td className="text-center font-mono">{r.curve[r.curve.length - 1][1].toFixed(1)} mL</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="text-xs text-foreground/60">{t("hint")}</p>
      )}
      {runs.length > 1 ? <p className="text-xs text-foreground/70">{t("insight")}</p> : null}
    </section>
  );
}
