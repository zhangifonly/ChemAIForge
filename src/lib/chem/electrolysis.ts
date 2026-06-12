// 电解引擎（纯函数）：依据"离子放电顺序"这一确定规律，给定电解质（与可选活性
// 阳极）推导阴极 / 阳极产物与现象。与 react() 解耦——电解是通电驱动而非混合。
//
// 阴极（还原）放电顺序（仅金属离子析出，其余由水放电出 H2）：Ag+ > Cu2+ > H+ …
// 阳极（氧化，惰性电极）放电顺序：S2- > I- > Br- > Cl- > 含氧酸根/OH-(水放 O2)
// 活性阳极（如铜）：电极本身溶解（用于电镀 / 精炼）。

/** 阴极产物 */
interface CathodeOut {
  product: string;
  observation: string;
  kind: "metal" | "gas";
}
/** 阳极产物 */
interface AnodeOut {
  product: string;
  observation: string;
  kind: "gas" | "dissolve";
}
/** 电解结果 */
export interface ElectrolysisResult {
  electrolyte: string;
  cathode: CathodeOut;
  anode: AnodeOut;
  overall: string;
  /** 溶液颜色是否变浅（如 Cu2+ 析出） */
  colorFades: boolean;
}

// 电解质 → 阳离子 / 阴离子（仅覆盖常见可电解物质，保证正确性而非穷举）
const ELECTROLYTE_IONS: Record<string, { cation: string; anion: string }> = {
  CuCl2: { cation: "Cu2+", anion: "Cl-" },
  CuSO4: { cation: "Cu2+", anion: "SO4^2-" },
  "Cu(NO3)2": { cation: "Cu2+", anion: "NO3-" },
  AgNO3: { cation: "Ag+", anion: "NO3-" },
  NaCl: { cation: "Na+", anion: "Cl-" },
  KCl: { cation: "K+", anion: "Cl-" },
  Na2SO4: { cation: "Na+", anion: "SO4^2-" },
  NaOH: { cation: "Na+", anion: "OH-" },
  H2SO4: { cation: "H+", anion: "SO4^2-" },
  H2O: { cation: "H+", anion: "OH-" },
};

// 阴极能直接析出金属的阳离子（比 H+ 易放电）；其余阳离子由水放电生成 H2
const CATHODE_METAL: Record<string, string> = {
  "Cu2+": "Cu", // 铜
  "Ag+": "Ag", // 银
};

// 惰性阳极上阴离子放电产物（含氧酸根 / OH- 不放电，由水放电出 O2）
const ANODE_GAS: Record<string, { product: string; observation: string }> = {
  "Cl-": { product: "Cl2", observation: "阳极产生黄绿色刺激性气体（氯气）" },
  "Br-": { product: "Br2", observation: "阳极生成红棕色溴" },
  "I-": { product: "I2", observation: "阳极生成紫黑色碘" },
  "S2-": { product: "S", observation: "阳极析出淡黄色硫" },
};

/** 该化学式是否为本引擎可电解的电解质 */
export function isElectrolyte(formula: string): boolean {
  return formula in ELECTROLYTE_IONS;
}

/** 对给定电解质执行电解（inertAnode=false 表示活性阳极，如铜，会溶解） */
export function electrolyze(
  electrolyte: string,
  opts: { inertAnode?: boolean } = {},
): ElectrolysisResult | null {
  const ions = ELECTROLYTE_IONS[electrolyte];
  if (!ions) return null;
  const inertAnode = opts.inertAnode ?? true;

  // 阴极
  const metal = CATHODE_METAL[ions.cation];
  const cathode: CathodeOut = metal
    ? { product: metal, observation: `阴极析出${metalName(metal)}`, kind: "metal" }
    : { product: "H2", observation: "阴极产生气泡（氢气）", kind: "gas" };

  // 阳极
  let anode: AnodeOut;
  if (!inertAnode) {
    anode = { product: "电极溶解", observation: "活性阳极逐渐溶解进入溶液", kind: "dissolve" };
  } else {
    const gas = ANODE_GAS[ions.anion];
    anode = gas
      ? { product: gas.product, observation: gas.observation, kind: "gas" }
      : { product: "O2", observation: "阳极产生气泡（氧气）", kind: "gas" };
  }

  // 铜离子析出 → 蓝色变浅；但活性阳极（电镀/精炼）会溶解补充 Cu2+，浓度基本不变
  const colorFades = ions.cation === "Cu2+" && inertAnode;
  return {
    electrolyte,
    cathode,
    anode,
    overall: buildOverall(electrolyte, cathode, anode),
    colorFades,
  };
}

function metalName(f: string): string {
  return f === "Cu" ? "红色的铜" : f === "Ag" ? "银白色的银" : f;
}

function buildOverall(e: string, c: CathodeOut, a: AnodeOut): string {
  return `电解 ${e}：阴极 ${c.product}，阳极 ${a.product}`;
}
