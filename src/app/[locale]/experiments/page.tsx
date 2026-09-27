"use client";

import { useEffect, useState } from "react";
import type { ExperimentDTO } from "@/types/experiment";
import ExperimentCard from "@/components/experiment/ExperimentCard";
import { useLocale, useTranslations } from "next-intl";
import FilterBar, {
  type ExperimentFilters,
} from "@/components/experiment/FilterBar";

const EMPTY_FILTERS: ExperimentFilters = {
  category: "",
  difficulty: "",
  q: "",
};

// 实验列表页：筛选器 + 卡片网格，按筛选条件调用 /api/experiments
export default function ExperimentsPage() {
  const t = useTranslations("catalog");
  const locale = useLocale();
  const [filters, setFilters] = useState<ExperimentFilters>(EMPTY_FILTERS);
  const [experiments, setExperiments] = useState<ExperimentDTO[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const params = new URLSearchParams();
    if (filters.category) params.set("category", filters.category);
    if (filters.difficulty) params.set("difficulty", filters.difficulty);
    if (filters.q.trim()) params.set("q", filters.q.trim());
    // 带上语言：API 据此返回译文，并让关键词能匹配到译文标题
    params.set("locale", locale);

    const controller = new AbortController();
    setLoading(true);
    // 搜索框每敲一个字都会重跑本 effect，直接发请求等于一个字一次全量查询。
    // 延迟 250ms 再发，期间继续输入就把上一次取消掉。
    const timer = window.setTimeout(() => {
      fetch(`/api/experiments?${params.toString()}`, {
        signal: controller.signal,
      })
        .then((res) => (res.ok ? res.json() : []))
        .then((data: ExperimentDTO[]) => setExperiments(data))
        .catch(() => {
          /* 请求被中止或失败时忽略 */
        })
        .finally(() => {
          // 被 abort 的旧请求也会走到这里，且时序上晚于新 effect 的 setLoading(true)，
          // 若无条件置 false，骨架屏会提前消失、瞬间闪出"没有符合条件的实验"。
          if (!controller.signal.aborted) setLoading(false);
        });
    }, 250);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [filters, locale]);

  return (
    <main id="main" className="mx-auto flex max-w-5xl flex-col gap-6 px-6 py-10 sm:py-12">
      <header className="flex flex-col gap-1.5 animate-fade-up">
        <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>
        <p className="text-sm text-foreground/60">
          {t("subtitle")}
        </p>
      </header>

      <FilterBar filters={filters} onChange={setFilters} />

      {loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-40 animate-pulse rounded-2xl border border-foreground/10 bg-foreground/[0.04]"
            />
          ))}
        </div>
      ) : experiments.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-foreground/15 py-16 text-center">
          <span className="text-3xl">🔍</span>
          <p className="text-sm text-foreground/65">{t("empty")}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {experiments.map((exp) => (
            <ExperimentCard key={exp.id} experiment={exp} />
          ))}
        </div>
      )}
    </main>
  );
}
