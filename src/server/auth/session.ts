import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import {
  SESSION_COOKIE_NAME,
  SESSION_MAX_AGE,
  type SessionPayload,
} from "./types";

// JWT 签名密钥，生产环境必须通过 AUTH_SECRET 注入
const getSecret = (): Uint8Array => {
  const secret =
    process.env.AUTH_SECRET ?? "chemai-forge-dev-secret-change-me";
  return new TextEncoder().encode(secret);
};

// 生成签名后的会话 JWT
export async function createSessionToken(
  payload: SessionPayload,
): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE}s`)
    .sign(getSecret());
}

// 校验会话 JWT，失败返回 null
export async function verifySessionToken(
  token: string,
): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    return {
      userId: payload.userId as string,
      email: payload.email as string,
      role: payload.role as SessionPayload["role"],
    };
  } catch {
    return null;
  }
}

// 将会话 token 写入 httpOnly cookie
export function setSessionCookie(token: string): void {
  cookies().set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
}

// 清除会话 cookie
export function clearSessionCookie(): void {
  cookies().delete(SESSION_COOKIE_NAME);
}

// 读取并校验当前请求的会话，供受保护 API 复用
export async function getCurrentSession(): Promise<SessionPayload | null> {
  const token = cookies().get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}
