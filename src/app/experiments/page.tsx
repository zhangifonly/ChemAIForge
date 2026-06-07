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
    <main className="mx-auto flex max-w-5xl flex-col gap-6 p-8">
      <header className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold tracking-tight">实验库</h1>
        <p className="text-sm text-foreground/60">
          选择一个实验，进入虚拟实验室开始操作。
        </p>
      </header>

      <FilterBar filters={filters} onChange={setFilters} />

      {loading ? (
        <p className="text-sm text-foreground/50">加载中…</p>
      ) : experiments.length === 0 ? (
        <p className="text-sm text-foreground/50">没有符合条件的实验。</p>
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
