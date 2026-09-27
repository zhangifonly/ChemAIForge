"use client";

// 仪表台：实验操作 + 过程曲线 + 数据记录表，2D 与 3D 两个视图共用。
//
// 原先这些只长在 2D 画布里，3D 视图只有「混合 / 加热 / 清空」几个按钮 ——
// 切到 3D 就没法读数、看不到曲线、数据表也停止记录，同一个实验换个视角
// 就从定量实验退回成"看现象"。抽成共享组件后两个视图的实验过程是同一份。
import { useState } from "react";
import { useTranslations } from "next-intl";
import { totalVolume, useLabStore, type LabReadings } from "./labStore";
import { OperationBar } from "./OperationBar";
import { ProcessChart } from "./ProcessChart";
import { DataTable } from "./DataTable";
import { availableOperations, type Operation } from "./operations";

export function InstrumentDeck({ apparatus }: { apparatus: string[] }) {
  const tOp = useTranslations("op");
  const { contents, readings, trace, record, setTemperature } = useLabStore();
  // 最近一次操作：按钮高亮 + 现象文字，让每一步动作有可见回应
  const [lastOp, setLastOp] = useState<Operation | null>(null);

  // 可用操作由仪器清单派生（玻璃棒→搅拌、酒精灯→加热…）
  const operations = availableOperations(apparatus);

  /**
   * 执行一个操作。改温度的走 setTemperature（它自己会采样并记跨阈值步骤），
   * 不改温度的走 record —— 两条路径都已接入 trace，操作序列因此进得了报告。
   */
  const runOperation = (op: Operation) => {
    setLastOp(op);
    if (op.deltaT !== 0) {
      setTemperature(readings.temperature + op.deltaT);
      record(op.label, { 现象: op.effect, 温度变化: `${op.deltaT} ℃` });
      return;
    }
    record(op.label, { 现象: op.effect }, readings);
  };

  return (
    <div className="flex flex-col gap-4">
      <OperationBar
        operations={operations}
        disabled={contents.length === 0}
        onRun={runOperation}
        lastOp={lastOp?.id ?? null}
      />

      {/* 最近一次操作的现象：动作要有回应，否则点了按钮像什么都没发生 */}
      {lastOp ? (
        <p className="flex gap-2 rounded-lg border border-foreground/12 bg-surface/50 px-4 py-2.5 text-sm text-foreground/70">
          <span aria-hidden>{lastOp.glyph}</span>
          <span>{tOp(`${lastOp.id}.effect`)}</span>
        </p>
      ) : null}

      {/* 宽屏下曲线与数据表并排：曲线看趋势，表格出结论，两者要能对照着看 */}
      <div className="grid gap-4 2xl:grid-cols-2">
        <ProcessChart trace={trace} />
        <DataTable trace={trace} />
      </div>
    </div>
  );
}

/**
 * 台面仪表：pH / 温度 / 液体体积三路读数，叠放在实验台画面一角。
 *
 * 放在台面上而不是画面下方：真实实验里温度计、pH 计就立在器皿旁边，
 * 学生边操作边看表。原先三张卡片排在画面之下，做一步就得把视线挪开再找回来。
 * 体积单独一路：定量实验里"取了多少"与 pH / 温度同等重要。
 */
export function ReadingHud({ className = "" }: { className?: string }) {
  const tDeck = useTranslations("deck");
  const contents = useLabStore((s) => s.contents);
  const readings = useLabStore((s) => s.readings);
  return (
    <div
      className={`pointer-events-none flex max-w-[calc(100%-2rem)] gap-1.5 sm:gap-2 ${className}`}
      aria-label="实验台仪表读数"
    >
      <Meter label="pH" value={readings.ph.toFixed(1)} tone={phTone(readings)} />
      <Meter label={tDeck("temperature")} value={`${readings.temperature} ℃`} />
      <Meter label={tDeck("volume")} value={`${totalVolume(contents).toFixed(1)} mL`} />
    </div>
  );
}

// pH 表头的指示色：酸红、中性绿、碱蓝 —— 与指示剂常识一致，扫一眼就知道酸碱性
function phTone({ ph }: LabReadings): string {
  if (ph < 6.5) return "bg-rose-500";
  if (ph > 7.5) return "bg-sky-500";
  return "bg-emerald-500";
}

// 单个仪表：深色表盘 + 等宽数字，模拟实验室数显仪器的读数窗
function Meter({
  label,
  value,
  tone = "bg-brand-500",
}: {
  label: string;
  value: string;
  tone?: string;
}) {
  return (
    // 窄屏可收缩：亚美尼亚语「Ծավալ」配「0.0 mL」读数时，三块定宽 5.5rem 的仪表在 360px 屏上
    // 放不下，把整页撑出横向滚动；sm 起恢复定宽
    <div className="flex min-w-0 flex-1 flex-col gap-0.5 rounded-lg border border-white/10 bg-slate-900/80 px-2.5 py-1.5 shadow-lg backdrop-blur sm:min-w-[5.5rem] sm:flex-none sm:px-3">
      {/* 不能加 uppercase：pH 的小写 p 表示负对数，写成 PH 是错的 */}
      <span className="flex min-w-0 items-center gap-1.5 truncate text-[11px] tracking-wider text-slate-400 sm:text-[10px]">
        <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${tone}`} />
        {label}
      </span>
      <span className="truncate font-mono text-sm font-semibold tabular-nums text-emerald-300 sm:text-base">
        {value}
      </span>
    </div>
  );
}
