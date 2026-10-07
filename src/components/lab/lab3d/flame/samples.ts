// 点滴板上的样品：每孔一种金属盐溶液（含哪些元素、溶液本身的颜色）。
// 未知样品每次重置随机抽一种，要求学生只凭焰色（必要时借助钴玻璃）判断。
import type { Element } from "./model";

export type Sample = "NaCl" | "KCl" | "LiCl" | "CaCl2" | "SrCl2" | "BaCl2" | "CuCl2" | "unknown";
export const KNOWN: readonly Exclude<Sample, "unknown">[] = ["NaCl", "KCl", "LiCl", "CaCl2", "SrCl2", "BaCl2", "CuCl2"];
export const SAMPLES: readonly Sample[] = [...KNOWN, "unknown"];

export const SAMPLE_ELEMENTS: Record<Exclude<Sample, "unknown">, Element[]> = {
  NaCl: ["Na"],
  KCl: ["K"],
  LiCl: ["Li"],
  CaCl2: ["Ca"],
  SrCl2: ["Sr"],
  BaCl2: ["Ba"],
  CuCl2: ["Cu"],
};

/** 化学式的上下标显示形式 */
export const FORMULA: Record<Sample, string> = {
  NaCl: "NaCl",
  KCl: "KCl",
  LiCl: "LiCl",
  CaCl2: "CaCl₂",
  SrCl2: "SrCl₂",
  BaCl2: "BaCl₂",
  CuCl2: "CuCl₂",
  unknown: "X",
};

/** 溶液颜色：只有氯化铜是蓝绿色，其余无色 —— 光看溶液分不出，必须靠焰色 */
export const SOLUTION_COLOR: Record<Sample, string> = {
  NaCl: "#e8f0f4",
  KCl: "#e8f0f4",
  LiCl: "#e8f0f4",
  CaCl2: "#e8f0f4",
  SrCl2: "#e8f0f4",
  BaCl2: "#e8f0f4",
  CuCl2: "#5fc4b3",
  unknown: "#e8f0f4",
};

/** 未知样品的候选：单一元素，或"钠里混了钾"这种必须用钴玻璃才能识破的情形 */
export const UNKNOWN_POOL: readonly Element[][] = [["K"], ["Li"], ["Sr"], ["Ca"], ["Na", "K"], ["Ba"]];

export function pickUnknown(rand = Math.random): Element[] {
  return UNKNOWN_POOL[Math.floor(rand() * UNKNOWN_POOL.length)];
}

export function elementsOf(s: Sample, unknown: Element[]): Element[] {
  return s === "unknown" ? unknown : SAMPLE_ELEMENTS[s];
}
