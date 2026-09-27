"use client";

// 数据记录表：把「读数」操作沉淀成一张可算平均值与相对偏差的表。
//
// 为什么单独做一张表而不是让学生看曲线：定量实验的规范是重复测量取平均，
// 并用相对偏差判断数据是否可信（中学要求平行测定至少两次，偏差大要重做）。
// 曲线看趋势，表格算结论 —— 报告里那句"平均值 X，相对偏差 Y%"只能从表里来。
import {
  extractRows,
  latestGroup,
  relativeDeviation,
  worstDeviation,
  type Row,
} from "./dataStats";
import { useTranslations } from "next-intl";
import type { TracePoint } from "./labStore";

// label 存词条 key 而不是中文：表头要随界面语言变，写死中文就锁死了
const COLS: { key: keyof Row; label: string; digits: number }[] = [
  { key: "t", label: "colTime", digits: 1 },
  { key: "temperature", label: "colTemperature", digits: 1 },
  { key: "ph", label: "colPh", digits: 2 },
  { key: "volume", label: "colVolume", digits: 2 },
];

export function DataTable({ trace }: { trace: TracePoint[] }) {
  const t = useTranslations("dataTable");
  const rows = extractRows(trace);
  // 统计只用最近一组：体系改动过的读数彼此不可比（详见 dataStats 的 group）
  const current = latestGroup(rows);

  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-foreground/10 bg-surface/60 p-4 shadow-soft">
      <div className="flex items-baseline justify-between">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground/75">
          <span className="h-4 w-1 rounded-full bg-gradient-to-b from-brand-400 to-brand-600" />
          {t("title")}
        </h3>
        <span className="text-[11px] text-foreground/65">
          {rows.length === 0
            ? t("emptyHint")
            : current.length < 2
              ? t("recordedNeedMore", { count: current.length })
              : t("recorded", { count: current.length })}
        </span>
      </div>

      {rows.length === 0 ? (
        <p className="py-6 text-center text-xs text-foreground/65">
          {t("emptyBody")}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs tabular-nums">
            <thead>
              <tr className="text-start text-foreground/65">
                <th className="py-1 pe-2 font-medium">{t("colIndex")}</th>
                {COLS.map((c) => (
                  <th key={c.key} className="py-1 pe-2 font-medium">
                    {t(c.label)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                // 往组（体系改动之前的读数）淡显：它们仍是实验过程的一部分，
                // 但不参与本组统计，视觉上要能一眼分开
                const past = r.group !== current[0]?.group;
                return (
                  <tr
                    key={r.index}
                    className={`border-t border-foreground/8 ${past ? "opacity-40" : ""}`}
                  >
                    <td className="py-1 pe-2 text-foreground/65">{r.index}</td>
                    {COLS.map((c) => (
                      <td key={c.key} className="py-1 pe-2 text-foreground/80">
                        {r[c.key].toFixed(c.digits)}
                      </td>
                    ))}
                  </tr>
                );
              })}
              {/* 平均值与相对偏差：定量实验的结论行，只统计最近一组 */}
              <tr className="border-t-2 border-foreground/15 font-semibold">
                <td className="py-1 pe-2 text-foreground/65">{t("rowMean")}</td>
                {COLS.map((c) => {
                  const vals = current.map((r) => r[c.key]);
                  const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
                  return (
                    <td key={c.key} className="py-1 pe-2 text-brand-600 dark:text-brand-300">
                      {c.key === "t" ? "—" : mean.toFixed(c.digits)}
                    </td>
                  );
                })}
              </tr>
              <tr className="text-foreground/65">
                <td className="py-1 pe-2">{t("rowDeviation")}</td>
                {COLS.map((c) => {
                  const d =
                    c.key === "t"
                      ? null
                      : relativeDeviation(current.map((r) => r[c.key]));
                  return (
                    <td key={c.key} className="py-1 pe-2">
                      {d === null ? "—" : `${d.toFixed(2)}%`}
                    </td>
                  );
                })}
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {/* 偏差评语：把数字翻译成"这组数据能不能用" */}
      {current.length >= 2 ? <Verdict rows={current} /> : null}
    </div>
  );
}

function Verdict({ rows }: { rows: Row[] }) {
  const t = useTranslations("dataTable");
  const worst = worstDeviation(rows);
  const good = worst <= 1;
  const ok = worst <= 5;
  return (
    <p
      className={`rounded-lg px-3 py-2 text-xs ${
        good
          ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
          : ok
            ? "bg-amber-500/10 text-amber-700 dark:text-amber-300"
            : "bg-rose-500/10 text-rose-700 dark:text-rose-300"
      }`}
    >
      {t("worstDeviation", { value: worst.toFixed(2) })}
      {good ? t("verdictGood") : ok ? t("verdictFair") : t("verdictPoor")}
    </p>
  );
}
