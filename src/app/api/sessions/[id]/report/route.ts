import { NextResponse } from "next/server";
import { getCurrentSession } from "@/server/auth";
import { getSession, saveReport } from "@/server/session";
import { getExperimentById } from "@/server/experiments/service";
import { generateReport } from "@/server/ai/report";

// POST /api/sessions/[id]/report —— 基于会话 steps/measurements 调用 AI
// 生成结构化实验报告并持久化，返回完整报告。
export async function POST(
  _request: Request,
  { params }: { params: { id: string } },
) {
  const auth = await getCurrentSession();
  if (!auth) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }

  // 校验会话存在且归属当前用户，避免越权生成他人会话报告
  const session = await getSession(params.id);
  if (!session) {
    return NextResponse.json({ error: "会话不存在" }, { status: 404 });
  }
  if (session.userId !== auth.userId) {
    return NextResponse.json({ error: "无权访问该会话" }, { status: 403 });
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
