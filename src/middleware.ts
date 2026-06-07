import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";
import { SESSION_COOKIE_NAME } from "@/server/auth/types";

// 受保护路由：访问前需校验会话 cookie，未登录重定向 /login
// 命中规则：/sessions 及其子路由、实验工作台 /experiments/[slug]/lab
function isProtected(pathname: string): boolean {
  if (pathname === "/sessions" || pathname.startsWith("/sessions/")) {
    return true;
  }
  // 仅实验工作台需要登录，实验详情/列表页公开
  return /^\/experiments\/[^/]+\/lab\/?$/.test(pathname);
}

// 与 server/auth/session.ts 保持一致的密钥来源（edge runtime 复用 jose 验证）
function getSecret(): Uint8Array {
  const secret = process.env.AUTH_SECRET ?? "chemai-forge-dev-secret-change-me";
  return new TextEncoder().encode(secret);
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (!isProtected(pathname)) {
    return NextResponse.next();
  }

  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  let valid = false;
  if (token) {
    try {
      await jwtVerify(token, getSecret());
      valid = true;
    } catch {
      valid = false;
    }
  }

  if (valid) {
    return NextResponse.next();
  }

  // 未登录或会话失效：重定向到登录页，并带上回跳地址
  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("redirect", pathname);
  return NextResponse.redirect(loginUrl);
}

// 仅对受保护前缀启用中间件，降低无关请求开销
export const config = {
  matcher: ["/sessions/:path*", "/experiments/:path*"],
};
