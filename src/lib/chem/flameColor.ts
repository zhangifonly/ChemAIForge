// 焰色反应特征色（纯数据 + 纯函数）：2D 的 FlameTest 与 3D 的焰色装置共用，
// 避免同一金属离子在两种视图里焰色不一致。
// 匹配用正则而非精确化学式，因为试剂既可能给化学式（NaCl）也可能给中文名（氯化钠）。

export interface FlameColor {
  /** 内焰色（明亮核心） */
  color: string;
  /** 外焰色（较暗外沿） */
  outer: string;
  /** 中文说明 */
  label: string;
}

interface FlameRule extends FlameColor {
  test: RegExp;
}

export const FLAME_RULES: FlameRule[] = [
  { test: /Na|钠/, color: "#ffd24a", outer: "#ffb13c", label: "钠 · 黄色" },
  { test: /^K|钾/, color: "#d08be0", outer: "#a85fd0", label: "钾 · 紫色（透过蓝色钴玻璃）" },
  { test: /Ca|钙/, color: "#ff8a5c", outer: "#e85a2c", label: "钙 · 砖红色" },
  { test: /Cu|铜/, color: "#7fe0a0", outer: "#3fae6e", label: "铜 · 绿色" },
  { test: /Sr|锶/, color: "#ff6a7c", outer: "#e0394c", label: "锶 · 洋红色" },
  { test: /Ba|钡/, color: "#bfe07a", outer: "#9bc04a", label: "钡 · 黄绿色" },
  { test: /Li|锂/, color: "#ff7a8c", outer: "#e0495c", label: "锂 · 紫红色" },
];

/** 未蘸取样品时的酒精灯本色 */
export const DEFAULT_FLAME: FlameColor = {
  color: "#7ec8ff",
  outer: "#4a9be0",
  label: "酒精灯本色（蘸取金属盐后观察）",
};

/** 取焰色：按化学式或中文名匹配，未命中返回酒精灯本色 */
export function flameColor(sample?: string): FlameColor {
  if (!sample) return DEFAULT_FLAME;
  const hit = FLAME_RULES.find((r) => r.test.test(sample));
  return hit ? { color: hit.color, outer: hit.outer, label: hit.label } : DEFAULT_FLAME;
}
