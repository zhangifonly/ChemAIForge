import { NextResponse } from "next/server";
import { clearSessionCookie } from "@/server/auth";

// POST /api/auth/logout —— 清除会话 cookie，登出当前用户
export async function POST() {
  clearSessionCookie();
  return NextResponse.json({ ok: true });
}
