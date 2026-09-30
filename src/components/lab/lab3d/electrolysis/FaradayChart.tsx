"use client";

// 法拉第定律验证图：横轴累计电量 Q，纵轴析出铜质量 m。
// 虚线为理论线 m = Q·M/(2F)；实心点为各次称量；空心圈为正在进行的电解（理论值）。
// 轻量 SVG，与 session/measurement-chart 同样不引入图表库。
import { useTranslations } from "next-intl";
import { CURRENT_RANGE, FARADAY, M_CU } from "./model";
import { fitFaraday, niceCeil, type WeighPoint } from "./faraday";

const W = 360;
const H = 220;
const PAD = { l: 48, r: 18, t: 14, b: 38 };
const G_PER_C = M_CU / (2 * FARADAY);

/**
 * 刻度段数随上限的首位数字选：上限 1×10ⁿ / 5×10ⁿ 分 5 段、2×10ⁿ 分 4 段，
 * 保证每个刻度都是整齐的数（0.2、0.5、1…）。固定分 4 段时上限 1 会得出 0.25、0.75，
 * 再按一位小数显示就成了 0.3、0.8 —— 刻度标错了。
 */
function tickFractions(max: number): number[] {
  const lead = Math.round(max / 10 ** Math.floor(Math.log10(max)));
  const n = lead === 2 ? 4 : 5;
  return Array.from({ length: n + 1 }, (_, i) => i / n);
}

/** 刻度文字：去掉浮点尾差（0.30000000000000004 → 0.3） */
const label = (v: number) => String(Number(v.toPrecision(6)));

/** 电流 → 点的颜色：小电流偏蓝、大电流偏红（hsl 色相 220 → 0） */
function currentColor(a: number): string {
  const f = (a - CURRENT_RANGE.min) / (CURRENT_RANGE.max - CURRENT_RANGE.min);
  return `hsl(${Math.round(220 * (1 - Math.max(0, Math.min(1, f))))} 80% 55%)`;
}

export function FaradayChart({
  points,
  liveChargeC,
}: {
  points: readonly WeighPoint[];
  liveChargeC: number;
}) {
  const t = useTranslations("electrolysisLab.faraday");
  const maxQ = Math.max(600, liveChargeC, ...points.map((p) => p.chargeC));
  const xMax = niceCeil(maxQ * 1.05);
  const yMax = niceCeil(xMax * G_PER_C);
  const x = (q: number) => PAD.l + (q / xMax) * (W - PAD.l - PAD.r);
  const y = (m: number) => H - PAD.b - (m / yMax) * (H - PAD.t - PAD.b);
  const yTicks = tickFractions(yMax);
  const xTicks = tickFractions(xMax);
  const fit = points.length >= 2 ? fitFaraday(points) : null;
  const theoryEnd = Math.min(xMax, yMax / G_PER_C);

  return (
    <section className="flex flex-col gap-2 rounded-2xl border border-foreground/10 bg-surface/60 p-3 sm:p-4">
      <h3 className="text-sm font-semibold">{t("title")}</h3>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full max-w-xl"
        role="img"
        aria-label={t("ariaLabel", { count: points.length })}
      >
        {yTicks.map((f) => (
          <g key={`y${f}`} className="text-foreground/50">
            <line x1={PAD.l} x2={W - PAD.r} y1={y(f * yMax)} y2={y(f * yMax)} stroke="currentColor" strokeOpacity={0.2} />
            <text x={PAD.l - 5} y={y(f * yMax) + 4} textAnchor="end" fontSize={11} fill="currentColor">
              {label(f * yMax)}
            </text>
          </g>
        ))}
        {xTicks.map((f) => (
          <text key={`x${f}`} x={x(f * xMax)} y={H - PAD.b + 15} textAnchor="middle" fontSize={11}
            className="fill-foreground/50">
            {label(f * xMax)}
          </text>
        ))}
        <text x={(PAD.l + W - PAD.r) / 2} y={H - 4} textAnchor="middle" fontSize={12} className="fill-foreground/70">
          {t("xAxis")}
        </text>
        <text x={11} y={(PAD.t + H - PAD.b) / 2} textAnchor="middle" fontSize={12} className="fill-foreground/70"
          transform={`rotate(-90 11 ${(PAD.t + H - PAD.b) / 2})`}>
          {t("yAxis")}
        </text>
        {/* 理论线 */}
        <line x1={x(0)} y1={y(0)} x2={x(theoryEnd)} y2={y(theoryEnd * G_PER_C)}
          stroke="#10b981" strokeWidth={1.5} strokeDasharray="5 4" />
        {/* 拟合线：与理论线分开画，偏差一眼可见 */}
        {fit ? (
          <line x1={x(0)} y1={y(0)} x2={x(Math.min(xMax, yMax / fit.slope))} y2={y(Math.min(xMax, yMax / fit.slope) * fit.slope)}
            stroke="#f59e0b" strokeWidth={1.2} />
        ) : null}
        {liveChargeC > 0 ? (
          <circle cx={x(liveChargeC)} cy={y(liveChargeC * G_PER_C)} r={4.5} fill="none" stroke="#10b981" strokeWidth={1.5}>
            <title>{t("live")}</title>
          </circle>
        ) : null}
        {points.map((p) => (
          <circle key={p.chargeC} cx={x(p.chargeC)} cy={y(p.measuredG)} r={4} fill={currentColor(p.currentA)}
            stroke="white" strokeWidth={1} data-testid="faraday-point">
            <title>{`${Math.round(p.chargeC)} C · ${p.measuredG.toFixed(4)} g · ${p.currentA.toFixed(1)} A`}</title>
          </circle>
        ))}
      </svg>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-foreground/70">
        <span className="flex items-center gap-1"><span className="inline-block h-0 w-4 border-t-2 border-dashed border-emerald-500" />{t("theory")}</span>
        <span className="flex items-center gap-1"><span className="inline-block h-0 w-4 border-t-2 border-amber-500" />{t("fitLine")}</span>
        <span>{t("colorNote")}</span>
      </div>
      {fit ? (
        <p className="text-sm" data-testid="faraday-fit">
          {t("fitted", { value: Math.round(fit.faradayExp).toString() })}
          <span className="ml-2 text-foreground/65">
            {t("error", { pct: Math.abs(fit.relativeError * 100).toFixed(1) })}
          </span>
        </p>
      ) : (
        <p className="text-xs text-foreground/65">{t("hint")}</p>
      )}
    </section>
  );
}
