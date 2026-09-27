// 化学式解析：把 formula 字符串解析为元素计数，进而算出摩尔质量。
//
// 为什么解析而不是查表：定量实验需要每个物质的摩尔质量，试剂库有 200 多个化学式，
// 手工维护「化学式 → 摩尔质量」表既冗余又必然漏（新增试剂时容易只加规则不加质量，
// 而缺失是静默的 —— 界面上称量框会算出 NaN）。解析器一次写对，此后零维护。
//
// 支持的写法（覆盖试剂库全部 200+ 条）：
//   · 简单式        NaCl / H2SO4 / KMnO4
//   · 圆括号        Ca(OH)2 / Al2(SO4)3 / (NH4)2CO3
//   · 方括号配合物  K3[Fe(CN)6] / K4[Fe(CN)6]
//   · 结晶水 / 加合  NH3·H2O / CuSO4·5H2O（· 与 * 与 . 都接受）
// 不支持、且必须明确失败的：air / catalyst / litmus / phenolphthalein 这类
// 哨兵标签（它们不是化学式）。这些返回 null，由调用方决定如何呈现
// —— 绝不能静默返回 0 或 NaN，否则"石蕊试液 0 g"会当成真实数据流进报告。
import { ATOMIC_MASS } from "./atomicMass";

/** 元素 → 原子个数 */
export type ElementCount = Record<string, number>;

// 解析游标：在 parseGroup 与 parseFormula 间共享位置
interface Cursor {
  s: string;
  i: number;
}

/** 把 b 按 factor 倍累加进 a */
function merge(a: ElementCount, b: ElementCount, factor: number): void {
  for (const [el, n] of Object.entries(b)) {
    a[el] = (a[el] ?? 0) + n * factor;
  }
}

/** 读一个整数系数，缺省为 1 */
function readCount(c: Cursor): number {
  let num = "";
  while (c.i < c.s.length && c.s[c.i] >= "0" && c.s[c.i] <= "9") {
    num += c.s[c.i];
    c.i += 1;
  }
  return num === "" ? 1 : parseInt(num, 10);
}

/**
 * 解析一段（到字符串末尾或遇到未匹配的右括号为止）。
 * 抛错表示这不是合法化学式，由 parseFormula 统一转成 null。
 */
function parseGroup(c: Cursor): ElementCount {
  const out: ElementCount = {};
  while (c.i < c.s.length) {
    const ch = c.s[c.i];
    if (ch === ")" || ch === "]") break;
    if (ch === "(" || ch === "[") {
      c.i += 1;
      const inner = parseGroup(c);
      const close = c.s[c.i];
      if (close !== ")" && close !== "]") throw new Error("括号未闭合");
      c.i += 1;
      merge(out, inner, readCount(c));
      continue;
    }
    // 元素符号：一个大写字母 + 若干小写字母
    if (ch < "A" || ch > "Z") throw new Error(`非法字符 ${ch}`);
    let el = ch;
    c.i += 1;
    while (c.i < c.s.length && c.s[c.i] >= "a" && c.s[c.i] <= "z") {
      el += c.s[c.i];
      c.i += 1;
    }
    if (!(el in ATOMIC_MASS)) throw new Error(`未知元素 ${el}`);
    out[el] = (out[el] ?? 0) + readCount(c);
  }
  return out;
}

/**
 * 解析化学式为元素计数；不是合法化学式（哨兵标签、含未知元素）时返回 null。
 * 结晶水/加合物按 · 分段，各段前可带整数系数（5H2O 表示 5 份 H2O）。
 */
export function parseFormula(formula: string): ElementCount | null {
  const parts = formula.split(/[·*.]/).filter((p) => p !== "");
  if (parts.length === 0) return null;
  const total: ElementCount = {};
  try {
    for (const part of parts) {
      const c: Cursor = { s: part, i: 0 };
      const factor = readCount(c); // 段首系数，如 5H2O 的 5
      const seg = parseGroup(c);
      if (c.i !== part.length) throw new Error("解析未到末尾");
      if (Object.keys(seg).length === 0) throw new Error("空段");
      merge(total, seg, factor);
    }
  } catch {
    return null;
  }
  return total;
}

/**
 * 摩尔质量（g/mol），保留 3 位小数；无法解析时返回 null。
 * 调用方遇到 null 应当隐去质量相关的输入（如称量框），而不是显示 0。
 */
export function molarMass(formula: string): number | null {
  const counts = parseFormula(formula);
  if (!counts) return null;
  let m = 0;
  for (const [el, n] of Object.entries(counts)) m += ATOMIC_MASS[el] * n;
  return Math.round(m * 1000) / 1000;
}
