import { z } from "zod";

// 单条操作步骤校验
export const sessionStepSchema = z.object({
  action: z.string().min(1, "缺少动作类型"),
  detail: z.record(z.string(), z.unknown()).optional(),
  at: z.string().min(1, "缺少时间戳"),
});

// 单条读数记录校验
export const sessionMeasurementSchema = z.object({
  ph: z.number(),
  temperature: z.number(),
  at: z.string().min(1, "缺少时间戳"),
});

// POST /api/sessions 请求体：创建会话仅需实验标识
export const createSessionSchema = z.object({
  experimentId: z.string().min(1, "缺少实验标识"),
});

// PATCH /api/sessions/[id] 请求体：
// 既可追加操作步骤 / 读数，也可标记会话完成，三者皆为可选但至少需其一
export const updateSessionSchema = z
  .object({
    step: sessionStepSchema.optional(),
    measurement: sessionMeasurementSchema.optional(),
    complete: z.literal(true).optional(),
  })
  .refine((v) => v.step || v.measurement || v.complete, {
    message: "请求至少包含 step、measurement 或 complete 之一",
  });

export type CreateSessionInput = z.infer<typeof createSessionSchema>;
export type UpdateSessionInput = z.infer<typeof updateSessionSchema>;
