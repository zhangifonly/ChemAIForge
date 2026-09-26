import { Link } from "@/lib/i18n/navigation";
import { notFound } from "next/navigation";
import { getExperimentBySlug } from "@/server/experiments/service";
import { LabWorkbench } from "@/components/lab/LabWorkbench";
import { LessonPlayer } from "@/components/lab/lesson/LessonPlayer";
import { TutorChat } from "@/components/ai/TutorChat";
import { getTranslations } from "next-intl/server";
import { localizeExperiment } from "@/lib/i18n/content";
import { PhenomenaProvider } from "@/lib/i18n/PhenomenaProvider";
import { loadPhrases } from "@/lib/i18n/phenomena";
import { lessonContent } from "@/lib/i18n/lessonContent";

// 实验工作台页：加载实验配置（试剂/仪器），挂载交互画布 LabCanvas。
export default async function ExperimentLabPage({
  params,
}: {
  params: { slug: string; locale: string };
}) {
  const t = await getTranslations("lab");
  const experiment = await getExperimentBySlug(params.slug);
  if (!experiment) notFound();
  // 套上该语言的标题/描述/目标；试剂与仪器保持原文（它们是引擎匹配键）
  const exp = await localizeExperiment(experiment, params.locale);
  // 现象译文表随页面一起送到客户端：实验台里的现象文字要同步换语言
  const phrases = await loadPhrases(params.locale);
  // 讲解口播里的描述、目标与试剂名也要用译文（词条覆盖不到这几处数据字段）
  const lessonI18n = await lessonContent(params.slug, params.locale);

  return (
    <main id="main" className="mx-auto flex max-w-[1600px] flex-col gap-6 px-4 py-8 animate-fade-up sm:px-6">
      <Link
        href={`/experiments/${experiment.slug}`}
        className="text-sm text-foreground/60 transition-colors hover:text-brand-600 dark:hover:text-brand-300"
      >
        {t("backToDetail")}
      </Link>

      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight">
          {exp.title} <span className="text-foreground/65">·</span>{" "}
          <span className="bg-gradient-to-r from-brand-500 to-brand-700 bg-clip-text text-transparent">
            {t("labSuffix")}
          </span>
        </h1>
        <p className="text-sm text-foreground/60">
          {t("labHint")}
        </p>
      </header>

      {/* 左：实验台；右：讲解与 AI 导师。
          原先页面限宽 6xl、侧栏从 lg 起就占 360px，实验台再内分试剂栏后，
          器皿区只剩约 390px —— 主角被挤成了缩略图。现在页面放宽到 1600px，
          侧栏到 xl 才并排，更窄的屏幕上沉到实验台下方，把宽度让给实验台。 */}
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 rounded-2xl border border-foreground/10 bg-surface/60 p-4 shadow-soft backdrop-blur sm:p-5">
          <PhenomenaProvider phrases={phrases} terms={lessonI18n.terms ?? null}>
            <LabWorkbench
            experimentId={experiment.id}
            slug={experiment.slug}
            reagents={experiment.reagents}
            apparatus={experiment.apparatus}
            />
          </PhenomenaProvider>
        </div>
        <div className="flex flex-col gap-6 xl:sticky xl:top-6 xl:self-start">
          <LessonPlayer experimentSlug={experiment.slug} content={lessonI18n} />
          <div className="h-[460px]">
            <TutorChat experimentSlug={experiment.slug} />
          </div>
        </div>
      </div>
    </main>
  );
}
