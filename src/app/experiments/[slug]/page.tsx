import Link from "next/link";
import { notFound } from "next/navigation";
import { getExperimentBySlug } from "@/server/experiments/service";
import {
  CATEGORY_LABELS,
  DIFFICULTY_LABELS,
} from "@/components/experiment/labels";

// 实验详情页：服务端直接查询，展示目标/试剂/仪器/时长
export default async function ExperimentDetailPage({
  params,
}: {
  params: { slug: string };
}) {
  const experiment = await getExperimentBySlug(params.slug);
  if (!experiment) notFound();

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 p-8">
      <Link
        href="/experiments"
        className="text-sm text-foreground/60 hover:text-foreground"
      >
        ← 返回实验库
      </Link>

      <header className="flex flex-col gap-2">
        <div className="flex items-center gap-2 text-xs">
          <span className="rounded-full bg-foreground/10 px-2 py-0.5">
            {CATEGORY_LABELS[experiment.category]}
          </span>
          <span className="rounded-full bg-foreground/10 px-2 py-0.5">
            {DIFFICULTY_LABELS[experiment.difficulty]}
          </span>
          <span className="text-foreground/50">
            预计 {experiment.estimatedMinutes} 分钟
          </span>
        </div>
        <h1 className="text-3xl font-bold tracking-tight">
          {experiment.title}
        </h1>
        <p className="text-foreground/70">{experiment.description}</p>
      </header>

      <Section title="实验目标" items={experiment.objectives} ordered />
      <Section title="所需试剂" items={experiment.reagents} />
      <Section title="所需仪器" items={experiment.apparatus} />

      <Link
        href={`/experiments/${experiment.slug}/lab`}
        className="self-start rounded-lg bg-foreground px-5 py-2.5 text-sm font-medium text-background transition-opacity hover:opacity-90"
      >
        开始实验
      </Link>
    </main>
  );
}

// 列表区块：有序展示目标，无序展示试剂/仪器
function Section({
  title,
  items,
  ordered = false,
}: {
  title: string;
  items: string[];
  ordered?: boolean;
}) {
  const ListTag = ordered ? "ol" : "ul";
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-lg font-semibold">{title}</h2>
      <ListTag
        className={`flex flex-col gap-1 pl-5 text-sm text-foreground/80 ${
          ordered ? "list-decimal" : "list-disc"
        }`}
      >
        {items.map((item, i) => (
          <li key={i}>{item}</li>
        ))}
      </ListTag>
    </section>
  );
}
