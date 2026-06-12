"use client";

// 实验参数面板（借鉴 mathviz ParameterPanel 的精致滑块）：轨道 + 渐变填充 +
// 透明原生 range 叠加交互 + 数值徽标，统一品牌青色主题。纯展示，受控组件。

export interface SliderParam {
  key: string;
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
}

export function ControlPanel({
  title,
  params,
  onChange,
}: {
  title: string;
  params: SliderParam[];
  onChange: (key: string, value: number) => void;
}) {
  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-foreground/10 bg-surface/60 p-5 shadow-soft">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground/75">
        <span className="h-4 w-1 rounded-full bg-gradient-to-b from-brand-400 to-brand-600" />
        {title}
      </h3>

      {params.map((p) => {
        const pct = ((p.value - p.min) / (p.max - p.min)) * 100;
        const decimals = p.step && p.step < 1 ? 1 : 0;
        return (
          <div key={p.key} className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label className="text-sm text-foreground/65">{p.label}</label>
              <span className="rounded-lg bg-brand-500/10 px-2.5 py-0.5 text-sm font-semibold tabular-nums text-brand-600 dark:text-brand-300">
                {p.value.toFixed(decimals)}
                {p.unit ? (
                  <span className="ml-0.5 text-brand-500/70">{p.unit}</span>
                ) : null}
              </span>
            </div>

            {/* 轨道 + 填充 + 透明原生 range */}
            <div className="relative flex h-6 items-center">
              <div className="absolute inset-x-0 h-2 overflow-hidden rounded-full bg-foreground/10">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-brand-400 to-brand-600 transition-all duration-150"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <input
                type="range"
                min={p.min}
                max={p.max}
                step={p.step ?? 1}
                value={p.value}
                onChange={(e) => onChange(p.key, parseFloat(e.target.value))}
                aria-label={p.label}
                className="relative z-10 h-6 w-full cursor-pointer appearance-none bg-transparent
                  [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4
                  [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full
                  [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-brand-500
                  [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow-soft
                  [&::-webkit-slider-thumb]:transition-transform [&::-webkit-slider-thumb]:hover:scale-110"
              />
            </div>

            <div className="flex justify-between text-xs text-foreground/35">
              <span>
                {p.min}
                {p.unit}
              </span>
              <span>
                {p.max}
                {p.unit}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
