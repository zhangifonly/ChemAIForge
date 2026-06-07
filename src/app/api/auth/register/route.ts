import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  registerSchema,
  hashPassword,
  createSessionToken,
  setSessionCookie,
} from "@/server/auth";

// POST /api/auth/register —— 注册新用户
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "请求体格式错误" }, { status: 400 });
  }

  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "入参校验失败", details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const { email, password, name, role } = parsed.data;

  try {
    const passwordHash = await hashPassword(password);
    const user = await prisma.user.create({
      data: { email, passwordHash, name, role },
      select: { id: true, email: true, name: true, role: true, createdAt: true },
    });

    const token = await createSessionToken({
      userId: user.id,
      email: user.email,
      role: user.role as "STUDENT" | "TEACHER",
    });
    setSessionCookie(token);

    return NextResponse.json({ user }, { status: 201 });
  } catch (error) {
    // 唯一约束冲突（email 已存在）
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return NextResponse.json({ error: "该邮箱已被注册" }, { status: 409 });
    }
    return NextResponse.json({ error: "注册失败，请稍后重试" }, { status: 500 });
  }
}
