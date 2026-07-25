"use client";

// 滴定操作面板：滴定管读数、pH 表、实时滴定曲线（SVG）、终点判定与浓度计算结果。
// 纯展示 + 回调，状态由 Lab3DCanvas 持有。
import {
  TITRATION,
  DROP_ML,
  phAt,
  equivalenceMl,
  calcAnalyteConc,
  relativeErrorPct,
  verdictAt,
  TOLERANCE_PCT,
} from "./model";

export interface TitrationPanelProps {
  ready: boolean;
  deliveredMl: number;
  openness: number;
  swirl: boolean;
  finished: boolean;
  onPrepare: () => void;
  onHalfDrop: () => void;
  onSwirlToggle: () => void;
  onFinish: () => void;
  onReset: () => void;
}

/** 读数 + 曲线（数据列） */
export function TitrationData(props: TitrationPanelProps) {
  const { ready, deliveredMl } = props;
  return (
    <div className="flex flex-col gap-3">
      <Readings deliveredMl={deliveredMl} ph={phAt(deliveredMl)} ready={ready} />
      <Curve deliveredMl={deliveredMl} />
    </div>
  );
}

/** 操作按钮 + 终点判定（操作列） */
export function TitrationControls(props: TitrationPanelProps) {
  const { deliveredMl, finished } = props;
  return (
    <div className="flex flex-col gap-3">
      <Actions {...props} />
      {finished && <Verdict deliveredMl={deliveredMl} />}
    </div>
  );
}

/** 读数区：滴定管读数（保留两位小数，符合滴定管精度）与 pH 计示数 */
function Readings({
  deliveredMl,
  ph,
  ready,
}: {
  deliveredMl: number;
  ph: number;
  ready: boolean;
}) {
  return (
    <div className="grid grid-cols-2 gap-2">
      <div className="rounded-xl border border-foreground/15 bg-surface/70 px-3 py-2">
        <p className="text-[11px] text-foreground/50">滴定管读数</p>
        <p className="font-mono text-lg tabular-nums">{deliveredMl.toFixed(2)}</p>
        <p className="text-[11px] text-foreground/40">mL / 共 {TITRATION.buretteCapacityMl}</p>
      </div>
      <div className="rounded-xl border border-foreground/15 bg-surface/70 px-3 py-2">
        <p className="text-[11px] text-foreground/50">pH 计</p>
        <p className="font-mono text-lg tabular-nums">{ready ? ph.toFixed(2) : "—"}</p>
        <p className="text-[11px] text-foreground/40">{ready ? phLabel(ph) : "待装液"}</p>
      </div>
    </div>
  );
}

function phLabel(ph: number): string {
  if (ph > 10) return "强碱性";
  if (ph > 8.2) return "弱碱性 · 变色区";
  if (ph > 6) return "接近中性";
  return "酸性 · 已过量";
}

/** 实时滴定曲线：整条理论曲线为底，当前点高亮，等当点画虚线 */
function Curve({ deliveredMl }: { deliveredMl: number }) {
  const vMax = 30;
  const W = 220;
  const H = 96;
  const x = (v: number) => (v / vMax) * W;
  const y = (p: number) => H - (p / 14) * H;
  const path = Array.from({ length: 121 }, (_, i) => {
    const v = (i / 120) * vMax;
    return `${i === 0 ? "M" : "L"}${x(v).toFixed(1)},${y(phAt(v)).toFixed(1)}`;
  }).join(" ");
  const ve = equivalenceMl();
  const cx = x(Math.min(deliveredMl, vMax));
  const cy = y(phAt(deliveredMl));
  return (
    <div className="rounded-xl border border-foreground/15 bg-surface/70 px-3 py-2">
      <p className="mb-1 text-[11px] text-foreground/50">滴定曲线（pH — V盐酸）</p>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="滴定曲线">
        <line x1={0} y1={y(7)} x2={W} y2={y(7)} stroke="currentColor" strokeOpacity={0.15} strokeDasharray="3 3" />
        <line x1={x(ve)} y1={0} x2={x(ve)} y2={H} stroke="#f59e0b" strokeOpacity={0.5} strokeDasharray="3 3" />
        {/* 酚酞变色带 8.2~10 */}
        <rect x={0} y={y(10)} width={W} height={y(8.2) - y(10)} fill="#ec4899" fillOpacity={0.12} />
        <path d={path} fill="none" stroke="#0ea5e9" strokeWidth={1.6} />
        <circle cx={cx} cy={cy} r={3.4} fill="#e11d48" />
      </svg>
      <p className="text-[11px] text-foreground/40">粉带为酚酞变色区 · 橙线为等当点</p>
    </div>
  );
}

