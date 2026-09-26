"use client";

// 操作台：把 availableOperations 派生出的动作变成可点按钮，替代原先那排
// 纯装饰的仪器标签。每个动作按下后写进实验记录并采样曲线，
// 于是"实验过程"变成一串真实动作而不是"加两样东西点混合"。
import type { Operation } from "./operations";
import { useTranslations } from "next-intl";

export function OperationBar({
  operations,
  disabled,
  onRun,
  lastOp,
}: {
  operations: Operation[];
  /** 容器为空时不能做操作：搅拌空杯、给空杯加热都不是实验动作 */
  disabled: boolean;
  onRun: (op: Operation) => void;
  /** 上一次执行的操作 id，用于给按钮一个"刚做过"的视觉反馈 */
  lastOp: string | null;
}) {
  const t = useTranslations("deck");
  // 只在展示层翻译。op.label 本身保持中文：它被写进 trace 的 mark 与会话记录，
  // dataStats 靠 mark === "读数" 分组 —— 换成译文，外语界面下数据表永远是空的
  const tOp = useTranslations("op");
  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-foreground/10 bg-surface/60 p-4 shadow-soft">
      <div className="flex items-baseline justify-between">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground/75">
          <span className="h-4 w-1 rounded-full bg-gradient-to-b from-brand-400 to-brand-600" />
          {t("operations")}
        </h3>
        <span className="text-[11px] text-foreground/65">
          {disabled ? t("needReagent") : t("inOrder")}
        </span>
      </div>
      <div className="flex flex-wrap gap-2">
        {operations.map((op) => (
          <button
            key={op.id}
            type="button"
            disabled={disabled}
            onClick={() => onRun(op)}
            title={tOp(`${op.id}.hint`)}
            className={`flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-medium transition-all active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-35 ${
              lastOp === op.id
                ? "border-brand-400/60 bg-brand-500/12 text-brand-700 dark:text-brand-300"
                : "border-foreground/15 bg-surface/70 text-foreground/75 hover:border-brand-400/50 hover:bg-brand-500/5"
            }`}
          >
            <span aria-hidden>{op.glyph}</span>
            {tOp(`${op.id}.label`)}
            {/* 温度变化直接标在按钮上：学生要能预判这一步会把体系推向哪 */}
            {op.deltaT !== 0 ? (
              <span className="tabular-nums text-foreground/65">
                {op.deltaT > 0 ? "+" : ""}
                {op.deltaT}℃
              </span>
            ) : null}
          </button>
        ))}
      </div>
    </div>
  );
}
