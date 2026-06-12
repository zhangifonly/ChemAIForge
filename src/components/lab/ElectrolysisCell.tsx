"use client";

// 电解槽可视化：电源 + 双电极 + 电解液。完全由 electrolyze() 的放电结果驱动——
// 阴极析金属 / 出气泡、阳极出气泡 / 溶解、铜离子析出时溶液变浅。本组件不含化学规则。
import { electrolyze } from "@/lib/chem/electrolysis";

// 电解液底色（仅可视化）
const ELECTROLYTE_COLOR: Record<string, { top: string; bottom: string }> = {
  CuSO4: { top: "#7cc0ea", bottom: "#2f7fc7" },
  CuCl2: { top: "#7fcadf", bottom: "#2f9bbf" },
  AgNO3: { top: "#dcefff", bottom: "#a9d8f5" },
};

// 阳极气体配色
const ANODE_GAS_FILL: Record<string, string> = {
  Cl2: "#e6f5cf",
  O2: "#ffffff",
  Br2: "#e8c4a0",
};

export function ElectrolysisCell({
  electrolyte,
  inertAnode = true,
  powered = false,
}: {
  electrolyte: string;
  inertAnode?: boolean;
  powered?: boolean;
}) {
  const result = electrolyze(electrolyte, { inertAnode });
  const base = ELECTROLYTE_COLOR[electrolyte] ?? { top: "#dcefff", bottom: "#a9d8f5" };
  // 铜离子析出 → 通电后溶液变浅
  const liquid = powered && result?.colorFades ? { top: "#d6e9f5", bottom: "#9fc6e0" } : base;

  const cathodeMetal = powered && result?.cathode.kind === "metal";
  const cathodeGas = powered && result?.cathode.kind === "gas";
  const anodeGas = powered && result?.anode.kind === "gas";
  const anodeDissolve = powered && result?.anode.kind === "dissolve";
  const anodeFill = ANODE_GAS_FILL[result?.anode.product ?? ""] ?? "#ffffff";

  return (
    <svg width="200" height="244" viewBox="0 0 220 244" role="img" aria-label="电解槽" className="drop-shadow-[0_18px_24px_rgba(15,57,52,0.16)]">
      <defs>
        <linearGradient id="ec-liquid" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={liquid.top} />
          <stop offset="100%" stopColor={liquid.bottom} />
        </linearGradient>
        <clipPath id="ec-inner">
          <path d="M46 96 L46 196 A54 12 0 0 0 154 196 L154 96 Z" />
        </clipPath>
      </defs>

      {/* 电源 + 端子 + 导线 */}
      <rect x="74" y="14" width="72" height="26" rx="5" fill="#e7edf2" stroke="currentColor" strokeWidth="2.5" className="text-foreground/55" />
      <text x="86" y="33" fontSize="16" fontWeight="bold" fill="#c0392b">−</text>
      <text x="127" y="32" fontSize="15" fontWeight="bold" fill="#2c3e50">+</text>
      <path d="M86 40 L86 58" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-foreground/55" />
      <path d="M134 40 L134 58" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-foreground/55" />
      {/* 通电指示：导线高亮 */}
      {powered && (
        <>
          <path d="M86 40 L86 58" fill="none" stroke="#f0a73c" strokeWidth="2.5">
            <animate attributeName="opacity" values="0.3;1;0.3" dur="1s" repeatCount="indefinite" />
          </path>
          <path d="M134 40 L134 58" fill="none" stroke="#f0a73c" strokeWidth="2.5">
            <animate attributeName="opacity" values="0.3;1;0.3" dur="1s" repeatCount="indefinite" />
          </path>
        </>
      )}

      {/* 电解液 */}
      <g clipPath="url(#ec-inner)">
        <rect x="46" y="110" width="108" height="90" fill="url(#ec-liquid)" className="transition-[fill] duration-[1500ms]" />
        <ellipse cx="100" cy="110" rx="54" ry="8" fill={liquid.top} />
      </g>

      {/* 阴极（左，接负极）：碳棒 + 通电后析金属(红铜) */}
      <rect x="80" y="58" width="8" height="100" rx="2" fill="#5a6470" />
      {cathodeMetal && (
        <rect x="78" y="118" width="12" height="40" rx="2" fill="#c0612f">
          <animate attributeName="y" from="150" to="118" dur="1.4s" fill="freeze" />
          <animate attributeName="height" from="8" to="40" dur="1.4s" fill="freeze" />
        </rect>
      )}
      {cathodeGas && <ElectrodeBubbles x={84} fill="#ffffff" />}

      {/* 阳极（右，接正极）：碳棒 + 通电后出气泡 / 活性电极溶解 */}
      <rect x="132" y="58" width="8" height={anodeDissolve ? 78 : 100} rx="2" fill={anodeDissolve ? "#c0612f" : "#5a6470"} className="transition-all duration-[1500ms]" />
      {anodeGas && <ElectrodeBubbles x={136} fill={anodeFill} />}

      {/* 烧杯轮廓 */}
      <path d="M40 92 L40 196 A60 13 0 0 0 160 196 L160 92" fill="none" stroke="currentColor" strokeWidth="3" className="text-foreground/55" />
      <ellipse cx="100" cy="92" rx="60" ry="12" fill="none" stroke="currentColor" strokeWidth="3" className="text-foreground/55" />
    </svg>
  );
}

// 电极上升气泡（在液面与电极底之间循环上升）
function ElectrodeBubbles({ x, fill }: { x: number; fill: string }) {
  return (
    <g clipPath="url(#ec-inner)">
      {[
        { r: 3, dur: "1.5s", delay: "0s" },
        { r: 2.5, dur: "1.8s", delay: "0.5s" },
        { r: 3.5, dur: "1.4s", delay: "0.9s" },
      ].map((b, i) => (
        <circle key={i} cx={x + (i % 2 === 0 ? 0 : 2)} r={b.r} fill={fill} stroke="rgba(70,96,106,0.25)" strokeWidth="0.5" opacity="0.9">
          <animate attributeName="cy" from="155" to="115" dur={b.dur} begin={b.delay} repeatCount="indefinite" />
          <animate attributeName="opacity" from="0.9" to="0" dur={b.dur} begin={b.delay} repeatCount="indefinite" />
        </circle>
      ))}
    </g>
  );
}
