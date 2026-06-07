import { NextResponse } from "next/server";
import { getCurrentSession } from "@/server/auth";
import {
  appendMeasurement,
  appendStep,
  completeSession,
  getSession,
} from "@/server/session";
import { updateSessionSchema } from "@/server/session/validation";

// PATCH /api/sessions/[id] —— 向归属于当前用户的会话追加 step/measurement，
// 或标记会话完成（三类操作可在一次请求中按 step → measurement → complete 顺序应用）
export async function PATCH(
  request: Request,
  { params }: { params: { id: string } },
) {
  const session = await getCurrentSession();
  if (!session) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "请求体格式错误" }, { status: 400 });
  }

  const parsed = updateSessionSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "入参校验失败", details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  // 校验会话存在且归属当前用户，避免越权修改他人会话
  const existing = await getSession(params.id);
  if (!existing) {
    return NextResponse.json({ error: "会话不存在" }, { status: 404 });
  }
  if (existing.userId !== session.userId) {
    return NextResponse.json({ error: "无权访问该会话" }, { status: 403 });
  }

  const { step, measurement, complete } = parsed.data;
  if (step) await appendStep(params.id, step);
  if (measurement) await appendMeasurement(params.id, measurement);
  const updated = complete
    ? await completeSession(params.id)
    : await getSession(params.id);

  return NextResponse.json(updated);
}
