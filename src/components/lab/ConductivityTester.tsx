"use client";

// 导电性对比装置：把多种溶液并排，各接电极 + 灯泡。通电检测时灯泡亮度由 conductivity()
// 决定——强电解质明亮、弱电解质微亮、非电解质不亮。纯展示，不含化学规则。
import type { Substance } from "@/lib/chem/engine";
import { conductivity } from "@/lib/chem/conductivity";

const W = 130; // 单个工位宽度

export function ConductivityTester({
  solutions,
  powered = false,
}: {
  solutions: Substance[];
  powered?: boolean;
}) {
  const n = Math.max(1, solutions.length);
  return (
    <svg
      width={Math.min(380, n * 120)}
      height="220"
      viewBox={`0 0 ${n * W} 220`}
      role="img"
      aria-label="溶液导电性对比"
      className="drop-shadow-[0_18px_24px_rgba(15,57,52,0.14)]"
    >
      <defs>
        <radialGradient id="ct-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="rgba(255,214,90,0.95)" />
          <stop offset="100%" stopColor="rgba(255,214,90,0)" />
        </radialGradient>
        <linearGradient id="ct-liquid" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#dcefff" />
          <stop offset="100%" stopColor="#a9d8f5" />
        </linearGradient>
      </defs>
      {solutions.map((s, i) => (
        <Station key={s.formula + i} cx={i * W + W / 2} sub={s} powered={powered} />
      ))}
    </svg>
  );
}

function Station({ cx, sub, powered }: { cx: number; sub: Substance; powered: boolean }) {
  const c = conductivity(sub);
  const brightness = powered ? c.bulb : 0;
  const lit = brightness > 0;
  const levelText = c.level === "strong" ? "强·明亮" : c.level === "weak" ? "弱·微亮" : "非·不亮";
  return (
    <g transform={`translate(${cx} 0)`}>
      {/* 灯泡光晕（亮度随导电性） */}
      <ellipse cx="0" cy="38" rx="34" ry="34" fill="url(#ct-glow)" opacity={brightness} className="transition-opacity duration-500" />
      <circle cx="0" cy="38" r="13" fill={lit ? "#fff3c4" : "#eef0f2"} stroke="currentColor" strokeWidth="2" className="text-foreground/45 transition-[fill] duration-500" />
      <path d="M-5 38 q5 -8 10 0" fill="none" stroke={lit ? "#c0392b" : "#b9c0c8"} strokeWidth="1.5" />
      <rect x="-5" y="50" width="10" height="6" fill="#9aa3ad" />
      {/* 导线 + 电极 */}
      <path d="M-3 56 L-3 86 M3 56 L3 86" stroke="currentColor" strokeWidth="2" className="text-foreground/55" />
      <rect x="-12" y="86" width="6" height="46" rx="1.5" fill="#5a6470" />
      <rect x="6" y="86" width="6" height="46" rx="1.5" fill="#5a6470" />
      {/* 烧杯 + 电解液 */}
      <rect x="-26" y="118" width="52" height="42" fill="url(#ct-liquid)" />
      <path d="M-30 96 L-30 160 a4 8 0 0 0 8 8 H22 a4 8 0 0 0 8 -8 L30 96" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-foreground/55" strokeLinejoin="round" />
      {/* 标签 */}
      <text x="0" y="186" textAnchor="middle" fontSize="12" className="fill-foreground/70">{sub.name}</text>
      <text x="0" y="202" textAnchor="middle" fontSize="11" className="fill-foreground/45">{levelText}</text>
    </g>
  );
}
