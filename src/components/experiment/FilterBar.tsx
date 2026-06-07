"use client";

import type {
  ExperimentCategory,
  ExperimentDifficulty,
} from "@/server/experiment/types";
import {
  CATEGORY_LABELS,
  CATEGORY_OPTIONS,
  DIFFICULTY_LABELS,
  DIFFICULTY_OPTIONS,
} from "./labels";

// 列表页筛选状态：分类、难度、关键词搜索
export interface ExperimentFilters {
  category: ExperimentCategory | "";
  difficulty: ExperimentDifficulty | "";
  q: string;
}

// 筛选栏：搜索框 + 分类/难度下拉，受控组件由父级管理状态
export default function FilterBar({
  filters,
  onChange,
}: {
  filters: ExperimentFilters;
  onChange: (next: ExperimentFilters) => void;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <input
        type="search"
        value={filters.q}
        onChange={(e) => onChange({ ...filters, q: e.target.value })}
        placeholder="搜索实验名称…"
        aria-label="搜索实验"
        className="flex-1 rounded-lg border border-foreground/15 bg-transparent px-3 py-2 text-sm outline-none focus:border-foreground/40"
      />
      <select
        value={filters.category}
        onChange={(e) =>
          onChange({
            ...filters,
            category: e.target.value as ExperimentCategory | "",
          })
        }
        aria-label="按分类筛选"
        className="rounded-lg border border-foreground/15 bg-transparent px-3 py-2 text-sm outline-none focus:border-foreground/40"
      >
        <option value="">全部分类</option>
        {CATEGORY_OPTIONS.map((c) => (
          <option key={c} value={c}>
            {CATEGORY_LABELS[c]}
          </option>
        ))}
      </select>
      <select
        value={filters.difficulty}
        onChange={(e) =>
          onChange({
            ...filters,
            difficulty: e.target.value as ExperimentDifficulty | "",
          })
        }
        aria-label="按难度筛选"
        className="rounded-lg border border-foreground/15 bg-transparent px-3 py-2 text-sm outline-none focus:border-foreground/40"
      >
        <option value="">全部难度</option>
        {DIFFICULTY_OPTIONS.map((d) => (
          <option key={d} value={d}>
            {DIFFICULTY_LABELS[d]}
          </option>
        ))}
      </select>
    </div>
  );
}
