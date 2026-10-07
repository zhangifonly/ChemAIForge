"use client";

// 三个精品实验台（钠与水、焰色反应、碘钟）共用的面板零件：分段按钮、读数行、完成实验。
// 样式与电解台面板一致，保证同一站点里各实验台观感统一。
import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/lib/i18n/navigation";
import { useLabStore } from "../../labStore";

export function Card({ title, children, dark }: { title: string; children: ReactNode; dark?: boolean }) {
  return (
    <section
      className={`flex flex-col gap-2.5 rounded-2xl border p-4 ${
        dark ? "border-foreground/10 bg-slate-900/90 text-slate-100" : "border-foreground/10 bg-surface/60"
      }`}
    >
      <h3 className={`text-sm font-semibold ${dark ? "text-xs tracking-wider text-slate-400" : "text-foreground/80"}`}>
        {title}
      </h3>
      {children}
    </section>
  );
}

export function Seg<T extends string | number>({
  options,
  value,
  onChange,
  label,
  disabled,
}: {
  options: readonly T[];
  value: T;
  onChange: (v: T) => void;
  label: (v: T) => ReactNode;
  disabled?: boolean;
}) {
  return (
    <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
      {options.map((o) => (
        <button
          key={String(o)}
          type="button"
          aria-pressed={value === o}
          disabled={disabled}
          onClick={() => onChange(o)}
          className={`rounded-lg border px-1.5 py-2 text-xs font-medium transition disabled:opacity-40 ${
            value === o
              ? "border-brand-500 bg-brand-500 text-white"
              : "border-foreground/15 text-foreground/75 hover:border-brand-400/50"
          }`}
        >
          {label(o)}
        </button>
      ))}
    </div>
  );
}

export function Row({ label, value, accent }: { label: ReactNode; value: ReactNode; accent?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-2 text-xs">
      <span className="text-slate-400">{label}</span>
      <span className={`font-mono tabular-nums ${accent ? "text-base font-semibold text-emerald-300" : "text-slate-100"}`}>
        {value}
      </span>
    </div>
  );
}

/** 完成实验 + 查看报告；ready 为 false 时完成按钮禁用（还没做出可报告的数据） */
export function CompleteBlock({ ready }: { ready: boolean }) {
  const t = useTranslations("electrolysisLab");
  const complete = useLabStore((s) => s.complete);
  const completed = useLabStore((s) => s.completed);
  const sessionId = useLabStore((s) => s.sessionId);
  return (
    <>
      <button
        type="button"
        onClick={complete}
        disabled={completed || !ready}
        className="rounded-xl border border-emerald-500/40 px-3 py-2.5 text-sm text-emerald-700 transition disabled:opacity-40 dark:text-emerald-300"
      >
        {t("complete")}
      </button>
      {completed && sessionId ? (
        <Link
          href={`/sessions/${sessionId}/report`}
          className="rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 px-3 py-2.5 text-center text-sm font-medium text-white"
        >
          {t("viewReport")}
        </Link>
      ) : null}
    </>
  );
}

export function primaryBtn(extra = "") {
  return `rounded-xl bg-gradient-to-r from-brand-500 to-brand-600 px-3 py-2.5 text-sm font-medium text-white shadow-soft transition disabled:opacity-40 ${extra}`;
}

export const ghostBtn = "rounded-xl border border-foreground/20 px-3 py-2 text-sm transition disabled:opacity-40";
