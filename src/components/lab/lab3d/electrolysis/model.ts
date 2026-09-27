// 电解硫酸铜的定量模型（纯函数）。
//
// 3D 画面、仪表读数、会话记录、AI 报告全部从这里取数 —— 画面与数字同源，
// 不允许任何一处自行估算。设计依据见 docs/electrolysis-lab-vision.md。

/** 法拉第常数 C/mol */
export const FARADAY = 96485;
/** 铜的摩尔质量 g/mol */
export const M_CU = 63.546;
/** 标准状况气体摩尔体积 L/mol */
export const MOLAR_VOLUME_STP = 22.414;

/** 实验初始条件：课堂常用 0.50 mol/L CuSO₄ 100 mL（与 reagentSpec 默认一致） */
export const INITIAL = {
  concentration: 0.5, // mol/L
  volumeL: 0.1,
} as const;

/** 可调电流范围 A */
export const CURRENT_RANGE = { min: 0.2, max: 2.0, step: 0.1 } as const;

export type AnodeMaterial = "graphite" | "copper";

export interface ElectrolysisState {
  /** 累计通过的电量 C */
  chargeC: number;
  /** 累计通电时长（真实秒数，不是压缩后的动画时间） */
  seconds: number;
}

export interface ElectrolysisReadings {
  /** 阴极析出铜 g */
  copperDepositedG: number;
  /** 阳极放出氧气 mL（STP）；铜阳极为 0 */
  oxygenMl: number;
  /** 阳极溶解的铜 g；石墨阳极为 0 */
  anodeDissolvedG: number;
  /** 溶液中 Cu²⁺ 浓度 mol/L */
  cuConcentration: number;
  /** 溶液中新生成的 H⁺ 浓度 mol/L（石墨阳极时逐渐变酸） */
  hPlusConcentration: number;
  /** 溶液 pH（只计生成的 H⁺，初始按中性近似；CuSO₄ 本身水解弱酸性另计在 BASE_PH） */
  ph: number;
}

/** CuSO₄ 溶液因 Cu²⁺ 水解略显酸性，0.5 M 实测 pH ≈ 3.8 */
const BASE_PH = 3.8;

/** 电量 → 转移电子的物质的量 mol */
export function electronsMol(chargeC: number): number {
  return chargeC / FARADAY;
}

/**
 * 由累计电量算出全部读数。
 *
 * 阴极：Cu²⁺ + 2e⁻ → Cu，每 2 mol 电子析出 1 mol 铜。
 * 阳极（石墨）：2H₂O − 4e⁻ → O₂↑ + 4H⁺，每 4 mol 电子放 1 mol O₂、生成 4 mol H⁺。
 * 阳极（铜）：Cu − 2e⁻ → Cu²⁺，溶解的铜与析出的铜等量，溶液 Cu²⁺ 浓度不变。
 *
 * 铜离子耗尽后阴极转为析氢，本实验台在耗尽前停止（见 isDepleted），不模拟那一段。
 */
export function readings(state: ElectrolysisState, anode: AnodeMaterial): ElectrolysisReadings {
  const ne = electronsMol(state.chargeC);
  const n0 = INITIAL.concentration * INITIAL.volumeL;
  // 析出量不能超过溶液里原有的铜（石墨阳极时）
  const nCu = anode === "graphite" ? Math.min(ne / 2, n0) : ne / 2;
  const copperDepositedG = nCu * M_CU;

  if (anode === "copper") {
    return {
      copperDepositedG,
      oxygenMl: 0,
      anodeDissolvedG: copperDepositedG,
      cuConcentration: INITIAL.concentration,
      hPlusConcentration: 0,
      ph: BASE_PH,
    };
  }

  const nO2 = ne / 4;
  const nH = ne; // 4e⁻ ↔ 4H⁺
  const cu = Math.max(0, n0 - nCu) / INITIAL.volumeL;
  const h = nH / INITIAL.volumeL;
  // 生成的 H⁺ 与水解产生的弱酸性叠加；两者取更酸的一方即可，误差对教学无影响
  const ph = h > 0 ? Math.min(BASE_PH, -Math.log10(h)) : BASE_PH;
  return {
    copperDepositedG,
    oxygenMl: nO2 * MOLAR_VOLUME_STP * 1000,
    anodeDissolvedG: 0,
    cuConcentration: cu,
    hPlusConcentration: h,
    ph,
  };
}

/** 通电 dt 秒（真实时间）后的新状态 */
export function advance(state: ElectrolysisState, currentA: number, dtSeconds: number): ElectrolysisState {
  return { chargeC: state.chargeC + currentA * dtSeconds, seconds: state.seconds + dtSeconds };
}

/** 石墨阳极下铜离子是否已降到停止阈值（0.02 M 以下阴极开始析氢） */
export function isDepleted(state: ElectrolysisState, anode: AnodeMaterial): boolean {
  return anode === "graphite" && readings(state, anode).cuConcentration < 0.02;
}

/**
 * 溶液颜色：按 Beer–Lambert 透射率而非线性插值。
 *
 * 可见光区有效摩尔吸光系数约 1.2 L/(mol·cm)（810 nm 峰值约 12，可见光平均约其 1/10），
 * 烧杯横向光程约 4 cm。算出透射率 T 后在「深蓝」与「清水」之间按 T 混合。
 * 这样 0.5→0.3 M 仍是深蓝，降到 0.1 M 以下才明显变淡 —— 与真实烧杯一致；
 * 线性插值会让 0.3 M 看起来已经很淡，是错的。
 */
export function solutionTransmittance(cuConcentration: number): number {
  const EPS_VIS = 1.2;
  const PATH_CM = 4;
  return Math.pow(10, -EPS_VIS * Math.max(0, cuConcentration) * PATH_CM);
}

/** 由透射率得到溶液颜色（十六进制） */
export function solutionColor(cuConcentration: number): string {
  const T = solutionTransmittance(cuConcentration);
  // 深蓝（0.5 M 观感）与近乎无色的清水之间混合
  const deep = [18, 92, 196];
  const clear = [214, 234, 244];
  const mix = deep.map((d, i) => Math.round(d + (clear[i] - d) * T));
  return `#${mix.map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

/**
 * 阴极铜层厚度 μm：析出质量 / (密度 × 浸没面积)。
 * 浸没面积取 2 cm × 3 cm 双面 = 12 cm²，铜密度 8.96 g/cm³。
 * 画面上用它决定铜层的颜色覆盖度与凸起厚度。
 */
export function copperLayerMicrons(copperG: number): number {
  const AREA_CM2 = 12;
  const RHO = 8.96;
  return (copperG / RHO / AREA_CM2) * 1e4;
}

/**
 * 模拟称量：理论析出量乘以电流效率，再叠加天平误差（±0.2 mg）。
 * 电流效率取 97%–99.5%：真实实验中少量副反应与铜粉脱落使实测略低于理论。
 * seed 固定则结果固定 —— 同一次实验反复称量读数一致。
 */
export function weighCathode(theoreticalG: number, seed: number): { measuredG: number; efficiency: number } {
  const r = mulberry32(seed);
  const efficiency = 0.97 + r() * 0.025;
  const noise = (r() - 0.5) * 0.0004;
  const measuredG = Math.max(0, theoreticalG * efficiency + noise);
  return { measuredG, efficiency: theoreticalG > 0 ? measuredG / theoreticalG : 0 };
}

/** 确定性伪随机数，用于称量误差可复现 */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 时间倍率档位：真实 1 A 下降到明显变淡要两个多小时，课堂上必须压缩 */
export const TIME_SCALES = [1, 30, 120, 600] as const;
