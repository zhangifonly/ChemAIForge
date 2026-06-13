// 实验台模式判定（纯函数）：依仪器与试剂，把实验归入唯一一种操作模式。
// 优先级：导电性 > 电解 > 原电池 > 混合（默认）。供 LabCanvas 分支与测试共用，
// 避免判定逻辑在渲染中内联、难以回归测试。
import type { Substance } from "@/lib/chem/engine";
import {
  isElectrolysisSetup,
  isGalvanicSetup,
  usesConductivity,
} from "./vesselGeom";
import { isElectrolyte } from "@/lib/chem/electrolysis";
import { isGalvanicMetal } from "@/lib/chem/galvanic";

export type LabMode = "conductivity" | "electrolysis" | "galvanic" | "mixing";

export function resolveLabMode(
  apparatus: string[],
  substances: Substance[],
): LabMode {
  if (usesConductivity(apparatus)) return "conductivity";
  if (
    isElectrolysisSetup(apparatus) &&
    substances.some((s) => isElectrolyte(s.formula))
  )
    return "electrolysis";
  if (
    isGalvanicSetup(apparatus) &&
    substances.some((s) => isGalvanicMetal(s.formula))
  )
    return "galvanic";
  return "mixing";
}
