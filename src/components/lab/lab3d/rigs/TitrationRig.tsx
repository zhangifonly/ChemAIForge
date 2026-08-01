"use client";

// 通用滴定装置：复用精细滴定实验里已打磨过的滴定管 / 铁架台 / 液滴组件，
// 让所有"用到滴定管"的实验（双质子滴定、EDTA 硬度、硫氰酸银滴定）都有一致的装置外观。
// 与专用滴定台的区别：这里不做终点判定与定量读数，只呈现装置与滴加动作。
import { Burette, BURETTE_TIP_Y } from "../titration/Burette";
import { Stand } from "../titration/Stand";
import { Drops } from "../titration/Drops";

export interface TitrationRigProps {
  /** 是否正在滴加（旋塞打开） */
  dripping?: boolean;
  /** 滴入液面的高度（锥形瓶内液面 y） */
  landY: number;
  /** 已滴出体积（mL），驱动管内液柱下降 */
  deliveredMl?: number;
}

/** 滴定管在场景中的横向位置：偏离器皿中心，避免管身挡住瓶内现象 */
const BURETTE_X = 0;
/** 滴定管底座（旋塞）所在高度 */
const BURETTE_Y = 2.1;

export function TitrationRig({ dripping = false, landY, deliveredMl = 0 }: TitrationRigProps) {
  const openness = dripping ? 0.6 : 0;
  const tipY = BURETTE_Y + BURETTE_TIP_Y;
  return (
    <group>
      <Stand clampYs={[BURETTE_Y + 0.9, BURETTE_Y + 2.3]} />
      <group position={[BURETTE_X, BURETTE_Y, 0]}>
        <Burette deliveredMl={deliveredMl} openness={openness} />
      </group>
      {/* 液滴：自尖嘴落到瓶内液面 */}
      <Drops rate={dripping ? 2.4 : 0} fromY={tipY} landY={landY} />
    </group>
  );
}
