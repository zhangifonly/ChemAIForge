"use client";

import { useEffect, useState } from "react";
import type { ExperimentDTO } from "@/types/experiment";
import ExperimentCard from "@/components/experiment/ExperimentCard";
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
  const [filters, setFilters] = useState<ExperimentFilters>(EMPTY_FILTERS);
  const [experiments, setExperiments] = useState<ExperimentDTO[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const params = new URLSearchParams();
    if (filters.category) params.set("category", filters.category);
    if (filters.difficulty) params.set("difficulty", filters.difficulty);
    if (filters.q.trim()) params.set("q", filters.q.trim());

    const controller = new AbortController();
    setLoading(true);
    fetch(`/api/experiments?${params.toString()}`, {
      signal: controller.signal,
    })
      .then((res) => (res.ok ? res.json() : []))
      .then((data: ExperimentDTO[]) => setExperiments(data))
      .catch(() => {
        /* 请求被中止或失败时忽略 */
      })
      .finally(() => setLoading(false));

    return () => controller.abort();
  }, [filters]);

  return (
    <main id="main" className="mx-auto flex max-w-5xl flex-col gap-6 px-6 py-10 sm:py-12">
      <header className="flex flex-col gap-1.5 animate-fade-up">
        <h1 className="text-3xl font-bold tracking-tight">实验库</h1>
        <p className="text-sm text-foreground/60">
          选择一个实验，进入虚拟实验室开始操作。
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
          <p className="text-sm text-foreground/50">没有符合条件的实验。</p>
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
