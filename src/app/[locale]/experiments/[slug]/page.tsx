import Link from "next/link";
import { notFound } from "next/navigation";
import { getExperimentBySlug } from "@/server/experiments/service";
import {
  CATEGORY_LABELS,
  DIFFICULTY_LABELS,
} from "@/components/experiment/labels";
import { allExperiments } from "@/data/experiments";
import { buildLesson } from "@/components/lab/lesson/buildLesson";
import { LessonOutline } from "@/components/lab/lesson/LessonOutline";

// 实验详情页：服务端直接查询，展示目标/试剂/仪器/时长
export default async function ExperimentDetailPage({
  params,
}: {
  params: { slug: string };
}) {
  const experiment = await getExperimentBySlug(params.slug);
  if (!experiment) notFound();

  // 由实验数据自动派生讲解大纲（与实验台讲解播放器同源）
  const seed = allExperiments.find((e) => e.slug === params.slug);
  const lesson = seed ? buildLesson(seed) : [];

  return (
    <main id="main" className="mx-auto flex max-w-3xl flex-col gap-6 px-6 py-10 animate-fade-up">
      <Link
        href="/experiments"
        className="text-sm text-foreground/60 transition-colors hover:text-brand-600 dark:hover:text-brand-300"
      >
        ← 返回实验库
      </Link>

      <header className="flex flex-col gap-3 rounded-2xl border border-foreground/10 bg-surface/70 p-6 shadow-soft backdrop-blur">
        <div className="flex items-center gap-2 text-xs">
          <span className="rounded-full bg-brand-500/12 px-2.5 py-0.5 font-medium text-brand-700 dark:text-brand-300">
            {CATEGORY_LABELS[experiment.category]}
          </span>
          <span className="rounded-full bg-foreground/8 px-2.5 py-0.5 font-medium text-foreground/65">
            {DIFFICULTY_LABELS[experiment.difficulty]}
          </span>
          <span className="flex items-center gap-1 text-foreground/50">
            <span aria-hidden>⏱</span> 预计 {experiment.estimatedMinutes} 分钟
          </span>
        </div>
        <h1 className="text-3xl font-bold tracking-tight">
          {experiment.title}
        </h1>
        <p className="text-foreground/70">{experiment.description}</p>
      </header>

      <Section title="实验目标" items={experiment.objectives} ordered />
      <LessonOutline steps={lesson} />
      <Section title="所需试剂" items={experiment.reagents} />
      <Section title="所需仪器" items={experiment.apparatus} />

      <Link
        href={`/experiments/${experiment.slug}/lab`}
        className="self-start rounded-full bg-gradient-to-r from-brand-500 to-brand-600 px-6 py-3 text-sm font-medium text-white shadow-glow transition-all hover:scale-[1.02]"
      >
        开始实验 →
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
    <section className="flex flex-col gap-2 rounded-2xl border border-foreground/10 bg-surface/50 p-5 backdrop-blur">
      <h2 className="flex items-center gap-2 text-lg font-semibold">
        <span className="h-4 w-1 rounded-full bg-gradient-to-b from-brand-400 to-brand-600" />
        {title}
      </h2>
      <ListTag
        className={`flex flex-col gap-1 pl-5 text-sm text-foreground/80 ${
          ordered ? "list-decimal" : "list-disc"
        } marker:text-brand-500`}
      >
        {items.map((item, i) => (
          <li key={i}>{item}</li>
        ))}
      </ListTag>
    </section>
  );
}
