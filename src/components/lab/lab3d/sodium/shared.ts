// 钠与水场景内各组件共享的尺寸与运动状态。
// 运动状态放在一个可变对象里（不进 React state）：钠球每帧移动，
// 水面涟漪、酚酞红迹、雾气发射都要读同一个位置，走 state 会每帧整树重渲染。

/** 结晶皿内半径、高度与水面高度（场景单位，1 单位 ≈ 4 cm） */
export const DISH = { r: 1.15, h: 0.95, wall: 0.035, water: 0.6 };
/** 真实 cm → 场景单位；钠球另放大 MAG 倍，否则 0.05 g 的钠只有 2 mm 看不清 */
export const CM = 0.25;
export const MAG = 1.8;

export interface BallMotion {
  x: number;
  z: number;
  vx: number;
  vz: number;
  heading: number;
  /** 入水溅起的冲击，0..1，随时间衰减，驱动一圈大涟漪 */
  splash: number;
  /** 当前可见半径（场景单位） */
  r: number;
  /** 是否在水面上反应（决定涟漪、红迹是否以它为中心） */
  active: boolean;
  /** 反应速率相对强度 0..1 */
  intensity: number;
}

export function newMotion(): BallMotion {
  return { x: 0.15, z: 0.1, vx: 0, vz: 0, heading: Math.random() * Math.PI * 2, splash: 0, r: 0, active: false, intensity: 0 };
}
