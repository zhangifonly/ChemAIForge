import Link from "next/link";

// 首页：左对齐 Hero + 编号式工作流（替代通用三等分卡片），单一品牌青色调
export default function HomePage() {
  return (
    <main id="main" className="relative z-10 mx-auto max-w-5xl px-6 py-20 sm:py-28">
      <section className="flex max-w-3xl flex-col gap-6 animate-fade-up">
        <span className="inline-flex w-fit items-center gap-2 rounded-full border border-brand-400/30 bg-brand-500/10 px-4 py-1.5 text-xs font-medium text-brand-700 dark:text-brand-300">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-brand-500" />
          AI 驱动的虚拟化学实验室
        </span>
        <h1 className="text-5xl font-bold leading-[1.05] sm:text-7xl">
          在浏览器里
          <br />
          <span className="bg-gradient-to-r from-brand-500 to-brand-700 bg-clip-text text-transparent dark:from-brand-300 dark:to-brand-500">
            做真实的化学实验
          </span>
        </h1>
        <p className="max-w-xl text-lg leading-relaxed text-foreground/65">
          拖拽试剂、观察变色与气泡、随时向 AI 导师提问，
          实验结束自动生成结构化报告。102 个经过验证的实验，安全可重复。
        </p>
        <div className="flex flex-wrap items-center gap-3 pt-2">
          <Link
            href="/experiments"
            className="rounded-full bg-gradient-to-r from-brand-500 to-brand-600 px-6 py-3 text-sm font-medium text-white shadow-glow transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            浏览实验库 →
          </Link>
          <Link
            href="/sessions"
            className="rounded-full border border-foreground/15 bg-surface/60 px-6 py-3 text-sm font-medium backdrop-blur transition-colors hover:border-brand-400/50 active:scale-[0.98]"
          >
            我的会话
          </Link>
        </div>
      </section>

      {/* 编号式工作流：左对齐、可变高度，避免通用三等分卡片 */}
      <section className="mt-24 flex flex-col gap-px overflow-hidden rounded-2xl border border-foreground/10 bg-foreground/[0.06]">
        {FEATURES.map((f, i) => (
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

const FEATURES = [
  {
    icon: "🧪",
    title: "交互式实验台",
    desc: "把试剂拖进烧杯，反应引擎实时判定变色、气泡、沉淀与温度变化，所见即所得。",
  },
  {
    icon: "🤖",
    title: "AI 实验导师",
    desc: "随时提问原理与操作，画布触发关键反应时导师还会主动给出讲解与安全提示。",
  },
  {
    icon: "📊",
    title: "智能实验报告",
    desc: "汇总整场实验的读数曲线，自动生成结论、误差分析、改进建议与知识点评估。",
  },
];
