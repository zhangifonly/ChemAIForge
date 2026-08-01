// 产物液色解析（纯函数）。
//
// 反应引擎的通用规则常返回占位化学式（金属氧化物 + 酸 → "salt"，卤素置换 → "X2"，
// 锌置换 → "Zn-salt"），这些查不到色表，导致"氧化铜溶于硫酸"这类经典变色实验
// 在 3D 里看不出任何变化。这里按"反应物里有哪个有色阳离子"反推产物溶液色——
// 观察者看到的正是这个离子的颜色（Cu²⁺ 蓝、Fe³⁺ 黄棕、Ni²⁺ 绿……）。
import type { Substance } from "./engine";
import { SOLUTION_TINT, type SolutionTint } from "./appearance";

/** 有色阳离子的溶液色：按元素符号匹配反应物，不要求精确化学式 */
const CATION_TINT: Array<{ test: RegExp; tint: SolutionTint; note: string }> = [
  { test: /^Cu(?!$)|^CuO$|^Cu\(|^Cu2O$/, tint: { top: "#7cc0ea", bottom: "#2f7fc7" }, note: "Cu²⁺ 蓝" },
  { test: /^Fe2O3$|^Fe\(OH\)3$|^FeCl3$|^Fe\(NO3\)3$|^Fe2\(SO4\)3$/, tint: { top: "#e0b56a", bottom: "#b9772c" }, note: "Fe³⁺ 黄棕" },
  { test: /^FeO$|^FeCl2$|^FeSO4$|^Fe\(OH\)2$/, tint: { top: "#bfe0b6", bottom: "#7fbf86" }, note: "Fe²⁺ 浅绿" },
  { test: /^Ni/, tint: { top: "#9fd9a8", bottom: "#4fae5e" }, note: "Ni²⁺ 绿" },
  { test: /^Co/, tint: { top: "#f0a0b8", bottom: "#d95a82" }, note: "Co²⁺ 粉红" },
  { test: /^Cr(?!O3$)/, tint: { top: "#8fd9c8", bottom: "#2f9b86" }, note: "Cr³⁺ 绿" },
  { test: /^Mn(?!O4)/, tint: { top: "#f7dfe8", bottom: "#e8b6c8" }, note: "Mn²⁺ 极浅粉" },
];

/** 卤素置换的产物：由被置换出的卤素决定颜色（溴水橙棕、碘水棕） */
const HALOGEN_OUT: Array<{ test: RegExp; formula: string }> = [
  { test: /I$|I2$|KI|NaI/, formula: "I2" },
  { test: /Br$|Br2$|KBr|NaBr/, formula: "Br2" },
];

/** 引擎返回的占位产物：这些不是真化学式，需按反应物反推 */
const PLACEHOLDER = /^salt$|-salt$|盐$|^X2$|^X$/;

/** 是否为占位产物化学式 */
export function isPlaceholder(formula: string): boolean {
  return PLACEHOLDER.test(formula);
}

/** 按反应物里的有色阳离子推产物溶液色；无有色离子返回 null */
export function cationTint(contents: Substance[]): SolutionTint | null {
  for (const c of contents) {
    const hit = CATION_TINT.find((r) => r.test.test(c.formula));
    if (hit) return hit.tint;
  }
  return null;
}

/** 卤素置换：从反应物里的卤化物推出被置换的卤素单质颜色 */
export function halogenTint(contents: Substance[]): SolutionTint | null {
  for (const r of HALOGEN_OUT) {
    if (contents.some((c) => r.test.test(c.formula))) {
      return SOLUTION_TINT[r.formula] ?? null;
    }
  }
  return null;
}

/**
 * 解析产物液色：先查产物色表，占位产物则按反应物反推。
 * 只在引擎判定"有颜色变化"时调用，避免给无色反应凭空上色。
 */
export function resolveProductTint(
  products: Substance[],
  contents: Substance[],
): SolutionTint | null {
  // 1. 产物本身就是有色物质（配合物 / 有色盐）
  for (const p of products) {
    const t = SOLUTION_TINT[p.formula];
    if (t) return t;
  }
  // 2. 占位产物：卤素置换优先（X2 的颜色由卤素决定，而非阳离子）
  if (products.some((p) => /^X2?$/.test(p.formula))) {
    const h = halogenTint(contents);
    if (h) return h;
  }
  // 3. 其余占位产物按反应物中的有色阳离子反推
  if (products.some((p) => isPlaceholder(p.formula))) {
    return cationTint(contents);
  }
  return null;
}
