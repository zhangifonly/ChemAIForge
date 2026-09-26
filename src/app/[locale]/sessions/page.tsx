import Link from "next/link";
import { ensureGuestUserId } from "@/server/guest";
import { listSessionsByUser } from "@/server/session";
import { getExperimentById } from "@/server/experiments/service";
import { SessionStatus } from "@/server/session/types";

// 「我的会话」列表页：平台已去登录，会话归属固定访客用户，直接列出其历史会话
export default async function SessionsPage() {
  const userId = await ensureGuestUserId();

  const sessions = await listSessionsByUser(userId);

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
    <main id="main" className="mx-auto flex max-w-3xl flex-col gap-6 px-6 py-10 animate-fade-up">
      <header className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold tracking-tight">我的会话</h1>
        <p className="text-foreground/70">查看历史实验记录并进入对应报告</p>
      </header>

      {sessions.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-foreground/15 py-16 text-center">
          <span className="text-3xl">🧫</span>
          <p className="text-sm text-foreground/50">
            暂无实验会话，去{" "}
            <Link
              href="/experiments"
              className="font-medium text-brand-600 hover:underline dark:text-brand-300"
            >
              实验库
            </Link>{" "}
            开始一次实验吧。
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {sessions.map((s) => (
            <li
              key={s.id}
              className="flex items-center justify-between rounded-2xl border border-foreground/10 bg-surface/70 px-5 py-4 shadow-soft backdrop-blur transition-all hover:border-brand-400/40 hover:shadow-glow"
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
                  className="text-sm font-medium text-brand-600 hover:underline dark:text-brand-300"
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
