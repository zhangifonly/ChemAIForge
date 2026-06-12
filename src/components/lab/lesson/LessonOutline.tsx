// 实验讲解大纲（借鉴 mathviz NarrationOutline）：把自动生成的分步讲解以时间轴
// 形式静态呈现，作为进入实验室前的"预习路线图"。纯展示，可在服务端渲染。
import type { LessonStep, LessonPhase } from "./types";

const PHASE_STYLE: Record<LessonPhase, string> = {
  原理: "bg-brand-500/12 text-brand-600 dark:text-brand-300 ring-brand-500/30",
  准备: "bg-sky-500/12 text-sky-600 dark:text-sky-300 ring-sky-500/30",
  操作: "bg-amber-500/12 text-amber-600 dark:text-amber-300 ring-amber-500/30",
  现象: "bg-violet-500/12 text-violet-600 dark:text-violet-300 ring-violet-500/30",
  结论: "bg-emerald-500/12 text-emerald-600 dark:text-emerald-300 ring-emerald-500/30",
};

export function LessonOutline({ steps }: { steps: LessonStep[] }) {
  if (steps.length === 0) return null;
  return (
    <section className="flex flex-col gap-2 rounded-2xl border border-foreground/10 bg-surface/50 p-5 backdrop-blur">
      <h2 className="flex items-center gap-2 text-lg font-semibold">
        <span className="h-4 w-1 rounded-full bg-gradient-to-b from-brand-400 to-brand-600" />
        实验讲解大纲
      </h2>
      <p className="mb-1 text-xs text-foreground/50">
        进入实验台后可点「实验讲解 ▶」逐步自动演示。
      </p>
      <ol className="flex flex-col">
        {steps.map((s, i) => (
          <li key={s.id} className="flex gap-3">
            {/* 时间轴：圆点 + 连线 */}
            <div className="flex flex-col items-center">
              <span className="mt-1 h-2.5 w-2.5 flex-shrink-0 rounded-full bg-gradient-to-br from-brand-400 to-brand-600 ring-2 ring-surface" />
              {i < steps.length - 1 && (
                <span className="w-px flex-1 bg-foreground/12" />
              )}
            </div>
            {/* 步骤内容 */}
            <div className="flex-1 pb-4">
              <div className="flex items-center gap-2">
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ring-1 ${PHASE_STYLE[s.phase]}`}
                >
                  {s.phase}
                </span>
                <span className="text-sm font-medium">{s.title}</span>
              </div>
              <p className="mt-1 text-sm leading-relaxed text-foreground/70">
                {s.narration}
              </p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
