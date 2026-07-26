// 酸碱中和滴定的纯计算模型：滴入体积 → pH → 酚酞粉红深度 → 终点判定与浓度计算。
// 不含任何 React / three 依赖，便于单元测试。体积单位 mL，浓度单位 mol/L。

/** 一滴的体积（标准滴定管约 20 滴/mL） */
export const DROP_ML = 0.05;

/** 实验参数：盐酸为已知标准液，氢氧化钠浓度对学生"未知"（略偏离 0.1，使计算有意义） */
export const TITRATION = {
  analyteVolumeMl: 20.0, // 移液管量取的待测氢氧化钠体积
  analyteConc: 0.1043, // 待测氢氧化钠真实浓度（判分用，界面不显示）
  titrantConc: 0.1, // 盐酸标准液浓度
  buretteCapacityMl: 50.0, // 酸式滴定管容量
} as const;

/** 理论等当点所需盐酸体积（mL） */
export function equivalenceMl(): number {
  const { analyteVolumeMl, analyteConc, titrantConc } = TITRATION;
  return (analyteVolumeMl * analyteConc) / titrantConc;
}

/**
 * 强酸滴定强碱的 pH：按剩余 OH⁻ / 过量 H⁺ 的稀释后浓度计算。
 * 等当点附近用水的自偶电离兜底，避免 log(0) 发散，并夹在 [0.5, 13.5]。
 */
export function phAt(deliveredMl: number): number {
  const { analyteVolumeMl, analyteConc, titrantConc } = TITRATION;
  const v = analyteVolumeMl + Math.max(0, deliveredMl);
  const nBase = (analyteVolumeMl * analyteConc) / 1000;
  const nAcid = (Math.max(0, deliveredMl) * titrantConc) / 1000;
  const diff = (nBase - nAcid) / (v / 1000); // >0 余碱，<0 余酸
  const KW_SQRT = 1e-7;
  let ph: number;
  if (diff > KW_SQRT) ph = 14 + Math.log10(diff);
  else if (diff < -KW_SQRT) ph = -Math.log10(-diff);
  else ph = 7;
  return Math.min(13.5, Math.max(0.5, ph));
}

/**
 * 酚酞粉红深度 0~1：pH ≥ 10 满色，≤ 8.2 无色，区间内用 smoothstep 平滑过渡。
 * 这是"终点凭肉眼判断"的依据——低于 0.04 视为已褪色。
 */
export function phenolphthaleinPink(ph: number): number {
  const t = (ph - 8.2) / (10 - 8.2);
  const c = Math.min(1, Math.max(0, t));
  return c * c * (3 - 2 * c);
}

/** 视觉上已判定为"褪色"的阈值 */
export const FADED_THRESHOLD = 0.04;

/** 由学生读到的终点体积反算待测碱浓度（mol/L） */
export function calcAnalyteConc(endpointMl: number): number {
  const { analyteVolumeMl, titrantConc } = TITRATION;
  return (endpointMl * titrantConc) / analyteVolumeMl;
}

/** 相对误差（%），正值为测偏高 */
export function relativeErrorPct(endpointMl: number): number {
  const measured = calcAnalyteConc(endpointMl);
  return ((measured - TITRATION.analyteConc) / TITRATION.analyteConc) * 100;
}

export type Verdict = "before" | "good" | "over";

/** 合格终点允许的相对误差（%）——对应约 ±0.1 mL、即两滴以内 */
export const TOLERANCE_PCT = 0.5;

/**
 * 终点评判：仍显粉红为 before；褪色后按体积相对误差判合格与过量。
 * 不用 pH 作判据——强酸强碱突跃太陡，过量一滴 pH 就掉到约 3.9，
 * 而定量分析真正的合格标准是终点体积误差在两滴以内。
 * 教学意图：酚酞褪色后继续滴"肉眼看不出变化"，误差却在悄悄累积。
 */
export function verdictAt(deliveredMl: number): Verdict {
  const pink = phenolphthaleinPink(phAt(deliveredMl));
  if (pink >= FADED_THRESHOLD) return "before";
  return Math.abs(relativeErrorPct(deliveredMl)) <= TOLERANCE_PCT ? "good" : "over";
}

/** 仅装入 20.00 mL 待测液时的液面高度（3D 场景坐标，瓶底为 0） */
export const FLASK_LIQUID_TOP = 0.2;
/** 锥形瓶瓶口高度，液面不得越过 */
export const FLASK_MOUTH_Y = 1.28;

/**
 * 瓶内液面高度随已放出的盐酸体积上升（真实滴定中液面确实会涨）。
 * 注意：250 mL 锥形瓶里 20 mL 实际只有约 1 cm 高，几乎看不出颜色，
 * 故纵向做了教学性夸张——保证单调递增且不越过瓶口，比例不按真实容积。
 */
export function flaskLevelY(deliveredMl: number): number {
  const v = Math.min(TITRATION.buretteCapacityMl, Math.max(0, deliveredMl));
  return FLASK_LIQUID_TOP + v * 0.006;
}

/** 生成计时的单帧上限（秒）：防止切回标签页时把积压时间一次性倾出一堆液滴 */
export const DROP_GEN_MAX_DT = 0.25;

/**
 * 单帧应生成的液滴数与残余计时。
 * 关键：用真实帧间隔累加，不可复用物理步长的钳制值（0.05s），
 * 否则低帧机器上滴速会被同比例拖慢 —— 等于"电脑越慢滴定越慢"。
 */
export function dropsThisFrame(
  acc: number,
  dt: number,
  ratePerSec: number,
): { count: number; acc: number } {
  if (ratePerSec <= 0) return { count: 0, acc: 0 };
  const next = acc + Math.min(dt, DROP_GEN_MAX_DT) * ratePerSec;
  const count = Math.floor(next);
  return { count, acc: next - count };
}
