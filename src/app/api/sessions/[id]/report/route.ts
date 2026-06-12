import { NextResponse } from "next/server";
import { getSession, saveReport } from "@/server/session";
import { getExperimentById } from "@/server/experiments/service";
import { generateReport } from "@/server/ai/report";

// POST /api/sessions/[id]/report —— 基于会话 steps/measurements 调用 AI
// 生成结构化实验报告并持久化，返回完整报告。
export async function POST(
  _request: Request,
  { params }: { params: { id: string } },
) {
  const session = await getSession(params.id);
  if (!session) {
    return NextResponse.json({ error: "会话不存在" }, { status: 404 });
  }

  const experiment = await getExperimentById(session.experimentId);
  if (!experiment) {
    return NextResponse.json({ error: "关联实验不存在" }, { status: 404 });
  }

  let report;
  try {
    report = await generateReport(experiment, session);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "报告生成失败" },
      { status: 502 },
    );
  }

  const updated = await saveReport(params.id, report);
  return NextResponse.json(updated);
}
