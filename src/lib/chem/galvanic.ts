// 原电池 / 电化学腐蚀引擎（纯函数）：依"金属活动性顺序"判定正负极，按电解质
// 酸性 / 中性给出正极析氢或吸氧。与 react()/electrolyze() 解耦——自发放电过程。
//
// 负极（活泼金属）：被氧化、逐渐溶解；正极（较不活泼）：
//   酸性溶液 → 析氢腐蚀（2H⁺+2e⁻→H₂）；中性 / 含氧溶液 → 吸氧腐蚀（O₂+2H₂O+4e⁻→4OH⁻）。

// 金属活动性顺序（越靠前越活泼，rank 越小）
const METAL_RANK: Record<string, number> = {
  K: 0, Ca: 1, Na: 2, Mg: 3, Al: 4, Zn: 5, Fe: 6, Sn: 7, Pb: 8,
  Cu: 10, Hg: 11, Ag: 12, Pt: 13, Au: 14,
};

const METAL_NAME: Record<string, string> = {
  Mg: "镁", Al: "铝", Zn: "锌", Fe: "铁", Sn: "锡", Pb: "铅",
  Cu: "铜", Ag: "银",
};

/** 正极反应类型 */
export type PositiveKind = "hydrogen" | "oxygen";

/** 原电池结果 */
export interface GalvanicResult {
  negative: { metal: string; observation: string };
  positive: { metal: string; kind: PositiveKind; observation: string };
  electronFlow: string;
  current: string;
  /** 是否为吸氧腐蚀（正极生成 OH⁻，可使酚酞变红） */
  oxygenAbsorption: boolean;
}

function name(f: string): string {
  return METAL_NAME[f] ?? f;
}

// 电解质是否酸性（决定正极析氢 / 吸氧）
function isAcidic(electrolyte: { formula: string; name: string }): boolean {
  return /酸/.test(electrolyte.name) || ["H2SO4", "HCl", "HNO3"].includes(electrolyte.formula);
}

/**
 * 构造原电池。metals 给出参与的金属化学式（≥1）：
 * 两种金属 → 活泼者负极、较不活泼者正极；
 * 仅一种金属 → 电化学腐蚀（该金属为负极，碳/杂质为正极）。
 */
export function galvanicCell(
  metals: string[],
  electrolyte: { formula: string; name: string },
): GalvanicResult | null {
  const known = metals.filter((m) => m in METAL_RANK);
  if (known.length === 0) return null;

  const sorted = [...new Set(known)].sort((a, b) => METAL_RANK[a] - METAL_RANK[b]);
  const negMetal = sorted[0];
  const posMetal = sorted[1] ?? "C"; // 单金属腐蚀：正极为碳 / 杂质

  const acidic = isAcidic(electrolyte);
  const kind: PositiveKind = acidic ? "hydrogen" : "oxygen";
  const posLabel = posMetal === "C" ? "碳（杂质）" : name(posMetal);

  return {
    negative: {
      metal: negMetal,
      observation: `${name(negMetal)}作负极，被氧化、逐渐溶解（${name(negMetal)} − 2e⁻ → 离子）`,
    },
    positive: {
      metal: posMetal,
      kind,
      observation: acidic
        ? `${posLabel}作正极，表面产生氢气气泡（析氢腐蚀）`
        : `${posLabel}作正极，溶解氧被还原（吸氧腐蚀，生成 OH⁻）`,
    },
    electronFlow: `电子由负极 ${name(negMetal)} 经导线流向正极 ${posLabel}`,
    current: "电流方向与电子流向相反（正极 → 负极）",
    oxygenAbsorption: !acidic,
  };
}

/** 该化学式是否为本引擎已知的金属 */
export function isGalvanicMetal(formula: string): boolean {
  return formula in METAL_RANK;
}
