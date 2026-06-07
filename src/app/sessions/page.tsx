import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentSession } from "@/server/auth";
import { listSessionsByUser } from "@/server/session";
import { getExperimentById } from "@/server/experiments/service";
import { SessionStatus } from "@/server/session/types";

// 「我的会话」列表页：服务端校验登录态，列出当前用户历史会话
// middleware 已拦截未登录访问，此处兜底再校验一次并补全实验标题
export default async function SessionsPage() {
  const auth = await getCurrentSession();
  if (!auth) redirect("/login?redirect=/sessions");

  const sessions = await listSessionsByUser(auth.userId);

  // 批量补全实验标题（去重查询，避免重复 DB 往返）
  const experimentIds = [...new Set(sessions.map((s) => s.experimentId))];
  const titleEntries = await Promise.all(
    experimentIds.map(async (id) => {
      const exp = await getExperimentById(id);
      return [id, exp?.title ?? "未知实验"] as const;
    }),
  );
  const titleMap = new Map(titleEntries);

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 p-8">
      <header className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold tracking-tight">我的会话</h1>
        <p className="text-foreground/70">查看历史实验记录并进入对应报告</p>
      </header>

      {sessions.length === 0 ? (
        <p className="text-sm text-foreground/50">
          暂无实验会话，去{" "}
          <Link href="/experiments" className="underline hover:text-foreground">
            实验库
          </Link>{" "}
          开始一次实验吧。
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {sessions.map((s) => (
            <li
              key={s.id}
              className="flex items-center justify-between rounded-lg border border-foreground/10 px-5 py-4"
            >
              <div className="flex flex-col gap-1">
                <span className="font-medium">
                  {titleMap.get(s.experimentId)}
                </span>
                <span className="text-xs text-foreground/50">
                  开始于 {new Date(s.startedAt).toLocaleString("zh-CN")}
                </span>
              </div>

              <div className="flex items-center gap-3">
                <StatusBadge status={s.status} />
                <Link
                  href={`/sessions/${s.id}/report`}
                  className="text-sm text-foreground/70 underline hover:text-foreground"
                >
                  查看报告
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

// 会话状态徽标：进行中 / 已完成
function StatusBadge({ status }: { status: SessionStatus }) {
  const completed = status === SessionStatus.COMPLETED;
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-xs ${
        completed
          ? "bg-green-500/15 text-green-600"
          : "bg-amber-500/15 text-amber-600"
      }`}
    >
      {completed ? "已完成" : "进行中"}
    </span>
  );
}
