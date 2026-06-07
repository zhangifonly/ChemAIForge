import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  loginSchema,
  verifyPassword,
  createSessionToken,
  setSessionCookie,
} from "@/server/auth";

// POST /api/auth/login —— 校验密码并下发会话 cookie
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "请求体格式错误" }, { status: 400 });
  }

  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "入参校验失败", details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const { email, password } = parsed.data;

  const user = await prisma.user.findUnique({ where: { email } });
  // 统一返回 401，避免泄露邮箱是否存在
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    return NextResponse.json({ error: "邮箱或密码错误" }, { status: 401 });
  }

  const token = await createSessionToken({
    userId: user.id,
    email: user.email,
    role: user.role as "STUDENT" | "TEACHER",
  });
  setSessionCookie(token);

  return NextResponse.json({
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    },
  });
}
