import { z } from "zod";

/**
 * 单句口播的长度上限。
 *
 * 全库最长的一句实测 200 字出头（配位滴定那几条现象描述），给到 1000
 * 留足余量。设上限是防止有人拿这个接口当免费 TTS 批量合成长文本 ——
 * edge-tts 的调用成本落在我们这边。
 */
const MAX_TEXT_CHARS = 1000;

export const ttsRequestSchema = z.object({
  text: z.string().min(1, "文本不能为空").max(MAX_TEXT_CHARS, "文本过长"),
  locale: z.string().min(2).max(12),
  gender: z.enum(["female", "male"]),
});

export type TtsRequest = z.infer<typeof ttsRequestSchema>;
