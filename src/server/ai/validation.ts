import { z } from "zod";

/**
 * 入口防线的三个上限。
 *
 * 注意它们不是「功能上限」：真正决定送给模型多少历史的是 tutor.ts 的
 * trimHistory（20 条 / 每条 8000 字）。这里的阈值刻意放得宽得多，只拦明显异常的
 * 请求体 —— 如果卡得和 trim 一样紧，学生聊到第 21 轮就会收到 400 而不是被静默裁剪，
 * 那是把省钱做成了故障。
 */
const MAX_REQUEST_MESSAGES = 200;
const MAX_CONTENT_CHARS = 20000;
const MAX_TOTAL_CHARS = 200000;

// 单条对话消息：仅允许 user / assistant 两种角色
const tutorMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z
    .string()
    .min(1, "消息内容不能为空")
    .max(MAX_CONTENT_CHARS, "单条消息过长"),
});

// POST /api/ai/tutor 请求体校验
// labState 为画布当前状态快照，结构灵活，仅做存在性透传
export const tutorRequestSchema = z.object({
  experimentSlug: z.string().min(1, "缺少实验标识"),
  messages: z
    .array(tutorMessageSchema)
    .min(1, "至少需要一条消息")
    .max(MAX_REQUEST_MESSAGES, "对话历史过长")
    // 条数与单条长度都合法，总量仍可能失控（200 × 20000 = 4MB），故再兜一道总量
    .refine(
      (list) => list.reduce((sum, m) => sum + m.content.length, 0) <= MAX_TOTAL_CHARS,
      { message: "对话历史体积过大" },
    ),
  labState: z.record(z.string(), z.unknown()).optional(),
  // 回答语言。可选：不传按源语言回答，旧客户端行为不变
  locale: z.string().min(2).max(12).optional(),
});

export type TutorRequest = z.infer<typeof tutorRequestSchema>;
