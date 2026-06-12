"use client";

// 排水法集气装置：水槽 + 倒置集气瓶 + 导管。当主容器发生产气反应（collecting）时，
// 气泡经导管升入瓶顶、把水排开（瓶内水位下降）。纯展示，由 LabCanvas 传入 collecting。

export function GasCollection({ collecting = false }: { collecting?: boolean }) {
  // 瓶内：collecting 时顶部约 60% 已集气体，水位降到 ~138；否则满水
  const gasFill = collecting ? 0.6 : 0;
  const bTop = 62;
  const bMouth = 188;
  const waterTopY = bTop + gasFill * (bMouth - bTop);

  return (
    <svg
      width="190"
      height="244"
      viewBox="0 0 240 244"
      role="img"
      aria-label="排水法集气装置"
      className="drop-shadow-[0_18px_24px_rgba(15,57,52,0.14)]"
    >
      <defs>
        <linearGradient id="gc-water" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#bfe3ff" />
          <stop offset="100%" stopColor="#86c4ef" />
        </linearGradient>
        <clipPath id="gc-bottle">
          <path d="M86 62 L86 188 L154 188 L154 62 A34 10 0 0 0 86 62 Z" />
        </clipPath>
        <clipPath id="gc-trough">
          <path d="M30 168 L36 214 L204 214 L210 168 Z" />
        </clipPath>
      </defs>

      {/* 水槽 */}
      <g clipPath="url(#gc-trough)">
        <rect x="30" y="182" width="180" height="40" fill="url(#gc-water)" />
      </g>
      <path d="M30 168 L36 214 L204 214 L210 168" fill="none" stroke="currentColor" strokeWidth="3" className="text-foreground/55" strokeLinejoin="round" />

      {/* 集气瓶内水（上方留空 = 已集气体） */}
      <g clipPath="url(#gc-bottle)">
        <rect
          x="86"
          y={waterTopY}
          width="68"
          height={bMouth - waterTopY}
          fill="url(#gc-water)"
          className="transition-all duration-[1200ms]"
        />
        <ellipse cx="120" cy={waterTopY} rx="34" ry="6" fill="#bfe3ff" className="transition-all duration-[1200ms]" />
      </g>

      {/* 导管：左侧发生装置 → 入水 → 弯入瓶口 */}
      <path d="M8 150 L8 200 L120 200 L120 168" fill="none" stroke="currentColor" strokeWidth="3" className="text-foreground/55" strokeLinecap="round" strokeLinejoin="round" />

      {/* 集气瓶轮廓（倒置：圆顶在上、瓶口入水） */}
      <path
        d="M86 62 A34 10 0 0 1 154 62 L154 188 L86 188 Z"
        fill="rgba(214,238,236,0.16)"
        stroke="currentColor"
        strokeWidth="3"
        className="text-foreground/55"
        strokeLinejoin="round"
      />

      {/* 气泡：产气时从导管口升入瓶顶 */}
      {collecting &&
        [
          { cx: 120, r: 4, dur: "1.6s", delay: "0s" },
          { cx: 116, r: 3, dur: "1.9s", delay: "0.5s" },
          { cx: 124, r: 3.5, dur: "1.4s", delay: "0.9s" },
        ].map((b, i) => (
          <circle key={i} cx={b.cx} r={b.r} fill="#ffffff" opacity="0.85">
            <animate attributeName="cy" from="166" to={waterTopY + 4} dur={b.dur} begin={b.delay} repeatCount="indefinite" />
            <animate attributeName="opacity" from="0.85" to="0" dur={b.dur} begin={b.delay} repeatCount="indefinite" />
          </circle>
        ))}
    </svg>
  );
}
