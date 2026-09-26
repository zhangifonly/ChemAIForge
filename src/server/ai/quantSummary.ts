// 把会话读数折算成定量结论，注入 AI 报告 prompt。
//
// 为什么需要这一层：原先 prompt 只给模型一串 pH/温度和「最低/最高」区间，
// 模型只能写出「读数存在一定波动」这类定性套话。而学生在实验台上看到的是
// 一张明确写着「本组平均 25.0℃、相对偏差 0.40%、数据一致性良好」的表 ——
// 报告若绕过这些数字重新定性描述一遍，等于把已经算出的结论丢掉。
//
// 统计本身在 @/lib/quantitative（实验台数据表、报告页摘要、这里三处共用），
// 本文件只负责把统计结果写成模型读得懂的中文段落。
import {
  readingGroups,
  statsOf,
  type Consistency,
} from "@/lib/quantitative";
import type { SessionMeasurement } from "@/server/session/types";

export { readingGroups, statsOf };

/** 评语与实验台数据表的三档文案同源，避免界面与报告口径不一 */
const VERDICT: Record<Consistency, string> = {
  good: "数据一致性良好，可用于计算",
  fair: "偏差偏大，需检查读数视线与体系是否稳定",
  poor: "偏差过大，应查明原因后重做平行测定，不可直接取平均",
};

// 单组的一行描述：平均值 + 相对偏差 + 结论
function describeGroup(
  rows: SessionMeasurement[],
  no: number,
  total: number,
): string {
  const s = statsOf(rows);
  if (!s) return `第 ${no} 组：无有效读数。`;
  // 标出最终一组：体系被改动后，只有最后那组反映学生要下结论的那个状态
  const tag = no === total && total > 1 ? "（最终一组，结论应以此组为准）" : "";
  const parts = [
    `第 ${no} 组${tag}：${s.count} 次读数`,
    `平均 pH=${s.phMean.toFixed(2)}`,
    `平均温度=${s.temperatureMean.toFixed(2)}℃`,
  ];
  if (s.volumeMean !== null) {
    parts.push(`平均体积=${s.volumeMean.toFixed(2)} mL`);
  }
  if (s.worstDeviation === null || s.consistency === null) {
    parts.push("仅 1 次测定，无法计算相对偏差（规范要求平行测定至少 2 次）");
  } else {
    parts.push(`最大相对平均偏差=${s.worstDeviation.toFixed(2)}%`);
    parts.push(VERDICT[s.consistency]);
  }
  return `${parts.join("；")}。`;
}

/**
 * 生成注入 prompt 的定量统计段落。
 *
 * 没有「读数」记录时如实说明，而不是拿混合 / 加热的快照凑数：那些点是体系变化过程中的
 * 瞬时值，把它们当平行测定会让模型据此写出错误的误差结论。
 */
export function summarizeQuantitative(
  measurements: SessionMeasurement[],
): string {
  const groups = readingGroups(measurements);
  if (groups.length === 0) {
    return [
      "（学生未使用「读数」操作留下测量记录，无法计算平均值与相对偏差）",
      "误差分析请侧重「应当如何取得可用数据」：定量实验须在同一体系状态下重复读数至少 2 次。",
    ].join("\n");
  }
  return [
    `共 ${groups.length} 组平行测定（体系每次被取用 / 混合 / 加热都开新的一组，跨组读数不可比）。`,
    ...groups.map((rows, i) => describeGroup(rows, i + 1, groups.length)),
    "请在误差分析中直接引用上述平均值与相对偏差，不要另行定性描述「读数有波动」。",
  ].join("\n");
}
