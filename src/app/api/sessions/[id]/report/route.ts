import { NextResponse } from "next/server";
import { getSession, hasActivity, saveReport } from "@/server/session";
import { getExperimentById } from "@/server/experiments/service";
import { generateReport } from "@/server/ai/report";
import { isLocale, SOURCE_LOCALE } from "@/lib/i18n/locales";
import { errorText } from "@/lib/i18n/errors";

// POST /api/sessions/[id]/report —— 基于会话 steps/measurements 调用 AI
// 生成结构化实验报告并持久化，返回完整报告。
export async function POST(
  request: Request,
  { params }: { params: { id: string } },
) {
  const rawLocale = new URL(request.url).searchParams.get("locale");
  const locale = rawLocale && isLocale(rawLocale) ? rawLocale : SOURCE_LOCALE;
  const session = await getSession(params.id);
  if (!session) {
    return NextResponse.json({ error: "会话不存在" }, { status: 404 });
  }

  // 一步操作都没有就不调 AI：模型只能凭实验简介编一份结论，白耗配额还误导学生。
  // 422 而非 400 —— 请求本身合法，是会话内容还不足以生成报告。
  if (!hasActivity(session)) {
    return NextResponse.json(
      // 这条是常规提示、用户真会看到，故按界面语言给出；
      // 其余校验类错误是"不该发生"的情形，保持中文即可
      { error: await errorText("noActivity", locale) },
      { status: 422 },
    );
  }

  const experiment = await getExperimentById(session.experimentId);
  if (!experiment) {
    return NextResponse.json({ error: "关联实验不存在" }, { status: 404 });
  }

  let report;
  try {
    // 报告语言跟随界面语言：学生在日语界面做的实验，报告也该是日语
    report = await generateReport(experiment, session, undefined, locale);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : await errorText("reportFailed", locale) },
      { status: 502 },
    );
  }

  const updated = await saveReport(params.id, report);
  return NextResponse.json(updated);
}
