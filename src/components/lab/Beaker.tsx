"use client";

// 烧杯可视化：根据引擎返回的反应结果以 SVG 渲染液体颜色、气泡与沉淀。
// 纯展示组件，所有现象判断来自传入的 ReactionResult，不含反应规则。
import type { ReactionResult } from "@/lib/chem/engine";

// 根据反应结果推导液体颜色（仅用于可视化，与反应规则无关）
function liquidColor(result: ReactionResult | null): string {
  if (!result || !result.reacted) return "#cfe8ff"; // 默认浅蓝（清液）
  if (result.producesPrecipitate) return "#e8eef5"; // 浑浊
  if (result.colorChange) return "#ffd1e0"; // 变色（如指示剂变红）
  return "#bfe3c4"; // 反应后淡绿
}

export function Beaker({ result }: { result: ReactionResult | null }) {
  const color = liquidColor(result);
  const showBubbles = Boolean(result?.reacted && result.producesGas);
  const showPrecipitate = Boolean(result?.reacted && result.producesPrecipitate);

  return (
    <svg
      width="160"
      height="180"
      viewBox="0 0 160 180"
      role="img"
      aria-label="实验烧杯"
    >
      {/* 液体 */}
      <path
        d="M40 70 H120 V150 a8 8 0 0 1 -8 8 H48 a8 8 0 0 1 -8 -8 Z"
        fill={color}
        className="transition-[fill] duration-500"
      />

      {/* 沉淀：底部堆积颗粒 */}
      {showPrecipitate && (
        <path
          d="M44 140 H116 V150 a8 8 0 0 1 -8 8 H52 a8 8 0 0 1 -8 -8 Z"
          fill="#9aa7b5"
        />
      )}

      {/* 气泡：上升动画 */}
      {showBubbles &&
        [
          { cx: 60, r: 4, delay: "0s" },
          { cx: 80, r: 5, delay: "0.4s" },
          { cx: 100, r: 3, delay: "0.8s" },
        ].map((b, i) => (
          <circle key={i} cx={b.cx} cy={140} r={b.r} fill="#ffffff" opacity="0.8">
            <animate
              attributeName="cy"
              from="145"
              to="75"
              dur="1.5s"
              begin={b.delay}
              repeatCount="indefinite"
            />
            <animate
              attributeName="opacity"
              from="0.8"
              to="0"
              dur="1.5s"
              begin={b.delay}
              repeatCount="indefinite"
            />
          </circle>
        ))}

      {/* 烧杯轮廓（覆盖在液体之上） */}
      <path
        d="M40 60 V150 a10 10 0 0 0 10 10 H110 a10 10 0 0 0 10 -10 V60"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        className="text-foreground/60"
        strokeLinecap="round"
      />
      {/* 杯口 */}
      <line
        x1="34"
        y1="60"
        x2="126"
        y2="60"
        stroke="currentColor"
        strokeWidth="3"
        className="text-foreground/60"
        strokeLinecap="round"
      />
    </svg>
  );
}
