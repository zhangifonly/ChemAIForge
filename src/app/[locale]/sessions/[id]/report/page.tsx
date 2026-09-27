import { Link } from "@/lib/i18n/navigation";
import { notFound } from "next/navigation";
import { getSession, hasActivity } from "@/server/session";
import { getExperimentById } from "@/server/experiments/service";
import { MeasurementChart } from "@/components/session/measurement-chart";
import { QuantSummary } from "@/components/session/QuantSummary";
import { GenerateReportButton } from "@/components/session/generate-report-button";
import { getTranslations } from "next-intl/server";

// 实验报告页：服务端查询会话，展示 AI 结构化报告（结论/误差/改进/掌握评估）
// 与 measurements 折线图。未生成报告时引导用户先行生成。
export default async function SessionReportPage({
  params,
}: {
  params: { id: string; locale: string };
}) {
  const t = await getTranslations("report");
  const tLab = await getTranslations("lab");
  const session = await getSession(params.id);
  if (!session) notFound();

  const experiment = await getExperimentById(session.experimentId);
  const report = session.report;

  return (
    <main id="main" className="mx-auto flex max-w-3xl flex-col gap-6 px-6 py-10 animate-fade-up">
      <Link
        href="/experiments"
        className="text-sm text-foreground/60 transition-colors hover:text-brand-600 dark:hover:text-brand-300"
      >
        {tLab("backToCatalog")}
      </Link>

      <header className="flex flex-col gap-1.5 rounded-2xl border border-foreground/10 bg-surface/70 p-6 shadow-soft backdrop-blur">
        <h1 className="text-3xl font-bold tracking-tight">
          <span className="bg-gradient-to-r from-brand-500 to-brand-700 bg-clip-text text-transparent">
            实验报告
          </span>
        </h1>
        {experiment ? (
          <p className="text-foreground/70">{experiment.title}</p>
        ) : null}
        {report ? (
          <p className="text-xs text-foreground/65">
            {t("generatedAt", { time: new Date(report.generatedAt).toLocaleString(params.locale) })}
          </p>
        ) : null}
      </header>

      <section className="flex flex-col gap-2 rounded-2xl border border-foreground/10 bg-surface/50 p-5 backdrop-blur">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <span className="h-4 w-1 rounded-full bg-gradient-to-b from-brand-400 to-brand-600" />
          {t("measurements")}
        </h2>
        <MeasurementChart measurements={session.measurements} />
      </section>

      {/* 曲线之后紧跟结论表：折线看趋势，这里给出要写进报告的那几个数字 */}
      <section className="flex flex-col gap-3 rounded-2xl border border-foreground/10 bg-surface/50 p-5 backdrop-blur">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <span className="h-4 w-1 rounded-full bg-gradient-to-b from-brand-400 to-brand-600" />
          {t("quantData")}
        </h2>
        <QuantSummary measurements={session.measurements} />
      </section>

      {report ? (
        <>
          <TextSection title={t("conclusion")} body={report.conclusion} />
          <TextSection title={t("errorAnalysis")} body={report.errorAnalysis} />
          <section className="flex flex-col gap-2 rounded-2xl border border-foreground/10 bg-surface/50 p-5 backdrop-blur">
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <span className="h-4 w-1 rounded-full bg-gradient-to-b from-brand-400 to-brand-600" />
              {t("improvements")}
            </h2>
            {report.improvements.length ? (
              <ul className="flex list-disc flex-col gap-1 ps-5 text-sm text-foreground/80 marker:text-brand-500">
                {report.improvements.map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-foreground/65">{t("noImprovements")}</p>
            )}
          </section>
          <TextSection
            title={t("knowledge")}
            body={report.knowledgeAssessment}
          />
          <GenerateReportButton sessionId={session.id} regenerate />
        </>
      ) : hasActivity(session) ? (
        <div className="flex flex-col gap-3 rounded-2xl border border-foreground/10 bg-surface/50 p-5 backdrop-blur">
          <p className="text-sm text-foreground/60">
            {t("notGenerated")}
          </p>
          <GenerateReportButton sessionId={session.id} />
        </div>
      ) : (
        // 空会话不给生成按钮（接口也会拒绝），直接告诉学生该去哪
        <div className="flex flex-col gap-3 rounded-2xl border border-foreground/10 bg-surface/50 p-5 backdrop-blur">
          <p className="text-sm text-foreground/60">
            {t("noActivity")}
          </p>
          {experiment ? (
            <Link
              href={`/experiments/${experiment.slug}`}
              className="self-start text-sm font-medium text-brand-600 hover:underline dark:text-brand-300"
            >
              {t("backToLab")}
            </Link>
          ) : null}
        </div>
      )}
    </main>
  );
}

// 段落区块：展示单段文本，缺失时给出占位提示
function TextSection({ title, body }: { title: string; body: string }) {
  return (
    <section className="flex flex-col gap-2 rounded-2xl border border-foreground/10 bg-surface/50 p-5 backdrop-blur">
      <h2 className="flex items-center gap-2 text-lg font-semibold">
        <span className="h-4 w-1 rounded-full bg-gradient-to-b from-brand-400 to-brand-600" />
        {title}
      </h2>
      <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/80">
        {body || "（暂无内容）"}
      </p>
    </section>
  );
}
