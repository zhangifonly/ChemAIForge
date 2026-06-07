"use client";

import type { SessionMeasurement } from "@/server/session/types";

// 轻量 SVG 折线图：在同一坐标系内绘制 pH 与温度两条折线，避免引入图表库。
export function MeasurementChart({
  measurements,
}: {
  measurements: SessionMeasurement[];
}) {
  if (measurements.length === 0) {
    return (
      <p className="text-sm text-foreground/50">本次实验未记录任何读数。</p>
    );
  }

  const W = 480;
  const H = 200;
  const PAD = 32;
  const n = measurements.length;

  // 将一组数值映射为折线 points 字符串（按各自值域归一化到画布高度）
  const toPoints = (values: number[]) => {
    const min = Math.min(...values);
    const max = Math.max(...values);
    const span = max - min || 1;
    return values
      .map((v, i) => {
        const x = n === 1 ? W / 2 : PAD + (i * (W - 2 * PAD)) / (n - 1);
        const y = H - PAD - ((v - min) / span) * (H - 2 * PAD);
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(" ");
  };

  const phPoints = toPoints(measurements.map((m) => m.ph));
  const tempPoints = toPoints(measurements.map((m) => m.temperature));

  return (
    <div className="flex flex-col gap-2">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full rounded-lg border border-foreground/10 bg-foreground/[0.02]"
        role="img"
        aria-label="测量读数随时间变化折线图"
      >
        <polyline
          points={phPoints}
          fill="none"
          stroke="#2563eb"
          strokeWidth={2}
        />
        <polyline
          points={tempPoints}
          fill="none"
          stroke="#dc2626"
          strokeWidth={2}
        />
      </svg>
      <div className="flex gap-4 text-xs text-foreground/60">
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-3 rounded-sm bg-[#2563eb]" /> pH
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-3 rounded-sm bg-[#dc2626]" /> 温度(℃)
        </span>
      </div>
    </div>
  );
}
