import Link from "next/link";
import { notFound } from "next/navigation";
import { getExperimentBySlug } from "@/server/experiments/service";
import { LabWorkbench } from "@/components/lab/LabWorkbench";
import { LessonPlayer } from "@/components/lab/lesson/LessonPlayer";
import { TutorChat } from "@/components/ai/TutorChat";

// 实验工作台页：加载实验配置（试剂/仪器），挂载交互画布 LabCanvas。
export default async function ExperimentLabPage({
  params,
}: {
  params: { slug: string };
}) {
  const experiment = await getExperimentBySlug(params.slug);
  if (!experiment) notFound();

  return (
    <main id="main" className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-10 animate-fade-up">
      <Link
        href={`/experiments/${experiment.slug}`}
        className="text-sm text-foreground/60 transition-colors hover:text-brand-600 dark:hover:text-brand-300"
      >
        ← 返回实验详情
      </Link>

      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight">
          {experiment.title} <span className="text-foreground/40">·</span>{" "}
          <span className="bg-gradient-to-r from-brand-500 to-brand-700 bg-clip-text text-transparent">
            实验台
          </span>
        </h1>
        <p className="text-sm text-foreground/60">
          点击或拖拽试剂入杯、「混合反应」观察现象；也可点右侧「实验讲解」自动分步演示。
        </p>
      </header>

      {/* 左：实验画布；右：AI 导师对话侧边栏 */}
      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="rounded-2xl border border-foreground/10 bg-surface/60 p-5 shadow-soft backdrop-blur">
          <LabWorkbench
            experimentId={experiment.id}
            slug={experiment.slug}
            reagents={experiment.reagents}
            apparatus={experiment.apparatus}
          />
        </div>
        <div className="flex flex-col gap-6">
          <LessonPlayer experimentSlug={experiment.slug} />
          <div className="h-[460px]">
            <TutorChat experimentSlug={experiment.slug} />
          </div>
        </div>
      </div>
    </main>
  );
}
