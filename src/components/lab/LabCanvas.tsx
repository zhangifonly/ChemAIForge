"use client";

// 实验画布交互组件：从试剂面板拖拽试剂到烧杯，点击混合触发反应引擎，
// 并以 SVG 渲染变色/气泡/沉淀等视觉反馈与实时 pH/温度读数。
// 反应判定一律委托 src/lib/chem/engine，本组件不含任何反应规则。
import { useState } from "react";
import { useLabStore } from "./labStore";
import { resolveSubstance } from "./reagents";
import { Beaker } from "./Beaker";

const DRAG_KEY = "application/x-reagent";

export function LabCanvas({
  reagents,
  apparatus,
}: {
  reagents: string[];
  apparatus: string[];
}) {
  const { contents, result, readings, addReagent, mix, reset } = useLabStore();
  // 拖拽悬停高亮容器
  const [dragOver, setDragOver] = useState(false);

  // 处理试剂放入容器：解析为引擎可识别的 Substance 后入容器
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const label = e.dataTransfer.getData(DRAG_KEY);
    if (label) addReagent(resolveSubstance(label));
  };

  return (
    <div className="grid gap-6 md:grid-cols-[220px_1fr]">
      {/* 试剂面板 */}
      <aside className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-foreground/70">试剂面板</h2>
        <ul className="flex flex-col gap-2">
          {reagents.map((label) => (
            <li
              key={label}
              draggable
              onDragStart={(e) => e.dataTransfer.setData(DRAG_KEY, label)}
              className="cursor-grab rounded-lg border border-foreground/15 bg-foreground/5 px-3 py-2 text-sm transition-colors hover:bg-foreground/10 active:cursor-grabbing"
            >
              {label}
            </li>
          ))}
        </ul>

        <h2 className="mt-2 text-sm font-semibold text-foreground/70">仪器</h2>
        <ul className="flex flex-wrap gap-2">
          {apparatus.map((label) => (
            <li
              key={label}
              className="rounded-full border border-foreground/15 px-2.5 py-1 text-xs text-foreground/70"
            >
              {label}
            </li>
          ))}
        </ul>
      </aside>

      {/* 画布主区 */}
      <section className="flex flex-col gap-4">
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          className={`flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed p-6 transition-colors ${
            dragOver ? "border-foreground/50 bg-foreground/5" : "border-foreground/15"
          }`}
        >
          <Beaker result={result} />
          <p className="text-xs text-foreground/50">
            {contents.length === 0
              ? "将试剂拖拽到此处"
              : `容器内：${contents.map((c) => c.name).join("、")}`}
          </p>
        </div>

        {/* 实时读数 */}
        <div className="grid grid-cols-2 gap-3">
          <Reading label="pH" value={readings.ph.toFixed(1)} />
          <Reading label="温度" value={`${readings.temperature} ℃`} />
        </div>

        {/* 现象描述 */}
        {result && (
          <p
            className={`rounded-lg px-4 py-3 text-sm ${
              result.reacted
                ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                : "bg-foreground/5 text-foreground/60"
            }`}
          >
            {result.equation ? `${result.equation}　` : ""}
            {result.description}
          </p>
        )}

        {/* 操作按钮 */}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={mix}
            disabled={contents.length < 2}
            className="rounded-lg bg-foreground px-5 py-2.5 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            混合反应
          </button>
          <button
            type="button"
            onClick={reset}
            className="rounded-lg border border-foreground/20 px-5 py-2.5 text-sm font-medium transition-colors hover:bg-foreground/5"
          >
            清空容器
          </button>
        </div>
      </section>
    </div>
  );
}

// 单个读数卡片
function Reading({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-xl border border-foreground/15 px-4 py-3">
      <span className="text-xs text-foreground/50">{label}</span>
      <span className="text-2xl font-semibold tabular-nums">{value}</span>
    </div>
  );
}
