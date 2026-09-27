"use client";

// 过程曲线：把 labStore 的 trace 画成实时折线，可选通道（温度 / pH / 体积）。
//
// 这是「专业」与「小家子气」的分水岭之一：原先面板只有两个瞬时数字，
// 中和热测定看不到温度-时间曲线的峰、气体制备看不出反应速率在衰减。
// 曲线让"过程"变成可读的对象，误差分析也才有依据。
//
// 与 session/chartGeom 的分工：那份是报告页的固定两通道（pH+温度，固定量程），
// 本组件要按选中通道自适应，且要画操作标记，两者形状不同故不复用。
import { useState } from "react";
import type { TracePoint } from "./labStore";
import { useTranslations } from "next-intl";
import { useTerm } from "@/lib/i18n/PhenomenaProvider";
import { markLabel } from "./markLabel";

const W = 520;
const H = 190;
const PAD = { l: 38, r: 14, t: 12, b: 24 };

interface Channel {
  key: "temperature" | "ph" | "volume";
  label: string;
  unit: string;
  color: string;
  /** 固定量程：定值量程才让"高低位置"本身有含义（见 chartGeom 的同一取舍） */
  range: [number, number];
  decimals: number;
}

// label 存词条键：通道名要随界面语言变
const CHANNELS: Channel[] = [
  { key: "temperature", label: "channelTemp", unit: "℃", color: "#ef4444", range: [0, 100], decimals: 1 },
  { key: "ph", label: "channelPh", unit: "", color: "#3b82f6", range: [0, 14], decimals: 1 },
  { key: "volume", label: "channelVolume", unit: "mL", color: "#10b981", range: [0, 100], decimals: 1 },
];

function px(t: number, tMax: number): number {
  const span = tMax <= 0 ? 1 : tMax;
  return PAD.l + (t / span) * (W - PAD.l - PAD.r);
}

function py(v: number, [lo, hi]: [number, number]): number {
  const ratio = Math.max(0, Math.min(1, (v - lo) / (hi - lo)));
  return H - PAD.b - ratio * (H - PAD.t - PAD.b);
}

export function ProcessChart({ trace }: { trace: TracePoint[] }) {
  const tChart = useTranslations("chart");
  const tOp = useTranslations("op");
  const tLab = useTranslations("lab");
  const term = useTerm();
  const [active, setActive] = useState<Channel["key"]>("temperature");
  const ch = CHANNELS.find((c) => c.key === active)!;
  // 时间轴至少留 10 秒宽度：只有一两个点时若按实际跨度铺满，曲线会横向拉伸失真
  const tMax = Math.max(10, trace.at(-1)?.t ?? 0);
  const values = trace.map((p) => p[ch.key]);
  const line = trace
    .map((p, i) => `${px(p.t, tMax).toFixed(1)},${py(values[i], ch.range).toFixed(1)}`)
    .join(" ");
  const last = values.at(-1);
  const peak = values.length ? Math.max(...values) : null;
  const marks = trace.filter((p): p is TracePoint & { mark: string } =>
    Boolean(p.mark),
  );

  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-foreground/10 bg-surface/60 p-4 shadow-soft">
      {/* flex-wrap：亚美尼亚语「Գործընթացի կոր」与「Ջերմաստիճան / pH / Ծավալ」三个通道按钮
          在 360px 屏上排不进一行，原先直接把卡片撑破 */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground/75">
          <span className="h-4 w-1 rounded-full bg-gradient-to-b from-brand-400 to-brand-600" />
          {tChart("title")}
        </h3>
        <div className="flex overflow-hidden rounded-lg border border-foreground/15">
          {CHANNELS.map((c) => (
            <button
              key={c.key}
              type="button"
              aria-pressed={c.key === active}
              onClick={() => setActive(c.key)}
              className={`px-2 py-0.5 text-[11px] transition ${
                c.key === active
                  ? "bg-brand-500 font-semibold text-white"
                  : "text-foreground/65 hover:bg-foreground/5"
              }`}
            >
              {tChart(c.label)}
            </button>
          ))}
        </div>
      </div>

      {trace.length === 0 ? (
        <p className="py-10 text-center text-xs text-foreground/65">
          {tChart("empty")}
        </p>
      ) : (
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img"
          aria-label={tChart("ariaLabel", { label: tChart(ch.label), value: `${last?.toFixed(ch.decimals) ?? ""} ${ch.unit}` })}>
          {/* 纵轴刻度：没有刻度只能看出"有没有变"，读不出变到多少 */}
          {[0, 0.5, 1].map((r) => {
            const v = ch.range[0] + (ch.range[1] - ch.range[0]) * r;
            const y = py(v, ch.range);
            return (
              <g key={r}>
                <line x1={PAD.l} y1={y} x2={W - PAD.r} y2={y}
                  stroke="currentColor" strokeOpacity={0.08} />
                <text x={PAD.l - 5} y={y + 3} textAnchor="end"
                  className="fill-current text-[11px] sm:text-[9px] opacity-40 tabular-nums">
                  {v.toFixed(0)}
                </text>
              </g>
            );
          })}
          {/* 操作标记：竖虚线 + 文字，让曲线上的转折能对应到具体动作。
              文字按第几个标记轮流放三档高度 —— 连续几步操作往往挤在同一秒内，
              同高度会叠成一团糊字，那比不标更糟。 */}
          {marks.map((m, i) => (
            <g key={`m-${m.t}-${i}`}>
              <line x1={px(m.t, tMax)} y1={PAD.t} x2={px(m.t, tMax)} y2={H - PAD.b}
                stroke="currentColor" strokeOpacity={0.18} strokeDasharray="3 3" />
              <text x={px(m.t, tMax) + 2} y={PAD.t + 8 + (i % 3) * 10}
                className="fill-current text-[8px] opacity-45">
                {markLabel(m.mark, tOp, tLab, term)}
              </text>
            </g>
          ))}
          <polyline points={line} fill="none" stroke={ch.color} strokeWidth={2}
            strokeLinejoin="round" strokeLinecap="round" />
          {/* 当前点：让"正在测"这件事看得见 */}
          {trace.length > 0 ? (
            <circle cx={px(trace.at(-1)!.t, tMax)} cy={py(values.at(-1)!, ch.range)}
              r={3.5} fill={ch.color} />
          ) : null}
          <text x={W - PAD.r} y={H - 6} textAnchor="end"
            className="fill-current text-[11px] sm:text-[9px] opacity-40 tabular-nums">
            {tMax.toFixed(0)} s
          </text>
        </svg>
      )}

      {last !== undefined && peak !== null ? (
        <div className="flex gap-4 text-[11px] tabular-nums text-foreground/65">
          <span>
            {tChart("current")} <b className="text-foreground/80">{last.toFixed(ch.decimals)}{ch.unit}</b>
          </span>
          {/* 峰值对中和热这类实验是核心读数：ΔH 用的就是最高温度而非当前温度 */}
          <span>
            {tChart("peak")} <b className="text-foreground/80">{peak.toFixed(ch.decimals)}{ch.unit}</b>
          </span>
          <span>{tChart("samples", { count: trace.length })}</span>
        </div>
      ) : null}
    </div>
  );
}
