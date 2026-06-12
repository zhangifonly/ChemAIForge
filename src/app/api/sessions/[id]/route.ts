import { NextResponse } from "next/server";
import {
  appendMeasurement,
  appendStep,
  completeSession,
  getSession,
} from "@/server/session";
import { updateSessionSchema } from "@/server/session/validation";

// PATCH /api/sessions/[id] —— 向会话追加 step/measurement，或标记会话完成
// （三类操作可在一次请求中按 step → measurement → complete 顺序应用）
export async function PATCH(
  request: Request,
  { params }: { params: { id: string } },
) {
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

  const existing = await getSession(params.id);
  if (!existing) {
    return NextResponse.json({ error: "会话不存在" }, { status: 404 });
  }

  const { step, measurement, complete } = parsed.data;
  if (step) await appendStep(params.id, step);
  if (measurement) await appendMeasurement(params.id, measurement);
  const updated = complete
    ? await completeSession(params.id)
    : await getSession(params.id);

  return NextResponse.json(updated);
}
