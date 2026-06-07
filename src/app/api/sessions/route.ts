import { NextResponse } from "next/server";
import { getCurrentSession } from "@/server/auth";
import { getExperimentById } from "@/server/experiments/service";
import { createSession } from "@/server/session";
import { createSessionSchema } from "@/server/session/validation";

// POST /api/sessions —— 为当前登录用户创建一次实验会话，返回会话 id
export async function POST(request: Request) {
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

  const parsed = createSessionSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "入参校验失败", details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const experiment = await getExperimentById(parsed.data.experimentId);
  if (!experiment) {
    return NextResponse.json({ error: "实验不存在" }, { status: 404 });
  }

  const created = await createSession(session.userId, experiment.id);
  return NextResponse.json(created, { status: 201 });
}
