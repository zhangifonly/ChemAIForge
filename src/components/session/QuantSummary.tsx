// 报告页的定量数据摘要：把会话读数还原成实验台数据表那张结论表。
//
// 为什么报告页也要摊开这些数字，而不是只放一条折线：折线看趋势，但"这次实验的
// 测量结果是多少、可不可信"是一句要写进报告的结论。学生在实验台上看到过
// "本组平均 25.0℃、相对偏差 0.40%"，报告页若只剩曲线，等于把结论又收回去了。
// 统计走 @/lib/quantitative，与实验台数据表、AI prompt 三处同源。
import { readingGroups, statsOf, type Consistency } from "@/lib/quantitative";
import type { SessionMeasurement } from "@/server/session/types";

/** 三档评语与实验台数据表的文案保持一致 */
const VERDICT: Record<Consistency, { text: string; cls: string }> = {
  good: { text: "数据一致性良好，可用于计算", cls: "text-emerald-600 dark:text-emerald-400" },
  fair: { text: "偏差偏大，检查读数视线与体系是否稳定", cls: "text-amber-600 dark:text-amber-400" },
  poor: { text: "偏差过大，应查明原因后重做平行测定", cls: "text-rose-600 dark:text-rose-400" },
};

export function QuantSummary({
  measurements,
}: {
  measurements: SessionMeasurement[];
}) {
  const groups = readingGroups(measurements);
  if (groups.length === 0) {
    return (
      <p className="text-sm text-foreground/65">
        本次实验没有用「读数」操作留下测量记录，无法计算平均值与相对偏差。
        定量实验需在同一体系状态下重复读数至少 2 次。
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-3">
      {groups.map((rows, i) => (
        <GroupCard
          key={i}
          rows={rows}
          no={i + 1}
          final={i === groups.length - 1 && groups.length > 1}
        />
      ))}
      {groups.length > 1 ? (
        <p className="text-xs text-foreground/65">
          体系每次被取用 / 混合 / 加热都会开新的一组，跨组读数不构成平行测定，因此分别统计。
        </p>
      ) : null}
    </div>
  );
}

// 单组平行测定：平均值三联 + 偏差判定
function GroupCard({
  rows,
  no,
  final,
}: {
  rows: SessionMeasurement[];
  no: number;
  final: boolean;
}) {
  const s = statsOf(rows);
  if (!s) return null;
  const verdict = s.consistency ? VERDICT[s.consistency] : null;
  return (
    <div className="rounded-xl border border-foreground/10 bg-surface/60 p-4">
      <div className="mb-2 flex flex-wrap items-center gap-2 text-xs">
        <span className="font-medium text-foreground/70">第 {no} 组</span>
        <span className="text-foreground/65">{s.count} 次读数</span>
        {final ? (
          <span className="rounded-full bg-brand-500/12 px-2 py-0.5 text-brand-600 dark:text-brand-300">
            结论以此组为准
          </span>
        ) : null}
      </div>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-3">
        <Stat label="平均 pH" value={s.phMean.toFixed(2)} />
        <Stat label="平均温度" value={`${s.temperatureMean.toFixed(2)} ℃`} />
        {s.volumeMean !== null ? (
          <Stat label="平均体积" value={`${s.volumeMean.toFixed(2)} mL`} />
        ) : null}
      </dl>
      <p className="mt-2 text-xs">
        {s.worstDeviation === null || !verdict ? (
          // 单次测定不显示 0%：那不是"完全一致"，是判据不适用
          <span className="text-foreground/65">
            仅 1 次测定，无法计算相对偏差（规范要求平行测定至少 2 次）
          </span>
        ) : (
          <>
            <span className="text-foreground/65">
              最大相对平均偏差 {s.worstDeviation.toFixed(2)}%
            </span>
            <span className={`ms-2 font-medium ${verdict.cls}`}>{verdict.text}</span>
          </>
        )}
      </p>
    </div>
  );
}

// 单个统计量
function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] text-foreground/65">{label}</dt>
      <dd className="font-mono font-medium tabular-nums">{value}</dd>
    </div>
  );
}
