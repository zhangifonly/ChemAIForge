"use client";

// 酸式滴定管（精细几何）：管身 + 刻度环 + 玻璃活塞旋塞 + 尖嘴。
// 关键交互：活塞可拖拽旋转，旋转角决定滴速（0=关闭）。液面随剩余体积下降。
// 坐标：本组件以 y=0 为管身底端（旋塞位置），向上为管身。
import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { Group } from "three";
import { MathUtils } from "three";
import { TITRATION } from "./model";

export const BURETTE_R = 0.11; // 管内半径
export const BURETTE_H = 3.4; // 刻度段高度（对应 0~50 mL）
export const BURETTE_TIP_Y = -0.62; // 尖嘴出液口（相对本组件原点）

// 与锥形瓶同口径的玻璃参数：压低 transmission 保住细管轮廓
const glassMat = (
  <meshPhysicalMaterial
    color="#e8f3fb"
    transparent
    opacity={0.4}
    roughness={0.06}
    metalness={0.02}
    transmission={0.45}
    thickness={0.5}
    ior={1.47}
    clearcoat={1}
    clearcoatRoughness={0.05}
    side={2}
    depthWrite={false}
  />
);

/** 管身内的盐酸标准液：液面随已放出体积下降（滴定管刻度自上而下） */
function TitrantColumn({ deliveredMl }: { deliveredMl: number }) {
  const frac = Math.min(1, Math.max(0, deliveredMl / TITRATION.buretteCapacityMl));
  const h = BURETTE_H * (1 - frac);
  const r = BURETTE_R * 0.88;
  return (
    <group>
      <mesh position={[0, h / 2, 0]}>
        <cylinderGeometry args={[r, r, h, 32]} />
        {/* 盐酸本身无色，靠淡蓝灰与较高不透明度让液柱和上方空管段有可见分界 */}
        <meshStandardMaterial
          color="#b9d4e8"
          transparent
          opacity={0.85}
          roughness={0.08}
          metalness={0.05}
          emissive="#8fb8d4"
          emissiveIntensity={0.25}
        />
      </mesh>
      {/* 凹液面：微凹的圆盘，读数须视线平齐 */}
      <mesh position={[0, h, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[r, 32]} />
        <meshStandardMaterial color="#c9dcea" transparent opacity={0.9} roughness={0.05} metalness={0.15} />
      </mesh>
    </group>
  );
}

/**
 * 刻度：每 5 mL 一道细整环（主刻度），每 1 mL 一道正面短弧（次刻度）。
 * 次刻度只画正面一段弧，避免密集整环在远景下糊成螺纹状。
 */
function Graduations() {
  const marks = [];
  const per = BURETTE_H / TITRATION.buretteCapacityMl;
  for (let ml = 0; ml <= TITRATION.buretteCapacityMl; ml += 1) {
    const major = ml % 5 === 0;
    // 滴定管 0 刻度在顶部
    const y = BURETTE_H - ml * per;
    marks.push(
      <mesh
        key={ml}
        position={[0, y, 0]}
        rotation={major ? [Math.PI / 2, 0, 0] : [Math.PI / 2, 0, -Math.PI / 2 - 0.35]}
      >
        <torusGeometry
          args={[
            BURETTE_R + 0.003,
            major ? 0.0055 : 0.0035,
            5,
            major ? 28 : 8,
            major ? Math.PI * 2 : 0.7,
          ]}
        />
        <meshStandardMaterial color={major ? "#26303b" : "#5d6a78"} roughness={0.55} />
      </mesh>,
    );
  }
  return <group>{marks}</group>;
}

/**
 * 玻璃旋塞（活塞）：横置圆柱手柄，绕 x 轴旋转。
 * openness 0~1 → 手柄转 0~90°，同时决定滴速（由父组件计算）。
 */
function Stopcock({ openness }: { openness: number }) {
  const knob = useRef<Group>(null);
  useFrame((_, dt) => {
    if (!knob.current) return;
    const target = openness * (Math.PI / 2);
    knob.current.rotation.x = MathUtils.lerp(knob.current.rotation.x, target, Math.min(1, dt * 10));
  });
  return (
    <group position={[0, -0.24, 0]}>
      {/* 旋塞外壳（玻璃套） */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.15, 0.15, 0.34, 24]} />
        {glassMat}
      </mesh>
      {/* 可转动手柄：一侧扁平圆盘便于看出转角 */}
      <group ref={knob}>
        <mesh position={[0, 0, 0.22]} rotation={[Math.PI / 2, 0, 0]} castShadow>
          <cylinderGeometry args={[0.14, 0.14, 0.06, 20]} />
          <meshStandardMaterial color="#3f4a57" roughness={0.45} metalness={0.35} />
        </mesh>
        <mesh position={[0, 0.1, 0.22]} castShadow>
          <boxGeometry args={[0.05, 0.2, 0.05]} />
          <meshStandardMaterial color="#4b586a" roughness={0.5} metalness={0.3} />
        </mesh>
      </group>
    </group>
  );
}

export function Burette({
  deliveredMl,
  openness,
}: {
  deliveredMl: number;
  openness: number;
}) {
  return (
    <group>
      {/* 管身 */}
      <mesh position={[0, BURETTE_H / 2, 0]}>
        <cylinderGeometry args={[BURETTE_R, BURETTE_R, BURETTE_H, 40, 1, true]} />
        {glassMat}
      </mesh>
      {/* 顶口加厚圈 */}
      <mesh position={[0, BURETTE_H, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[BURETTE_R, 0.012, 12, 40]} />
        <meshStandardMaterial color="#e9f3ff" roughness={0.15} metalness={0.2} transparent opacity={0.9} />
      </mesh>
      <Graduations />
      <TitrantColumn deliveredMl={deliveredMl} />
      {/* 旋塞下方的收窄段 */}
      <mesh position={[0, -0.1, 0]}>
        <cylinderGeometry args={[BURETTE_R, 0.06, 0.2, 24, 1, true]} />
        {glassMat}
      </mesh>
      <Stopcock openness={openness} />
      {/* 尖嘴 */}
      <mesh position={[0, -0.5, 0]}>
        <cylinderGeometry args={[0.035, 0.016, 0.28, 20, 1, true]} />
        {glassMat}
      </mesh>
    </group>
  );
}
