import { Link } from "@/lib/i18n/navigation";
import { ensureGuestUserId } from "@/server/guest";
import { listSessionsPage } from "@/server/session";
import { getExperimentById } from "@/server/experiments/service";
import { SessionStatus } from "@/server/session/types";
import { getTranslations } from "next-intl/server";
import { localizeExperiment } from "@/lib/i18n/content";

/** 每页条数。一屏手机约能看到 5~6 张卡片，20 条大约三四屏，翻页不算频繁 */
const PAGE_SIZE = 20;

// 「我的会话」列表页：平台已去登录，会话归属固定访客用户，分页列出其历史会话
export default async function SessionsPage({
  params,
  searchParams,
}: {
  params: { locale: string };
  searchParams: { page?: string };
}) {
  const { locale } = params;
  const t = await getTranslations("sessions");
  const userId = await ensureGuestUserId();

  const { items: sessions, total, page, pageCount } = await listSessionsPage(
    userId,
    Number(searchParams.page ?? 1),
    PAGE_SIZE,
  );

  // 只为当前页补标题：原先为全部会话逐个查实验，1500 条就是上百次查询
  const experimentIds = [...new Set(sessions.map((s) => s.experimentId))];
  const titleEntries = await Promise.all(
    experimentIds.map(async (id) => {
      const exp = await getExperimentById(id);
      // 标题套译文：会话列表是学生回看自己做过什么的地方，标题是中文就认不出
      const title = exp ? (await localizeExperiment(exp, locale)).title : null;
      return [id, title ?? t("unknownExperiment")] as const;
    }),
  );
  const titleMap = new Map(titleEntries);

  return (
    <main
      id="main"
      className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-8 animate-fade-up sm:px-6 sm:py-10"
    >
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{t("title")}</h1>
        <p className="text-foreground/70">{t("subtitle")}</p>
      </header>

      {total === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-foreground/15 py-16 text-center">
          <span className="text-3xl">🧫</span>
          <p className="text-sm text-foreground/65">
            {t("emptyPrefix")}{" "}
            <Link
              href="/experiments"
              className="font-medium text-brand-600 hover:underline dark:text-brand-300"
            >
              {t("emptyLink")}
            </Link>{" "}
            {t("emptySuffix")}
          </p>
        </div>
      ) : (
        <>
          <ul className="flex flex-col gap-3">
            {sessions.map((s) => (
              <li key={s.id}>
                {/* 整张卡片可点：手机上原先只有右侧「查看报告」四个字能点，约 80×20px */}
                <Link
                  href={`/sessions/${s.id}/report`}
                  className="flex flex-col gap-3 rounded-2xl border border-foreground/10 bg-surface/70 px-4 py-4 shadow-soft backdrop-blur transition-all hover:border-brand-400/40 hover:shadow-glow sm:flex-row sm:items-center sm:justify-between sm:px-5"
                >
                  <div className="flex min-w-0 flex-col gap-1">
                    <span className="font-medium">{titleMap.get(s.experimentId)}</span>
                    <span className="text-xs text-foreground/65">
                      {t("startedAt", { time: new Date(s.startedAt).toLocaleString(locale) })}
                    </span>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <StatusBadge
                      status={s.status}
                      label={s.status === "COMPLETED" ? t("completed") : t("inProgress")}
                    />
                    <span className="text-sm font-medium text-brand-600 dark:text-brand-300">
                      {t("viewReport")} →
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>

          {pageCount > 1 ? (
            <nav
              aria-label={t("pageOf", { page, pageCount, total })}
              className="flex items-center justify-between gap-3"
            >
              <PageLink href={`/sessions?page=${page - 1}`} disabled={page <= 1}>
                ← {t("prev")}
              </PageLink>
              <span className="text-xs tabular-nums text-foreground/65">
                {t("pageOf", { page, pageCount, total })}
              </span>
              <PageLink href={`/sessions?page=${page + 1}`} disabled={page >= pageCount}>
                {t("next")} →
              </PageLink>
            </nav>
          ) : null}
        </>
      )}
    </main>
  );
}

// 翻页按钮：到头时渲染成不可点的占位，保持左右两端对齐
function PageLink({
  href,
  disabled,
  children,
}: {
  href: string;
  disabled: boolean;
  children: React.ReactNode;
}) {
  const cls = "rounded-xl border border-foreground/15 px-4 py-2.5 text-sm font-medium";
  if (disabled) {
    return (
      <span aria-disabled className={`${cls} opacity-40`}>
        {children}
      </span>
    );
  }
  return (
    <Link href={href} className={`${cls} transition-colors hover:border-brand-400/50 hover:bg-brand-500/5`}>
      {children}
    </Link>
  );
}

// 会话状态徽标：进行中 / 已完成
// 文案由父组件传入：服务端组件里的子函数取不到 await getTranslations
function StatusBadge({ status, label }: { status: SessionStatus; label: string }) {
  const completed = status === SessionStatus.COMPLETED;
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-xs ${
        completed ? "bg-green-500/15 text-green-600" : "bg-amber-500/15 text-amber-600"
      }`}
    >
      {label}
    </span>
  );
}
