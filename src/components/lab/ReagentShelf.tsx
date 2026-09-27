"use client";

// 试剂架：每瓶试剂带瓶签规格（浓度/密度/形态）、可设取用量、显示已取总量。
//
// 替代原先"名字 + 小瓶图标，点一下整瓶倒进去"的做法。专业虚拟实验里试剂瓶是
// 定量入口：瓶签写着 1.00 mol/L，取用时要报出取了多少 mL、合多少 mol。
// 没有这一层，上面的仪表台与误差分析全都无从计算。
import { useState } from "react";
import { useTranslations } from "next-intl";
import { amountOf, localizedSpecLabel, type ReagentSpec } from "@/lib/chem/reagentSpec";
import type { ContainerItem } from "./labStore";

export interface ShelfEntry {
  /** 实验配置里的中文试剂名：引擎匹配键，也是取用时的标识，不可翻译 */
  label: string;
  /** 瓶签上显示的名字（当前语言的术语译名，缺译时同 label） */
  displayName: string;
  /** 解析出的化学式，用于配色与匹配容器内条目 */
  formula: string;
  /** 取用规格 */
  spec: ReagentSpec;
  /** 瓶身特征色（沿用 CATEGORY_COLOR，保证 2D/3D 同源） */
  color: string;
}

/** 用量档位：常规实验用量的几个常用值，避免每次都拖滑块 */
function dosePresets(spec: ReagentSpec): number[] {
  if (spec.unit === "g") return [0.5, 1, 2, 5];
  // 溶液/液体：2 mL（几滴~1 mL 量级由滴管操作承担）、5、10、25
  return [2, 5, 10, 25];
}

export function ReagentShelf({
  entries,
  contents,
  onTake,
}: {
  entries: ShelfEntry[];
  contents: ContainerItem[];
  onTake: (entry: ShelfEntry, dose: number) => void;
}) {
  const t = useTranslations("shelf");
  // 每瓶各自记住上次选的用量：一个实验里常要反复取同一种试剂的同一个量
  const [doses, setDoses] = useState<Record<string, number>>({});

  return (
    <div className="flex flex-col gap-2">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground/75">
        <span className="h-4 w-1 rounded-full bg-gradient-to-b from-brand-400 to-brand-600" />
        {t("title")}
      </h2>
      {/* 手机上横向滑动：竖排时 3 瓶试剂就占掉 700px，台面被推到首屏之外，
          学生打开实验台只看到一列卡片。横排后整架只占一行，台面紧跟其后。
          不把试剂架挪到台面下方：那样它会落在操作栏、曲线、数据表之后，
          取一次试剂要滚到页底、再滚回来看烧杯 */}
      <ul className="-mx-1 flex snap-x snap-mandatory gap-2 overflow-x-auto px-1 pb-1 lg:mx-0 lg:snap-none lg:flex-col lg:overflow-visible lg:px-0 lg:pb-0">
        {entries.map((e) => {
          const taken = contents.find((c) => c.formula === e.formula);
          const dose = doses[e.label] ?? e.spec.defaultDose;
          const mol = amountOf(e.spec, dose);
          return (
            <li
              key={e.label}
              className="w-[15rem] shrink-0 snap-start rounded-xl border border-foreground/10 bg-surface/60 p-2.5 lg:w-auto lg:shrink"
            >
              {/* 瓶身 + 瓶签 */}
              <div className="flex items-center gap-2">
                <span
                  aria-hidden
                  className="h-7 w-5 shrink-0 rounded-b-md rounded-t-sm border border-foreground/20"
                  style={{ background: e.color }}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground/85">
                    {e.displayName}
                  </p>
                  <p className="text-[11px] tabular-nums text-foreground/65">
                    {localizedSpecLabel(e.spec, t)}
                  </p>
                </div>
                {taken ? (
                  <span className="shrink-0 rounded-md bg-brand-500/10 px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-brand-600 dark:text-brand-300">
                    {t("taken", { dose: taken.dose, unit: e.spec.unit })}
                  </span>
                ) : null}
              </div>

              {/* 用量档位 + 取用 */}
              {e.spec.phase === "indicator" || e.spec.phase === "bulk" ? (
                <button
                  type="button"
                  onClick={() => onTake(e, e.spec.defaultDose)}
                  className="mt-2 w-full rounded-lg border border-brand-500/30 bg-brand-500/10 py-2 text-xs font-medium lg:py-1 text-brand-700 transition hover:bg-brand-500/20 dark:text-brand-300"
                >
                  {t("takeSome")}
                </button>
              ) : (
                <div className="mt-2 flex items-center gap-1">
                  <div className="flex flex-1 overflow-hidden rounded-lg border border-foreground/15">
                    {dosePresets(e.spec).map((d) => (
                      <button
                        key={d}
                        type="button"
                        aria-pressed={dose === d}
                        onClick={() => setDoses((p) => ({ ...p, [e.label]: d }))}
                        className={`flex-1 py-2 text-xs tabular-nums transition lg:py-1 lg:text-[11px] ${
                          dose === d
                            ? "bg-brand-500 font-semibold text-white"
                            : "bg-surface/40 text-foreground/65 hover:bg-foreground/5"
                        }`}
                      >
                        {d}
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => onTake(e, dose)}
                    // 用量与换算同时给出：这一行就是"定量"与"点一下加进去"的分界
                    title={
                      mol === null
                        ? undefined
                        : `${dose} ${e.spec.unit} → ${mol.toFixed(4)} mol`
                    }
                    className="shrink-0 rounded-lg bg-brand-500 px-3 py-2 text-xs font-semibold text-white transition hover:bg-brand-600 lg:px-2 lg:py-1 lg:text-[11px]"
                  >
                    {t("take", { unit: e.spec.unit })}
                  </button>
                </div>
              )}
              {mol !== null ? (
                <p className="mt-1 text-[11px] tabular-nums text-foreground/65">
                  n = {mol.toFixed(4)} mol
                </p>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
