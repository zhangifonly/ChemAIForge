"use client";

// 焰色反应装置：铂丝蘸取金属盐在酒精灯外焰上灼烧，火焰呈现该金属离子的特征焰色。
// 纯展示组件，焰色由所选金属盐决定（钠黄、钾紫、钙砖红、铜绿等）。

// 金属盐化学式 / 名称 → 特征焰色
const FLAME_COLOR: { test: RegExp; color: string; outer: string; label: string }[] = [
  { test: /Na|钠/, color: "#ffd24a", outer: "#ffb13c", label: "钠 · 黄色" },
  { test: /^K|钾/, color: "#d08be0", outer: "#a85fd0", label: "钾 · 紫色（透过蓝色钴玻璃）" },
  { test: /Ca|钙/, color: "#ff8a5c", outer: "#e85a2c", label: "钙 · 砖红色" },
  { test: /Cu|铜/, color: "#7fe0a0", outer: "#3fae6e", label: "铜 · 绿色" },
  { test: /Sr|锶/, color: "#ff6a7c", outer: "#e0394c", label: "锶 · 洋红色" },
  { test: /Ba|钡/, color: "#bfe07a", outer: "#9bc04a", label: "钡 · 黄绿色" },
  { test: /Li|锂/, color: "#ff7a8c", outer: "#e0495c", label: "锂 · 紫红色" },
];

const DEFAULT = { color: "#7ec8ff", outer: "#4a9be0", label: "酒精灯本色（蘸取金属盐后观察）" };

export function FlameTest({ sample }: { sample?: string }) {
  const hit = sample
    ? FLAME_COLOR.find((c) => c.test.test(sample)) ?? DEFAULT
    : DEFAULT;

  return (
    <svg
      width="200"
      height="244"
      viewBox="0 0 200 244"
      role="img"
      aria-label="焰色反应装置"
      className="drop-shadow-[0_18px_24px_rgba(15,57,52,0.14)]"
    >
      <defs>
        <radialGradient id="ft-glow" cx="50%" cy="60%" r="55%">
          <stop offset="0%" stopColor={hit.color} stopOpacity="0.5" />
          <stop offset="100%" stopColor={hit.color} stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* 焰色光晕 */}
      <ellipse cx="100" cy="96" rx="48" ry="56" fill="url(#ft-glow)" className="transition-[fill] duration-700" />

      {/* 焰色火焰（外焰 + 内焰随金属离子变色，摇曳） */}
      <g>
        <animateTransform attributeName="transform" type="translate" values="-1 0;1 0;-1 0" dur="0.7s" repeatCount="indefinite" />
        <path d="M100 150 C 78 120, 82 70, 100 40 C 118 70, 122 120, 100 150 Z" fill={hit.outer} className="transition-[fill] duration-700">
          <animate attributeName="opacity" values="0.85;1;0.9;0.85" dur="0.6s" repeatCount="indefinite" />
        </path>
        <path d="M100 146 C 86 122, 88 84, 100 60 C 112 84, 114 122, 100 146 Z" fill={hit.color} className="transition-[fill] duration-700" />
        <path d="M100 144 C 94 126, 95 100, 100 84 C 105 100, 106 126, 100 144 Z" fill="#ffffff" opacity="0.45" />
      </g>

      {/* 铂丝（从右上斜插入火焰，蘸取样品端在焰中） */}
      <path d="M168 56 L132 92 L108 108" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-foreground/55" strokeLinecap="round" />
      <circle cx="108" cy="108" r="3" fill="#c0612f" />

      {/* 酒精灯（灯身 + 灯芯 + 灯帽口） */}
      <g className="text-foreground/55">
        <path d="M78 196 Q78 168 90 162 L110 162 Q122 168 122 196 A22 8 0 0 1 78 196 Z" fill="rgba(214,238,236,0.2)" stroke="currentColor" strokeWidth="3" strokeLinejoin="round" />
        <rect x="92" y="150" width="16" height="14" rx="2" fill="#cdd8e4" stroke="currentColor" strokeWidth="2" />
        <line x1="100" y1="150" x2="100" y2="150" stroke="#8a5a2c" strokeWidth="3" />
        <ellipse cx="100" cy="196" rx="22" ry="8" fill="none" stroke="currentColor" strokeWidth="3" />
      </g>

      {/* 焰色说明 */}
      <text x="100" y="226" textAnchor="middle" fontSize="11" className="fill-foreground/60">
        {hit.label}
      </text>
    </svg>
  );
}
