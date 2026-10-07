"use client";

// 动力学数据处理：两张散点 + 最小二乘直线。
//  左：同温、同 H2O2/Na2S2O3 下改变 KI → ln(1/t) 对 ln c(KI)，斜率 = 对 I⁻ 的反应级数
//  右：同配方下改变温度 → ln(1/t) 对 1/T，斜率 = −Ea/R
// 每张图自动挑出"控制变量一致"且点数最多的那一组来拟合，不一致的点画成空心灰点。
import { useTranslations } from "next-intl";
import { R, fitLine, type ClockParams, type LineFit } from "./model";

export interface ClockRun extends ClockParams {
  t: number | null;
}

type Pt = { x: number; y: number; used: boolean };

function series(runs: ClockRun[], vary: "ki" | "tempC") {
  const ok = runs.filter((r) => r.t !== null && r.starch);
  const key = (r: ClockRun) => (vary === "ki" ? `${r.h2o2}|${r.thio}|${r.tempC}` : `${r.ki}|${r.h2o2}|${r.thio}`);
  const groups = new Map<string, ClockRun[]>();
  for (const r of ok) groups.set(key(r), [...(groups.get(key(r)) ?? []), r]);
  // 组内自变量至少两种取值才有意义
  const distinct = (g: ClockRun[]) => new Set(g.map((r) => r[vary])).size;
  const best = [...groups.values()].sort((a, b) => distinct(b) - distinct(a) || b.length - a.length)[0] ?? [];
  const x = (r: ClockRun) => (vary === "ki" ? Math.log(r.ki) : 1000 / (r.tempC + 273.15));
  const pts: Pt[] = ok.map((r) => ({ x: x(r), y: Math.log(1 / r.t!), used: best.includes(r) }));
  const fit = distinct(best) >= 2 ? fitLine(pts.filter((p) => p.used).map((p) => [p.x, p.y])) : null;
  return { pts, fit };
}

export function KineticsChart({ runs }: { runs: ClockRun[] }) {
  const t = useTranslations("clockLab.chart");
  const order = series(runs, "ki");
  const arr = series(runs, "tempC");
  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-foreground/10 bg-surface/60 p-4">
      <h3 className="text-sm font-semibold text-foreground/80">{t("title")}</h3>
      <div className="grid gap-4 md:grid-cols-2">
        <Plot pts={order.pts} fit={order.fit} xLabel="ln c(KI)" testid="order-plot"
          result={order.fit ? t("order", { n: order.fit.slope.toFixed(2) }) : t("orderHint")} />
        <Plot pts={arr.pts} fit={arr.fit} xLabel="1000 / T (K⁻¹)" testid="arrhenius-plot"
          result={arr.fit ? t("ea", { ea: (-arr.fit.slope * R).toFixed(1) }) : t("eaHint")} />
      </div>
      <table className="w-full max-w-2xl text-xs tabular-nums" data-testid="clock-runs">
        <thead className="text-foreground/60">
          <tr>{["ki", "thio", "h2o2", "temp", "time"].map((k) => <th key={k} className="text-start font-normal">{t(`col.${k}`)}</th>)}</tr>
        </thead>
        <tbody>
          {runs.map((r, i) => (
            <tr key={i} className="border-t border-foreground/5 font-mono">
              <td>{r.ki}</td><td>{r.thio}</td><td>{r.h2o2}</td><td>{r.tempC} ℃</td>
              <td>{r.t!.toFixed(1)} s{r.starch ? "" : ` (${t("withoutStarch")})`}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

const W = 300, H = 180, PAD = { l: 40, r: 10, t: 10, b: 32 };

function Plot({ pts, fit, xLabel, result, testid }: { pts: Pt[]; fit: LineFit | null; xLabel: string; result: string; testid: string }) {
  const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y);
  const pad = (a: number, b: number) => (a === b ? [a - 0.5, b + 0.5] : [a - (b - a) * 0.15, b + (b - a) * 0.15]);
  const [x0, x1] = pts.length ? pad(Math.min(...xs), Math.max(...xs)) : [0, 1];
  const [y0, y1] = pts.length ? pad(Math.min(...ys), Math.max(...ys)) : [0, 1];
  const sx = (x: number) => PAD.l + ((x - x0) / (x1 - x0)) * (W - PAD.l - PAD.r);
  const sy = (y: number) => H - PAD.b - ((y - y0) / (y1 - y0)) * (H - PAD.t - PAD.b);
  return (
    <div className="flex flex-col gap-1" data-testid={testid}>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={result}>
        <rect x={PAD.l} y={PAD.t} width={W - PAD.l - PAD.r} height={H - PAD.t - PAD.b} fill="none" stroke="currentColor" strokeOpacity={0.15} />
        {[0, 0.5, 1].map((f) => (
          <g key={f} fontSize={9} className="fill-foreground/55">
            <text x={sx(x0 + f * (x1 - x0))} y={H - PAD.b + 11} textAnchor="middle">{(x0 + f * (x1 - x0)).toFixed(2)}</text>
            <text x={PAD.l - 4} y={sy(y0 + f * (y1 - y0)) + 3} textAnchor="end">{(y0 + f * (y1 - y0)).toFixed(2)}</text>
          </g>
        ))}
        <text x={(PAD.l + W) / 2} y={H - 4} textAnchor="middle" fontSize={10} className="fill-foreground/70">{xLabel}</text>
        <text x={10} y={H / 2 - 10} textAnchor="middle" fontSize={10} className="fill-foreground/70" transform={`rotate(-90 10 ${H / 2 - 10})`}>ln(1/t)</text>
        {fit ? <line x1={sx(x0)} y1={sy(fit.slope * x0 + fit.intercept)} x2={sx(x1)} y2={sy(fit.slope * x1 + fit.intercept)} stroke="#f59e0b" strokeWidth={1.5} /> : null}
        {pts.map((p, i) => (
          <circle key={i} cx={sx(p.x)} cy={sy(p.y)} r={4} fill={p.used ? "#2563eb" : "none"} stroke={p.used ? "#2563eb" : "#94a3b8"} strokeWidth={1.5} />
        ))}
      </svg>
      <p className="text-xs text-foreground/75">{result}</p>
    </div>
  );
}
