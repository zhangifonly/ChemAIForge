import { z } from "zod";

// 单条对话消息：仅允许 user / assistant 两种角色
const tutorMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1, "消息内容不能为空"),
});

// POST /api/ai/tutor 请求体校验
// labState 为画布当前状态快照，结构灵活，仅做存在性透传
export const tutorRequestSchema = z.object({
  experimentSlug: z.string().min(1, "缺少实验标识"),
  messages: z.array(tutorMessageSchema).min(1, "至少需要一条消息"),
  labState: z.record(z.string(), z.unknown()).optional(),
});

export type TutorRequest = z.infer<typeof tutorRequestSchema>;
