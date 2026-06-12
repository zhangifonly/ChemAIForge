// 访客用户助手
// 平台已去除登录注册，但 ExperimentSession.userId 仍是指向 User 的外键，
// 会话必须挂在某个用户上。这里维护一个固定的「访客用户」，所有会话归属它。
// 幂等：首次调用时创建，之后直接复用，避免每次会话都新建用户。
import { prisma } from "@/lib/prisma";

// 固定访客用户的稳定标识（email 唯一键，便于 upsert）
export const GUEST_USER_EMAIL = "guest@chemaiforge.local";
const GUEST_USER_NAME = "访客";

// 确保访客用户存在并返回其 id（幂等 upsert）
export async function ensureGuestUserId(): Promise<string> {
  const user = await prisma.user.upsert({
    where: { email: GUEST_USER_EMAIL },
    update: {},
    create: {
      email: GUEST_USER_EMAIL,
      // 平台无登录入口，密码哈希仅为满足非空约束，置占位值（不可用于登录）
      passwordHash: "guest-no-login",
      name: GUEST_USER_NAME,
      role: "STUDENT",
    },
  });
  return user.id;
}
