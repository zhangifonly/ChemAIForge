// 试剂架条目的构造：中文标签 → 规格（浓度 / 密度 / 摩尔质量）+ 类别配色。
//
// 单独成文件是为了让 2D 与 3D 两个视图共用：3D 原先自带一排纯文字按钮，
// 点一下按默认量整瓶倒入，没有取用量也没有瓶签规格 —— 同一个实验切到 3D，
// 定量入口就消失了，数据表里的体积与物质的量也跟着失真。
import type { SubstanceCategory } from "@/lib/chem/engine";
import { reagentSpec } from "@/lib/chem/reagentSpec";
import { resolveSubstance } from "./reagents";
import type { ShelfEntry } from "./ReagentShelf";

// 试剂瓶液体配色：按物质类别给出直观的色彩提示（仅用于界面，与反应无关）
export const CATEGORY_COLOR: Record<SubstanceCategory, string> = {
  acid: "#f29393",
  base: "#94b8f0",
  salt: "#c4d2e0",
  carbonate: "#dcd4c2",
  metal: "#b6bec9",
  oxide: "#e0ad7e",
  gas: "#d2e7ec",
  water: "#a9d8f5",
  indicator: "#e29bdb",
  oxidizer: "#f1c25e",
  reducer: "#a3d9aa",
  organic: "#cadc97",
  other: "#d3dae1",
};

/**
 * 由实验配置的试剂清单构造试剂架条目。
 *
 * terms 是当前语言的术语表（中文名 → 译名）。label 仍保留中文原名：
 * 它是 resolveSubstance 的匹配键，也是取用时回传给 store 的标识，改了引擎就认不出。
 * 学生看到的名字走 displayName。
 */
export function shelfEntries(
  reagents: string[],
  terms: Record<string, string> | null = null,
): ShelfEntry[] {
  return reagents.map((label) => {
    const sub = resolveSubstance(label);
    return {
      label,
      displayName: terms?.[label] ?? label,
      formula: sub.formula,
      spec: reagentSpec(sub.formula, sub.category),
      color: CATEGORY_COLOR[sub.category],
    };
  });
}
