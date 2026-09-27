// 过程曲线上的动作标记：存储用中文，显示时换成当前语言。
//
// 标记必须以中文存储：dataStats 靠 mark === "读数" 把读数分组，
// 会话记录也按它区分主动读数与混合快照（见 lib/quantitative 的 READ_MARK）。
// 把存储改成译文，外语界面下数据表会一直是空的。故只在渲染时翻译。
//
// 单独成 .ts：本项目的 vitest 没配 JSX 转换，放进组件就测不到。

/** 操作名（中文）→ 操作 id，与 operations.ts 的 BASE 表一致 */
const OP_ID: Record<string, string> = {
  搅拌: "stir",
  振荡: "shake",
  加热: "heat",
  冷却: "cool",
  静置: "settle",
  读数: "read",
};

type T = (key: string, vars?: Record<string, string | number>) => string;

/**
 * 把一个存储态标记翻译成显示文本。
 *
 * @param tOp   op 命名空间的取词函数（取操作名）
 * @param tLab  lab 命名空间的取词函数（取"加 / 移除 / 混合"模板）
 * @param term  中文试剂名 → 译名
 */
export function markLabel(mark: string, tOp: T, tLab: T, term: (zh: string) => string): string {
  if (mark === "混合") return tLab("mixAction");
  const opId = OP_ID[mark];
  if (opId) return tOp(`${opId}.label`);
  if (mark.startsWith("移除")) return tLab("removeReagent", { name: term(mark.slice(2)) });
  // "加" 放在最后判：它只有一个字，前缀匹配最宽，先判会误吞别的标记
  if (mark.startsWith("加")) return tLab("addReagent", { name: term(mark.slice(1)) });
  // 未知标记原样显示：比显示空白更有助于发现漏了哪类
  return mark;
}
