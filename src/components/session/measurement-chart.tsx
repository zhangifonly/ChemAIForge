"use client";

import type { SessionMeasurement } from "@/server/session/types";
import {
  CHART_H,
  CHART_PAD,
  CHART_W,
  PH_RANGE,
  TEMP_RANGE,
  axisTicks,
  toPolyline,
} from "./chartGeom";

const PH_COLOR = "#2563eb";
const TEMP_COLOR = "#dc2626";

// 轻量 SVG 折线图：在同一坐标系内绘制 pH 与温度两条折线，避免引入图表库。
// 两条线按各自的固定量程（pH 0~14、温度 0~100）定位，并在左右两侧标出刻度 ——
// 详见 chartGeom.ts 顶部关于「为什么不做自适应归一化」的说明。
export function MeasurementChart({
  measurements,
}: {
  measurements: SessionMeasurement[];
}) {
  if (measurements.length === 0) {
    return (
      <p className="text-sm text-foreground/65">本次实验未记录任何读数。</p>
    );
  }

  const phPoints = toPolyline(measurements.map((m) => m.ph), PH_RANGE);
  const tempPoints = toPolyline(
    measurements.map((m) => m.temperature),
    TEMP_RANGE,
  );
  const phTicks = axisTicks(PH_RANGE);
  const tempTicks = axisTicks(TEMP_RANGE);

  return (
    <div className="flex flex-col gap-2">
      <svg
        viewBox={`0 0 ${CHART_W} ${CHART_H}`}
        className="w-full rounded-lg border border-foreground/10 bg-foreground/[0.02]"
        role="img"
        aria-label={`测量读数随时间变化折线图，共 ${measurements.length} 条读数，pH 量程 0 至 14，温度量程 0 至 100 摄氏度`}
      >
        {/* 横向网格线（跟随 pH 刻度，两条量程等分数相同故网格共用） */}
        {phTicks.map((t) => (
          <line
            key={`grid-${t.value}`}
            x1={CHART_PAD}
            x2={CHART_W - CHART_PAD}
            y1={t.y}
            y2={t.y}
            stroke="currentColor"
            strokeWidth={1}
            className="text-foreground/10"
          />
        ))}

        {/* 左侧 pH 刻度 */}
        {phTicks.map((t) => (
          <text
            key={`ph-${t.value}`}
            x={CHART_PAD - 6}
            y={t.y + 3}
            textAnchor="end"
            fontSize={9}
            fill={PH_COLOR}
          >
            {t.value.toFixed(0)}
          </text>
        ))}

        {/* 右侧温度刻度 */}
        {tempTicks.map((t) => (
          <text
            key={`temp-${t.value}`}
            x={CHART_W - CHART_PAD + 6}
            y={t.y + 3}
            textAnchor="start"
            fontSize={9}
            fill={TEMP_COLOR}
          >
            {t.value.toFixed(0)}
          </text>
        ))}

        <polyline
          points={phPoints}
          fill="none"
          stroke={PH_COLOR}
          strokeWidth={2}
        />
        <polyline
          points={tempPoints}
          fill="none"
          stroke={TEMP_COLOR}
          strokeWidth={2}
          strokeDasharray="5 3"
        />
      </svg>
      <div className="flex gap-4 text-xs text-foreground/60">
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-3 rounded-sm bg-[#2563eb]" /> pH（左轴 0~14）
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-3 rounded-sm bg-[#dc2626]" /> 温度℃（右轴 0~100，虚线）
        </span>
      </div>
    </div>
  );
}
