"use client";

// 原电池 / 腐蚀可视化：两金属电极 + 电流计 + 电解液。完全由 galvanicCell() 结果驱动——
// 负极活泼金属溶解、正极析氢冒泡或吸氧、电流计偏转、电子流向高亮。不含化学规则。
import { galvanicCell, type GalvanicResult } from "@/lib/chem/galvanic";

// 电极金属配色（仅可视化）
const METAL_FILL: Record<string, string> = {
  Zn: "#9aa3ad", Fe: "#8c95a0", Mg: "#b9c0c8", Al: "#c2c8cf",
  Cu: "#c0612f", Ag: "#c8ccce", Pb: "#7d8893", Sn: "#aab2bb", C: "#5a6470",
};
const fill = (f: string) => METAL_FILL[f] ?? "#9aa3ad";

export function GalvanicCell({
  metals,
  electrolyte,
  connected = false,
}: {
  metals: string[];
  electrolyte: { formula: string; name: string };
  connected?: boolean;
}) {
  const r: GalvanicResult | null = galvanicCell(metals, electrolyte);
  if (!r) return null;
  const hydrogen = connected && r.positive.kind === "hydrogen";

  return (
    <svg width="200" height="244" viewBox="0 0 220 244" role="img" aria-label="原电池" className="drop-shadow-[0_18px_24px_rgba(15,57,52,0.16)]">
      <defs>
        <linearGradient id="gv-liquid" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#dcefff" />
          <stop offset="100%" stopColor="#a9d8f5" />
        </linearGradient>
        <clipPath id="gv-inner">
          <path d="M46 96 L46 196 A54 12 0 0 0 154 196 L154 96 Z" />
        </clipPath>
      </defs>

      {/* 电流计 G + 指针（接通后偏转） */}
      <circle cx="110" cy="24" r="15" fill="#ffffff" stroke="currentColor" strokeWidth="2.5" className="text-foreground/55" />
      <text x="110" y="29" textAnchor="middle" fontSize="13" fontWeight="bold" className="fill-foreground/70">G</text>
      <line x1="110" y1="24" x2={connected ? 119 : 110} y2={connected ? 15 : 10} stroke="#c0392b" strokeWidth="2" className="transition-all duration-500" />

      {/* 导线 */}
      <path d="M84 56 L84 24 L95 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-foreground/55" />
      <path d="M125 24 L136 24 L136 56" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-foreground/55" />
      {/* 电子流向（负极 → 正极），接通后高亮流动 */}
      {connected && (
        <text x="98" y="13" fontSize="9" fill="#2f7d4f">
          e⁻ →
          <animate attributeName="opacity" values="0.3;1;0.3" dur="1.1s" repeatCount="indefinite" />
        </text>
      )}

      {/* 电解液 */}
      <g clipPath="url(#gv-inner)">
        <rect x="46" y="110" width="108" height="90" fill="url(#gv-liquid)" />
        <ellipse cx="100" cy="110" rx="54" ry="8" fill="#dcefff" />
      </g>

      {/* 负极（左，活泼金属）：接通后边缘溶解 */}
      <rect x="80" y="56" width="8" height={connected ? 96 : 100} rx="2" fill={fill(r.negative.metal)} className="transition-all duration-[1500ms]" />
      {/* 正极（右）：析氢则冒气泡 */}
      <rect x="132" y="56" width="8" height="100" rx="2" fill={fill(r.positive.metal)} />
      {hydrogen && (
        <g clipPath="url(#gv-inner)">
          {[
            { r: 3, dur: "1.5s", delay: "0s" },
            { r: 2.5, dur: "1.8s", delay: "0.5s" },
            { r: 3.5, dur: "1.4s", delay: "0.9s" },
          ].map((b, i) => (
            <circle key={i} cx={136 + (i % 2 === 0 ? 0 : 2)} r={b.r} fill="#ffffff" stroke="rgba(70,96,106,0.25)" strokeWidth="0.5" opacity="0.9">
              <animate attributeName="cy" from="153" to="115" dur={b.dur} begin={b.delay} repeatCount="indefinite" />
              <animate attributeName="opacity" from="0.9" to="0" dur={b.dur} begin={b.delay} repeatCount="indefinite" />
            </circle>
          ))}
        </g>
      )}
      {/* 吸氧腐蚀：正极附近溶液微微泛红（含酚酞时 OH⁻ 显色） */}
      {connected && r.oxygenAbsorption && (
        <ellipse cx="136" cy="150" rx="14" ry="20" fill="#ec6a9c" opacity="0.18" clipPath="url(#gv-inner)" />
      )}

      {/* 烧杯轮廓 */}
      <path d="M40 92 L40 196 A60 13 0 0 0 160 196 L160 92" fill="none" stroke="currentColor" strokeWidth="3" className="text-foreground/55" />
      <ellipse cx="100" cy="92" rx="60" ry="12" fill="none" stroke="currentColor" strokeWidth="3" className="text-foreground/55" />
    </svg>
  );
}
