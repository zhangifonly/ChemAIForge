// 电解质导电性引擎（纯函数）：依"强 / 弱 / 非电解质"判定溶液导电能力（灯泡亮度）。
// 强电解质完全电离→离子浓度高→导电强；弱电解质部分电离→导电弱；非电解质不导电。
import type { Substance } from "./engine";

export type IonizationLevel = "strong" | "weak" | "none";

export interface ConductivityResult {
  level: IonizationLevel;
  /** 灯泡亮度 0~1（仅可视化） */
  bulb: number;
  note: string;
}

// 强电解质：强酸 / 强碱 / 可溶性盐（完全电离）
const STRONG_FORMULA = new Set([
  "HCl", "H2SO4", "HNO3", "NaOH", "KOH", "Ba(OH)2", "Ca(OH)2",
]);
// 弱电解质：弱酸 / 弱碱（部分电离）
const WEAK_FORMULA = new Set(["CH3COOH", "NH3·H2O", "H2CO3", "H2SO3", "HF"]);
// 非电解质：不电离
const NONE_NAME = /蔗糖|葡萄糖|乙醇|酒精|纯水|淀粉/;
const NONE_FORMULA = new Set(["C12H22O11", "C2H5OH", "C6H12O6"]);

export function conductivity(s: Substance): ConductivityResult {
  const weak = WEAK_FORMULA.has(s.formula) || /醋酸|乙酸|碳酸|氨水|亚硫酸|氢氟酸/.test(s.name);
  const none = NONE_FORMULA.has(s.formula) || NONE_NAME.test(s.name);
  const strong =
    STRONG_FORMULA.has(s.formula) ||
    s.category === "salt" ||
    s.category === "carbonate";

  // 弱 / 非优先（避免弱酸被归入通用"酸/强"）
  if (none) return { level: "none", bulb: 0, note: `${s.name}是非电解质，不电离、不导电，灯泡不亮。` };
  if (weak) return { level: "weak", bulb: 0.35, note: `${s.name}是弱电解质，部分电离、离子浓度低，导电弱，灯泡微亮。` };
  if (strong) return { level: "strong", bulb: 1, note: `${s.name}是强电解质，完全电离、离子浓度高，导电强，灯泡明亮。` };
  // 兜底：强酸 / 强碱类
  if (s.category === "acid" || s.category === "base")
    return { level: "strong", bulb: 1, note: `${s.name}完全电离，导电能力强，灯泡明亮。` };
  return { level: "none", bulb: 0, note: `${s.name}在此条件下导电性不明显。` };
}
