import Link from "next/link";
import type { ExperimentDTO } from "@/types/experiment";
import { CATEGORY_LABELS, DIFFICULTY_LABELS } from "./labels";

// 实验列表中的单张卡片，点击进入详情页
export default function ExperimentCard({
  experiment,
}: {
  experiment: ExperimentDTO;
}) {
  return (
    <Link
      href={`/experiments/${experiment.slug}`}
      className="group flex flex-col gap-3 rounded-2xl border border-foreground/10 bg-surface/70 p-5 shadow-soft backdrop-blur transition-all hover:-translate-y-1 hover:border-brand-400/40 hover:shadow-glow"
    >
      <div className="flex items-center gap-2 text-xs">
        <span className="rounded-full bg-brand-500/12 px-2.5 py-0.5 font-medium text-brand-700 dark:text-brand-300">
          {CATEGORY_LABELS[experiment.category]}
        </span>
        <span className="rounded-full bg-foreground/8 px-2.5 py-0.5 font-medium text-foreground/65">
          {DIFFICULTY_LABELS[experiment.difficulty]}
        </span>
      </div>
      <h3 className="text-lg font-semibold transition-colors group-hover:text-brand-600 dark:group-hover:text-brand-300">
        {experiment.title}
      </h3>
      <p className="line-clamp-3 text-sm text-foreground/65">
        {experiment.description}
      </p>
      <span className="mt-auto flex items-center gap-1 text-xs text-foreground/50">
        <span aria-hidden>⏱</span> 预计 {experiment.estimatedMinutes} 分钟
      </span>
    </Link>
  );
}
