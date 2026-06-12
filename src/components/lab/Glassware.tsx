"use client";

// 立体器皿可视化：按 vesselGeom 渲染烧杯 / 锥形瓶 / 试管，液体颜色、气泡、沉淀、
// 蒸汽等现象全部来自引擎返回的 ReactionResult 与几何参数，本组件不含任何反应规则。
import type { ReactionResult } from "@/lib/chem/engine";
import { VESSELS, type VesselKind } from "./vesselGeom";

// 液体上下渐变色，优先级：浑浊沉淀 > 指示剂变色 > 反应后绿 > 溶质特征色 > 清液
function liquidColors(
  result: ReactionResult | null,
  tint?: { top: string; bottom: string },
): { top: string; bottom: string } {
  if (result?.reacted && result.producesPrecipitate)
    return { top: "#eef3f8", bottom: "#cdd8e4" };
  if (result?.reacted && result.colorChange)
    return { top: "#ffd9e6", bottom: "#f7a8c4" };
  if (result?.reacted && !tint) return { top: "#d3f0d6", bottom: "#a7dcae" };
  if (tint) return tint;
  return { top: "#dcefff", bottom: "#a9d8f5" };
}

export function Glassware({
  kind = "beaker",
  result,
  fill = 0,
  tint,
  hot = false,
}: {
  kind?: VesselKind;
  result: ReactionResult | null;
  fill?: number;
  tint?: { top: string; bottom: string };
  hot?: boolean;
}) {
  const g = VESSELS[kind];
  const { top, bottom } = liquidColors(result, tint);
  const showBubbles = Boolean(result?.reacted && result.producesGas);
  const showPrecipitate = Boolean(result?.reacted && result.producesPrecipitate);
  const showSteam = hot || (result?.reacted && result.thermal === "exothermic");
  const hasLiquid = fill > 0.001;

  const { left, right, topY, bottomY } = g.liquid;
  const clamped = Math.max(0, Math.min(1, fill));
  const surfaceY = bottomY - clamped * (bottomY - topY);
  const surfaceRx = g.surfaceRxAt(surfaceY);
  const uid = `v-${kind}`;

  return (
    <svg
      width="200"
      height="244"
      viewBox="0 0 200 244"
      role="img"
      aria-label="实验器皿"
      className="drop-shadow-[0_18px_24px_rgba(15,57,52,0.18)]"
    >
      <defs>
        <linearGradient id={`${uid}-liquid`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={top} />
          <stop offset="100%" stopColor={bottom} />
        </linearGradient>
        <linearGradient id={`${uid}-glass`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="rgba(255,255,255,0.55)" />
          <stop offset="14%" stopColor="rgba(255,255,255,0.08)" />
          <stop offset="50%" stopColor="rgba(255,255,255,0)" />
          <stop offset="86%" stopColor="rgba(255,255,255,0.06)" />
          <stop offset="100%" stopColor="rgba(255,255,255,0.32)" />
        </linearGradient>
        <clipPath id={`${uid}-inner`}>
          <path d={g.innerClip} />
        </clipPath>
        <radialGradient id={`${uid}-glow`} cx="50%" cy="60%" r="60%">
          <stop offset="0%" stopColor="rgba(255,170,60,0.45)" />
          <stop offset="100%" stopColor="rgba(255,170,60,0)" />
        </radialGradient>
      </defs>

      {/* 底部：加热时显示酒精灯火焰，否则显示桌面投影 */}
      {showSteam ? (
        <g transform={`translate(100 ${g.heatY})`}>
          {/* 暖光 */}
          <ellipse cx="0" cy="20" rx="30" ry="13" fill={`url(#${uid}-glow)`} />
          {/* 火焰：外焰橙 / 内焰黄 / 焰心蓝，轻微摇曳 */}
          <g>
            <animateTransform attributeName="transform" type="translate" values="-0.8 0;0.8 0;-0.8 0" dur="0.6s" repeatCount="indefinite" />
            <path d="M0 22 C -9 16, -8 4, 0 -2 C 8 4, 9 16, 0 22 Z" fill="#ff8a3c">
              <animate attributeName="opacity" values="0.9;1;0.85;0.9" dur="0.5s" repeatCount="indefinite" />
            </path>
            <path d="M0 21 C -5 16, -4.5 7, 0 2 C 4.5 7, 5 16, 0 21 Z" fill="#ffd24a" />
            <path d="M0 20 C -2.5 16, -2 11, 0 7 C 2 11, 2.5 16, 0 20 Z" fill="#7ec8ff" />
          </g>
        </g>
      ) : (
        <ellipse
          cx={g.shadow.cx}
          cy={g.shadow.cy}
          rx={g.shadow.rx}
          ry={g.shadow.ry}
          fill="rgba(15,57,52,0.10)"
        />
      )}

      {/* 液体 */}
      {hasLiquid && (
        <g clipPath={`url(#${uid}-inner)`}>
          <rect
            x={left}
            y={surfaceY}
            width={right - left}
            height={bottomY - surfaceY + 16}
            fill={`url(#${uid}-liquid)`}
            className="transition-[fill] duration-700"
          />
          <ellipse cx="100" cy={surfaceY} rx={surfaceRx} ry="7" fill={top} opacity="0.9" />
          <ellipse cx="100" cy={surfaceY} rx={surfaceRx} ry="7" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="1.2" />
        </g>
      )}

      {/* 沉淀：底部颗粒群淡入下沉 */}
      {showPrecipitate && (
        <g clipPath={`url(#${uid}-inner)`}>
          {g.precipCx.map((cx, i) => (
            <ellipse key={i} cx={cx} cy={bottomY - 4} rx="15" ry={i < 3 ? 8 : 6} fill="#aeb9c6" opacity="0">
              <animate attributeName="opacity" from="0" to="0.92" dur="0.9s" begin={`${i * 0.12}s`} fill="freeze" />
              <animate attributeName="cy" from={bottomY - 14} to={bottomY - 4} dur="0.9s" begin={`${i * 0.12}s`} fill="freeze" />
            </ellipse>
          ))}
        </g>
      )}

      {/* 气泡：自底部上升至液面 */}
      {showBubbles && hasLiquid && (
        <g clipPath={`url(#${uid}-inner)`}>
          {g.bubbleXs.map((cx, i) => {
            const dur = `${1.4 + (i % 3) * 0.3}s`;
            const r = 3 + (i % 3);
            return (
              <circle key={i} cx={cx} r={r} fill="#ffffff" opacity="0.85">
                <animate attributeName="cy" from={bottomY - 6} to={surfaceY} dur={dur} begin={`${i * 0.3}s`} repeatCount="indefinite" />
                <animate attributeName="opacity" from="0.85" to="0" dur={dur} begin={`${i * 0.3}s`} repeatCount="indefinite" />
              </circle>
            );
          })}
        </g>
      )}

      {/* 放热 / 加热蒸汽：液面之上升腾 */}
      {showSteam && hasLiquid && (
        <g opacity="0.5">
          {[88, 104, 120].map((x, i) => (
            <path
              key={x}
              d={`M${x} ${surfaceY - 2} q -7 -12 0 -22 q 7 -10 0 -22`}
              fill="none"
              stroke="#ffffff"
              strokeWidth="3"
              strokeLinecap="round"
            >
              <animate attributeName="opacity" from="0" to="0.6" dur="2.2s" begin={`${i * 0.5}s`} repeatCount="indefinite" />
              <animateTransform attributeName="transform" type="translate" from="0 6" to="0 -10" dur="2.2s" begin={`${i * 0.5}s`} repeatCount="indefinite" />
            </path>
          ))}
        </g>
      )}

      {/* 刻度 */}
      {g.ticks.map((y) => (
        <line
          key={y}
          x1={g.tickX}
          y1={y}
          x2={g.tickX + 10}
          y2={y}
          stroke="currentColor"
          strokeWidth="1.4"
          className="text-foreground/35"
          strokeLinecap="round"
        />
      ))}

      {/* 玻璃高光叠层 */}
      <path d={g.innerClip} fill={`url(#${uid}-glass)`} />

      {/* 轮廓 + 杯口 + 倾倒嘴 */}
      <path
        d={g.outline}
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        className="text-foreground/55"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <ellipse
        cx={g.rim.cx}
        cy={g.rim.cy}
        rx={g.rim.rx}
        ry={g.rim.ry}
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        className="text-foreground/55"
      />
      {g.spout && (
        <path
          d={g.spout}
          fill="none"
          stroke="currentColor"
          strokeWidth="2.4"
          className="text-foreground/55"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
    </svg>
  );
}
