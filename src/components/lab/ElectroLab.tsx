"use client";

// 电化学实验台通用骨架：电解 / 原电池 / 导电性三种模式共用的布局——
// 左侧仪器栏，右侧居中装置 + 说明 + 现象文字 + 「通电/断开」与「完成实验」按钮。
// 仅负责排版与交互外壳，具体装置（device）与现象（notes）由各模式注入。
import type { ReactNode } from "react";

export function ElectroLab({
  apparatus,
  infoLine,
  device,
  caption,
  notes,
  toggleIdleLabel,
  toggleActiveLabel,
  energized,
  onToggle,
  onComplete,
  completed,
}: {
  apparatus: string[];
  infoLine: ReactNode;
  device: ReactNode;
  caption: string;
  notes?: ReactNode;
  toggleIdleLabel: string;
  toggleActiveLabel: string;
  energized: boolean;
  onToggle: () => void;
  onComplete: () => void;
  completed: boolean;
}) {
  return (
    <div className="grid gap-6 md:grid-cols-[240px_1fr]">
      <aside className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-foreground/70">仪器</h2>
        <ul className="flex flex-wrap gap-2">
          {apparatus.map((label) => (
            <li
              key={label}
              className="rounded-full border border-foreground/15 bg-surface/50 px-2.5 py-1 text-xs text-foreground/70"
            >
              {label}
            </li>
          ))}
        </ul>
        <p className="mt-1 text-xs text-foreground/45">{infoLine}</p>
      </aside>

      <section className="flex flex-col gap-4">
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-foreground/12 bg-gradient-to-b from-surface/30 to-brand-500/[0.04] p-6">
          {device}
          <p className="text-xs text-foreground/50">{caption}</p>
        </div>

        {notes && (
          <div className="flex flex-col gap-1.5 rounded-lg bg-foreground/[0.04] px-4 py-3 text-sm text-foreground/65">
            {notes}
          </div>
        )}

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={onToggle}
            className={`rounded-xl px-5 py-2.5 text-sm font-medium text-white shadow-soft transition-all active:scale-[0.98] ${
              energized
                ? "bg-gradient-to-r from-rose-500 to-rose-600"
                : "bg-gradient-to-r from-brand-500 to-brand-600 hover:shadow-glow"
            }`}
          >
            {energized ? toggleActiveLabel : toggleIdleLabel}
          </button>
          <button
            type="button"
            onClick={onComplete}
            disabled={completed || !energized}
            className="rounded-xl border border-emerald-500/40 px-5 py-2.5 text-sm font-medium text-emerald-700 transition-colors hover:bg-emerald-500/10 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 dark:text-emerald-300"
          >
            {completed ? "实验已完成" : "完成实验"}
          </button>
        </div>
      </section>
    </div>
  );
}
