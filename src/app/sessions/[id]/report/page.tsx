import Link from "next/link";
import { notFound } from "next/navigation";
import { getSession } from "@/server/session";
import { getExperimentById } from "@/server/experiments/service";
import { MeasurementChart } from "@/components/session/measurement-chart";

// 实验报告页：服务端查询会话，展示 AI 结构化报告（结论/误差/改进/掌握评估）
// 与 measurements 折线图。未生成报告时引导用户先行生成。
export default async function SessionReportPage({
  params,
}: {
  params: { id: string };
}) {
  const session = await getSession(params.id);
  if (!session) notFound();

  const experiment = await getExperimentById(session.experimentId);
  const report = session.report;

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 p-8">
      <Link
        href="/experiments"
        className="text-sm text-foreground/60 hover:text-foreground"
      >
        ← 返回实验库
      </Link>

      <header className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold tracking-tight">实验报告</h1>
        {experiment ? (
          <p className="text-foreground/70">{experiment.title}</p>
        ) : null}
        {report ? (
          <p className="text-xs text-foreground/50">
            生成于 {new Date(report.generatedAt).toLocaleString("zh-CN")}
          </p>
        ) : null}
      </header>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">测量读数</h2>
        <MeasurementChart measurements={session.measurements} />
      </section>

      {report ? (
        <>
          <TextSection title="实验结论" body={report.conclusion} />
          <TextSection title="误差分析" body={report.errorAnalysis} />
          <section className="flex flex-col gap-2">
            <h2 className="text-lg font-semibold">改进建议</h2>
            {report.improvements.length ? (
              <ul className="flex flex-col gap-1 pl-5 text-sm text-foreground/80 list-disc">
                {report.improvements.map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-foreground/50">暂无改进建议。</p>
            )}
          </section>
          <TextSection
            title="知识点掌握评估"
            body={report.knowledgeAssessment}
          />
        </>
      ) : (
        <p className="rounded-lg border border-foreground/10 bg-foreground/[0.02] p-4 text-sm text-foreground/60">
          尚未生成报告。请在实验结束后调用生成接口
          <code className="mx-1 rounded bg-foreground/10 px-1.5 py-0.5 text-xs">
            POST /api/sessions/{session.id}/report
          </code>
          后刷新本页查看。
        </p>
      )}
    </main>
  );
}

// 段落区块：展示单段文本，缺失时给出占位提示
function TextSection({ title, body }: { title: string; body: string }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="whitespace-pre-wrap text-sm text-foreground/80">
        {body || "（暂无内容）"}
      </p>
    </section>
  );
}
