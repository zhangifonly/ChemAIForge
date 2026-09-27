import { Link } from "@/lib/i18n/navigation";
import { getTranslations } from "next-intl/server";
import { allExperiments } from "@/data/experiments";

// 首页：左对齐 Hero + 编号式工作流（替代通用三等分卡片），单一品牌青色调
// 实验数量从目录动态读取，避免文案与实际脱节（曾写死 102 导致扩容后不同步）。
export default async function HomePage() {
  const t = await getTranslations("home");
  const experimentCount = allExperiments.length;
  return (
    <main id="main" className="relative z-10 mx-auto max-w-5xl px-6 py-20 sm:py-28">
      <section className="flex max-w-3xl flex-col gap-6 animate-fade-up">
        <span className="inline-flex w-fit items-center gap-2 rounded-full border border-brand-400/30 bg-brand-500/10 px-4 py-1.5 text-xs font-medium text-brand-700 dark:text-brand-300">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-brand-500" />
          {t("badge")}
        </span>
        <h1 className="break-words text-4xl font-bold leading-[1.1] [hyphens:auto] sm:text-5xl sm:leading-[1.05] md:text-7xl">
          {t("heroLine1")}
          <br />
          <span className="bg-gradient-to-r from-brand-500 to-brand-700 bg-clip-text text-transparent dark:from-brand-300 dark:to-brand-500">
            {t("heroLine2")}
          </span>
        </h1>
        <p className="max-w-xl text-lg leading-relaxed text-foreground/65">
          {t("heroDesc", { count: experimentCount })}
        </p>
        <div className="flex flex-wrap items-center gap-3 pt-2">
          <Link
            href="/experiments"
            className="rounded-full bg-gradient-to-r from-brand-500 to-brand-600 px-6 py-3 text-sm font-medium text-white shadow-glow transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            {t("ctaCatalog")}
          </Link>
          <Link
            href="/sessions"
            className="rounded-full border border-foreground/15 bg-surface/60 px-6 py-3 text-sm font-medium backdrop-blur transition-colors hover:border-brand-400/50 active:scale-[0.98]"
          >
            {t("ctaSessions")}
          </Link>
        </div>
      </section>

      {/* 编号式工作流：左对齐、可变高度，避免通用三等分卡片 */}
      <section className="mt-24 flex flex-col gap-px overflow-hidden rounded-2xl border border-foreground/10 bg-foreground/[0.06]">
        {features(t).map((f, i) => (
          <div
            key={f.title}
            className="group flex items-start gap-5 bg-surface/70 p-6 backdrop-blur transition-colors hover:bg-brand-500/[0.04] sm:p-8"
          >
            <span className="mt-1 font-mono text-sm tabular-nums text-brand-500/70">
              0{i + 1}
            </span>
            <div className="flex flex-1 flex-col gap-1">
              <h3 className="text-lg font-semibold">{f.title}</h3>
              <p className="max-w-xl text-sm leading-relaxed text-foreground/60">
                {f.desc}
              </p>
            </div>
            <span className="text-2xl opacity-80 transition-transform group-hover:scale-110">
              {f.icon}
            </span>
          </div>
        ))}
      </section>
    </main>
  );
}

// 取词条需要请求上下文，故不能再是模块级常量
function features(t: (k: string) => string) {
  return [
    { icon: "🧪", title: t("labTitle"), desc: t("labDesc") },
    { icon: "🤖", title: t("tutorTitle"), desc: t("tutorDesc") },
    { icon: "📊", title: t("reportTitle"), desc: t("reportDesc") },
  ];
}
