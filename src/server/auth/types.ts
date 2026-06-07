// 认证相关共享常量与类型
export const SESSION_COOKIE_NAME = "chemai_session";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 7; // 7 天（秒）

// 用户角色（SQLite 不支持原生 enum，集中在应用层约束取值）
export const UserRole = {
  STUDENT: "STUDENT",
  TEACHER: "TEACHER",
} as const;

export type UserRole = (typeof UserRole)[keyof typeof UserRole];

// 会话载荷
export interface SessionPayload {
  userId: string;
  email: string;
  role: UserRole;
}
