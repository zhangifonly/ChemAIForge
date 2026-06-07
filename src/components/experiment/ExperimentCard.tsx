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
      className="flex flex-col gap-3 rounded-xl border border-foreground/10 p-5 transition-colors hover:border-foreground/30"
    >
      <div className="flex items-center gap-2 text-xs">
        <span className="rounded-full bg-foreground/10 px-2 py-0.5">
          {CATEGORY_LABELS[experiment.category]}
        </span>
        <span className="rounded-full bg-foreground/10 px-2 py-0.5">
          {DIFFICULTY_LABELS[experiment.difficulty]}
        </span>
      </div>
      <h3 className="text-lg font-semibold">{experiment.title}</h3>
      <p className="line-clamp-3 text-sm text-foreground/70">
        {experiment.description}
      </p>
      <span className="mt-auto text-xs text-foreground/50">
        预计 {experiment.estimatedMinutes} 分钟
      </span>
    </Link>
  );
}
