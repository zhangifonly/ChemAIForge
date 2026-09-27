import { NextResponse } from "next/server";
import {
  canSynthesize,
  synthesize,
  TtsBusyError,
  TtsUnsupportedError,
} from "@/server/tts/synthesize";
import { isLocale } from "@/lib/i18n/locales";
import { ttsRequestSchema } from "@/server/tts/validation";

// POST /api/tts —— 按需合成一句口播的语音，返回 mp3。
//
// 用 POST 而不是 GET：口播文本可长达几百字，放进查询串会撞上 URL 长度限制，
// 也会把整段讲解文本写进访问日志。
//
// 客户端只在"静态预生成文件不存在"时才调这里（见 LessonPlayer 的三级回退），
// 故本接口的流量天然只覆盖尚未生成的语种与句子。
export async function POST(request: Request) {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "请求体格式错误" }, { status: 400 });
  }

  const parsed = ttsRequestSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "入参校验失败", details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const { text, locale, gender } = parsed.data;
  if (!isLocale(locale) || !canSynthesize(locale)) {
    // 不是错误而是"这个语种没有音色"，客户端据此回退浏览器语音
    return NextResponse.json({ error: "该语言无可用音色" }, { status: 501 });
  }

  try {
    const mp3 = await synthesize(text, locale, gender);
    return new NextResponse(new Uint8Array(mp3), {
      headers: {
        "content-type": "audio/mpeg",
        "content-length": String(mp3.length),
        // 同一句文本的语音永不改变（文本变了哈希也变），可长期缓存
        "cache-control": "public, max-age=31536000, immutable",
      },
    });
  } catch (err) {
    if (err instanceof TtsUnsupportedError) {
      return NextResponse.json({ error: "该语言无可用音色" }, { status: 501 });
    }
    if (err instanceof TtsBusyError) {
      // 503 + Retry-After：客户端可以选择稍后再试或直接用浏览器语音
      return NextResponse.json(
        { error: "语音合成繁忙，请稍后再试" },
        { status: 503, headers: { "retry-after": "5" } },
      );
    }
    return NextResponse.json(
      { error: "语音合成失败", detail: err instanceof Error ? err.message : String(err) },
      { status: 502 },
    );
  }
}
