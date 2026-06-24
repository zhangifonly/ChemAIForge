"use client";

// 导气 → 液体吸收 / 检验装置：左侧发生试管(可加热)经导管把气体通入右侧接收试管的
// 吸收液中。导管口在液面上方防倒吸；产气时液面有气泡逸出。纯展示组件。
// 适用：乙酸乙酯(导入饱和碳酸钠)、碳酸盐检验(石灰水)、乙烯/SO₂入溴水等。

export function GasDelivery({
  delivering = false,
  hot = false,
  absorbentLabel = "吸收液",
}: {
  // 是否正在导气（主容器产气时为 true）
  delivering?: boolean;
  // 发生试管是否加热（显示酒精灯火焰）
  hot?: boolean;
  // 接收瓶液体说明文字
  absorbentLabel?: string;
}) {
  return (
    <svg
      width="220"
      height="244"
      viewBox="0 0 260 244"
      role="img"
      aria-label="导气吸收装置"
      className="drop-shadow-[0_18px_24px_rgba(15,57,52,0.14)]"
    >
      <defs>
        <linearGradient id="gd-absorb" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#dfeefb" />
          <stop offset="100%" stopColor="#a9d8f5" />
        </linearGradient>
        <radialGradient id="gd-glow" cx="50%" cy="60%" r="60%">
          <stop offset="0%" stopColor="rgba(255,170,60,0.45)" />
          <stop offset="100%" stopColor="rgba(255,170,60,0)" />
        </radialGradient>
        <clipPath id="gd-recv">
          <path d="M150 96 L150 196 A22 22 0 0 0 194 196 L194 96 Z" />
        </clipPath>
      </defs>

      {/* —— 发生试管（左，倾斜加热）—— */}
      <g transform="rotate(18 70 120)">
        <path d="M52 60 L52 150 A18 18 0 0 0 88 150 L88 60 Z" fill="rgba(214,238,236,0.18)" stroke="currentColor" strokeWidth="3" className="text-foreground/55" strokeLinejoin="round" />
        <ellipse cx="70" cy="60" rx="18" ry="5" fill="none" stroke="currentColor" strokeWidth="3" className="text-foreground/55" />
        {/* 试管内少量液体 */}
        <path d="M54 120 L54 150 A16 16 0 0 0 86 150 L86 120 Z" fill="#e8dfa0" opacity="0.7" />
      </g>

      {/* 酒精灯火焰（加热发生试管底部） */}
      {hot && (
        <g transform="translate(96 168)">
          <ellipse cx="0" cy="14" rx="22" ry="10" fill="url(#gd-glow)" />
          <g>
            <animateTransform attributeName="transform" type="translate" values="-0.6 0;0.6 0;-0.6 0" dur="0.6s" repeatCount="indefinite" />
            <path d="M0 16 C -8 11, -7 2, 0 -3 C 7 2, 8 11, 0 16 Z" fill="#ff8a3c" />
            <path d="M0 15 C -4 11, -3.5 4, 0 0 C 3.5 4, 4 11, 0 15 Z" fill="#ffd24a" />
          </g>
        </g>
      )}

      {/* 导管：发生试管口 → 弯折 → 伸入接收试管(导管口在液面上方防倒吸) */}
      <path d="M92 56 L112 50 L172 50 L172 110" fill="none" stroke="currentColor" strokeWidth="3" className="text-foreground/55" strokeLinecap="round" strokeLinejoin="round" />

      {/* —— 接收试管（右，竖直，含吸收液）—— */}
      <g clipPath="url(#gd-recv)">
        <rect x="150" y="130" width="44" height="80" fill="url(#gd-absorb)" />
        <ellipse cx="172" cy="130" rx="22" ry="6" fill="#cfe7fb" />
      </g>
      <path d="M150 96 L150 196 A22 22 0 0 0 194 196 L194 96 Z" fill="none" stroke="currentColor" strokeWidth="3" className="text-foreground/55" strokeLinejoin="round" />
      <ellipse cx="172" cy="96" rx="22" ry="6" fill="none" stroke="currentColor" strokeWidth="3" className="text-foreground/55" />

      {/* 导气时：导管口下方液体冒泡 */}
      {delivering &&
        [
          { cx: 172, r: 3.5, dur: "1.5s", delay: "0s" },
          { cx: 168, r: 3, dur: "1.8s", delay: "0.5s" },
          { cx: 176, r: 3, dur: "1.4s", delay: "0.9s" },
        ].map((b, i) => (
          <circle key={i} cx={b.cx} r={b.r} fill="#ffffff" opacity="0.85">
            <animate attributeName="cy" from="140" to="196" dur={b.dur} begin={b.delay} repeatCount="indefinite" />
            <animate attributeName="opacity" from="0.2" to="0.9" dur={b.dur} begin={b.delay} repeatCount="indefinite" />
          </circle>
        ))}

      {/* 吸收液说明 */}
      <text x="172" y="226" textAnchor="middle" fontSize="11" className="fill-foreground/55">
        {absorbentLabel}
      </text>
    </svg>
  );
}
