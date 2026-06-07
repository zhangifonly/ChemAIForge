import { NextResponse } from "next/server";
import { getCurrentSession } from "@/server/auth";
import { getExperimentBySlug } from "@/server/experiments/service";
import { streamTutorReply, type TutorMessage } from "@/server/ai/tutor";
import { tutorRequestSchema } from "@/server/ai/validation";

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

// POST /api/ai/tutor —— 校验登录与入参后，以 SSE 流式返回 AI 导师回复增量
export async function POST(request: Request) {
  const session = await getCurrentSession();
  if (!session) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }

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

  const { experimentSlug, messages, labState } = parsed.data;
  const experiment = await getExperimentBySlug(experimentSlug);
  if (!experiment) {
    return NextResponse.json({ error: "实验不存在" }, { status: 404 });
  }

  // 先获取流式迭代器的首块，以便在正式开流前捕获上游错误并返回 502
  const iterator = streamTutorReply(experiment, {
    messages: withLabState(messages, labState),
  })[Symbol.asyncIterator]();

  let first: IteratorResult<string>;
  try {
    first = await iterator.next();
  } catch (err) {
    return NextResponse.json(
      {
        error: "AI 导师服务异常",
        detail: err instanceof Error ? err.message : String(err),
      },
      { status: 502 },
    );
  }

  const encoder = new TextEncoder();
  // 以 SSE 格式包装文本增量：data: <json>\n\n
  const sse = (text: string) =>
    encoder.encode(`data: ${JSON.stringify({ text })}\n\n`);

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        if (!first.done) controller.enqueue(sse(first.value));
        for (;;) {
          const { done, value } = await iterator.next();
          if (done) break;
          controller.enqueue(sse(value));
        }
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      } catch (err) {
        const detail = err instanceof Error ? err.message : String(err);
        controller.enqueue(
          encoder.encode(`event: error\ndata: ${JSON.stringify({ detail })}\n\n`),
        );
      } finally {
        controller.close();
      }
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
