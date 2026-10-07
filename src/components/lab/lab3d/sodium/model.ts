// 钠与水反应的定量模型：2Na + 2H2O → 2NaOH + H2↑，ΔH ≈ −184 kJ/mol Na。
//
// 动力学用"缩球模型"：熔成小球的钠只在表面反应，单位面积速率恒定，
// 于是半径匀速缩小 dr/dt = −v，反应时长 ∝ 初始半径 ∝ m^(1/3)。
// 课堂上绿豆大的钠游动十几秒消失，v 按这个观察标定。
// 放热使水温升高，表面速率随温度略增（每升 1 ℃ 快 2%）。
//
// 场景与面板只读 readings()，画面里球的大小、气泡多少、酚酞红的深浅都与数字同源。

export const NA_MOLAR = 22.99; // g/mol
const NA_DENSITY = 0.968; // g/cm³
const VM_25C = 24.465; // L/mol，25 ℃、1 atm
const DH_PER_MOL = 184300; // J/mol Na（放热）
export const WATER_ML = 100;
const WATER_CP = 4.184; // J/(g·℃)
const T0 = 25;
const SURFACE_V = 0.0165; // cm/s，25 ℃ 时的半径收缩速度
const SUBSTEP = 0.05; // s

/** 课堂常用的三种块大小（g） */
export const PIECES = { small: 0.05, medium: 0.15, large: 0.4 } as const;
export type PieceSize = keyof typeof PIECES;
/** 超过此质量，放热足以引燃逸出的氢气（教材"不能取大块"的原因） */
export const IGNITE_MASS_G = 0.3;

export interface SodiumState {
  naInitialG: number;
  naRemainingG: number;
  naReactedG: number;
  seconds: number;
}

export function initialState(massG: number): SodiumState {
  return { naInitialG: massG, naRemainingG: massG, naReactedG: 0, seconds: 0 };
}

export function radiusCm(massG: number): number {
  if (massG <= 0) return 0;
  return Math.cbrt((3 * massG) / (4 * Math.PI * NA_DENSITY));
}

function massOfRadius(r: number): number {
  return r <= 0 ? 0 : (4 / 3) * Math.PI * r ** 3 * NA_DENSITY;
}

function waterTemp(reactedG: number): number {
  return T0 + ((reactedG / NA_MOLAR) * DH_PER_MOL) / (WATER_ML * WATER_CP);
}

/** 当前表面收缩速度（cm/s） */
function shrinkSpeed(reactedG: number): number {
  return SURFACE_V * (1 + 0.02 * (waterTemp(reactedG) - T0));
}

/** 推进 dt 秒；大 dt 拆成小步，反应完即停 */
export function advance(s: SodiumState, dt: number): SodiumState {
  let { naRemainingG: rem, naReactedG: done } = s;
  let left = Math.max(0, dt);
  while (left > 0 && rem > 0) {
    const h = Math.min(SUBSTEP, left);
    left -= h;
    const r = radiusCm(rem) - shrinkSpeed(done) * h;
    const next = r <= 0 ? 0 : Math.min(rem, massOfRadius(r));
    done += rem - next;
    rem = next;
  }
  if (rem === 0) done = s.naInitialG; // 消掉浮点累计误差，保证守恒
  return { ...s, naRemainingG: rem, naReactedG: done, seconds: s.seconds + Math.max(0, dt) };
}

/** 某质量的钠从投入到消失的总时长（s） */
export function totalReactionSeconds(massG: number): number {
  let s = initialState(massG);
  while (s.naRemainingG > 0 && s.seconds < 600) s = advance(s, SUBSTEP);
  return s.seconds;
}

export interface SodiumReadings {
  naRemainingG: number;
  h2mL: number;
  ph: number;
  tempC: number;
  /** 当前反应速率（g/s），驱动气泡、嘶嘶声与游动推力 */
  rateGps: number;
  radiusCm: number;
  ignites: boolean;
  done: boolean;
}

export function readings(s: SodiumState): SodiumReadings {
  const n = s.naReactedG / NA_MOLAR;
  const oh = n / (WATER_ML / 1000);
  const ph = n > 0 ? Math.max(7, 14 + Math.log10(oh)) : 7;
  const r = radiusCm(s.naRemainingG);
  const reacting = s.naRemainingG > 0 && s.seconds > 0;
  // 速率 = 球面积 × 收缩速度 × 密度
  const rateGps = reacting ? 4 * Math.PI * r * r * shrinkSpeed(s.naReactedG) * NA_DENSITY : 0;
  return {
    naRemainingG: s.naRemainingG,
    h2mL: (n / 2) * VM_25C * 1000,
    ph,
    tempC: waterTemp(s.naReactedG),
    rateGps,
    radiusCm: r,
    ignites: reacting && s.naInitialG >= IGNITE_MASS_G,
    done: s.naRemainingG === 0 && s.naInitialG > 0,
  };
}

/** 酚酞显色程度 0..1（pKa≈9，按中性水归零） */
export function phenolphthaleinPink(ph: number): number {
  const f = (p: number) => 1 / (1 + 10 ** (9 - p));
  return Math.min(1, Math.max(0, (f(ph) - f(7)) / (1 - f(7))));
}