/** 操作按钮区 */
function Actions({
  ready,
  swirl,
  finished,
  onPrepare,
  onHalfDrop,
  onSwirlToggle,
  onFinish,
  onReset,
}: TitrationPanelProps) {
  return (
    <div className="flex flex-col gap-2">
      {!ready ? (
        <button
          type="button"
          onClick={onPrepare}
          className="rounded-xl bg-gradient-to-r from-brand-500 to-brand-600 px-3 py-2 text-sm font-medium text-white shadow-soft transition-all hover:shadow-glow"
        >
          移液管取 20.00 mL 待测液 + 滴酚酞
        </button>
      ) : (
        <>
          <button
            type="button"
            onClick={onHalfDrop}
            disabled={finished}
            className="rounded-xl border border-brand-400/50 bg-brand-500/10 px-3 py-2 text-sm font-medium transition-all hover:bg-brand-500/20 disabled:opacity-40"
          >
            加半滴（{(DROP_ML / 2).toFixed(3)} mL）
          </button>
          <button
            type="button"
            onClick={onSwirlToggle}
            className={`rounded-xl border px-3 py-2 text-sm transition-colors ${
              swirl ? "border-amber-400/60 bg-amber-400/15" : "border-foreground/20 hover:border-brand-400/50"
            }`}
          >
            {swirl ? "停止摇动" : "摇动锥形瓶"}
          </button>
          <button
            type="button"
            onClick={onFinish}
            disabled={finished}
            className="rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 px-3 py-2 text-sm font-medium text-white shadow-soft transition-all hover:shadow-glow disabled:opacity-40"
          >
            判定为终点并读数
          </button>
        </>
      )}
      <button
        type="button"
        onClick={onReset}
        className="rounded-xl border border-foreground/20 px-3 py-2 text-sm transition-colors hover:border-brand-400/50"
      >
        重新开始
      </button>
    </div>
  );
}

/** 终点判定结果：浓度计算、相对误差与评语 */
function Verdict({ deliveredMl }: { deliveredMl: number }) {
  const v = verdictAt(deliveredMl);
  const c = calcAnalyteConc(deliveredMl);
  const err = relativeErrorPct(deliveredMl);
  const tone =
    v === "good"
      ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
      : "bg-amber-500/10 text-amber-700 dark:text-amber-300";
  const text =
    v === "before"
      ? "溶液仍显粉红，尚未到终点——终点应为粉红刚好褪去且半分钟不复色。"
      : v === "good"
        ? `终点判断准确，误差在 ±${TOLERANCE_PCT}% 以内。`
        : "已滴过量。酚酞褪色后继续滴加肉眼无变化，误差却在累积——这正是要控制到半滴的原因。";
  return (
    <div className={`rounded-xl px-3 py-2 text-xs leading-relaxed ${tone}`}>
      <p className="font-medium">
        c(NaOH) = {c.toFixed(4)} mol/L · 相对误差 {err >= 0 ? "+" : ""}
        {err.toFixed(2)}%
      </p>
      <p className="mt-1">{text}</p>
      <p className="mt-1 text-foreground/50">
        计算式：c(NaOH) = c(HCl)·V(HCl) / V(NaOH) = {TITRATION.titrantConc} × {deliveredMl.toFixed(2)} /{" "}
        {TITRATION.analyteVolumeMl.toFixed(2)}
      </p>
    </div>
  );
}
