import { NextResponse } from "next/server";
import { getExperimentBySlug } from "@/server/experiments/service";
import { streamTutorReply, type TutorMessage } from "@/server/ai/tutor";
import { tutorRequestSchema } from "@/server/ai/validation";
import { isLocale, SOURCE_LOCALE } from "@/lib/i18n/locales";
import { errorText } from "@/lib/i18n/errors";

// 将画布状态快照折叠为一行上下文，附加到最后一条用户消息，供导师参考
function withLabState(
  messages: TutorMessage[],
  labState?: Record<string, unknown>,
): TutorMessage[] {
  if (!labState || Object.keys(labState).length === 0) return messages;
  const note = `\n\n【当前实验台状态】\n${JSON.stringify(labState)}`;
  const last = messages[messages.length - 1];
  return [
    ...messages.slice(0, -1),
    { ...last, content: last.content + note },
  ];
}

// POST /api/ai/tutor —— 校验入参后，以 SSE 流式返回 AI 导师回复增量
export async function POST(request: Request) {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "请求体格式错误" }, { status: 400 });
  }

  const parsed = tutorRequestSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "入参校验失败", details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const { experimentSlug, messages, labState, locale} = parsed.data;
  const experiment = await getExperimentBySlug(experimentSlug);
  if (!experiment) {
    return NextResponse.json({ error: "实验不存在" }, { status: 404 });
  }

  // 先获取流式迭代器的首块，以便在正式开流前捕获上游错误并返回 502
  const iterator = streamTutorReply(experiment, {
    messages: withLabState(messages, labState),
    // 未知语言代码交由 tutor 层按源语言兜底，不在这里 400 —— 
    // 语言不对只该退化成"换种语言回答"，不该让提问直接失败
    locale: isLocale(locale ?? "") ? locale : undefined,
  })[Symbol.asyncIterator]();

  let first: IteratorResult<string>;
  try {
    first = await iterator.next();
  } catch (err) {
    return NextResponse.json(
      {
        error: await errorText("tutorUnavailable", isLocale(locale ?? "") ? (locale as string) : SOURCE_LOCALE),
        detail: err instanceof Error ? err.message : String(err),
      },
      { status: 502 },
    );
  }

  const encoder = new TextEncoder();
  // 以 SSE 格式包装文本增量：data: <json>\n\n
  const sse = (text: string) =>
    encoder.encode(`data: ${JSON.stringify({ text })}\n\n`);

  // 客户端是否已断开：断开后 controller 已关闭，再 enqueue 会抛 TypeError，
  // 那个异常又会被下面的 catch 当成"上游出错"去 enqueue 错误事件，二次抛错。
  let aborted = false;
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        if (!first.done) controller.enqueue(sse(first.value));
        for (;;) {
          const { done, value } = await iterator.next();
          if (done) break;
          if (aborted) break;
          controller.enqueue(sse(value));
        }
        if (!aborted) controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      } catch (err) {
        if (aborted) return;
        const detail = err instanceof Error ? err.message : String(err);
        controller.enqueue(
          encoder.encode(`event: error\ndata: ${JSON.stringify({ detail })}\n\n`),
        );
      } finally {
        // 关掉上游迭代器：用户关页面 / 重新提问打断时若不 return，
        // 上游连接会一直挂着继续生成，白耗配额。
        await iterator.return?.().catch(() => {});
        if (!aborted) controller.close();
      }
    },
    cancel() {
      aborted = true;
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
    },
  });
}
