import Link from "next/link";
import { notFound } from "next/navigation";
import { getExperimentBySlug } from "@/server/experiments/service";
import { LabCanvas } from "@/components/lab/LabCanvas";

// 实验工作台页：加载实验配置（试剂/仪器），挂载交互画布 LabCanvas。
export default async function ExperimentLabPage({
  params,
}: {
  params: { slug: string };
}) {
  const experiment = await getExperimentBySlug(params.slug);
  if (!experiment) notFound();

  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-6 p-8">
      <Link
        href={`/experiments/${experiment.slug}`}
        className="text-sm text-foreground/60 hover:text-foreground"
      >
        ← 返回实验详情
      </Link>

      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight">
          {experiment.title} · 实验台
        </h1>
        <p className="text-sm text-foreground/60">
          拖拽试剂到烧杯，点击「混合反应」观察现象与读数变化。
        </p>
      </header>

      <LabCanvas
        reagents={experiment.reagents}
        apparatus={experiment.apparatus}
      />
    </main>
  );
}
