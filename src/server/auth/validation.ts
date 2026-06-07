import { z } from "zod";
import { UserRole } from "./types";

// 注册入参校验
export const registerSchema = z.object({
  email: z.string().email("邮箱格式不正确"),
  password: z.string().min(8, "密码至少 8 位"),
  name: z.string().min(1).max(50).optional(),
  role: z.nativeEnum(UserRole).optional().default(UserRole.STUDENT),
});

// 登录入参校验
export const loginSchema = z.object({
  email: z.string().email("邮箱格式不正确"),
  password: z.string().min(1, "请输入密码"),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
