"use client";

// 注射器：封入有色平衡气体（NO₂ ⇌ N₂O₄），推拉活塞改变压强。
// 化学看点是"先变深后变浅"——压缩瞬间浓度升高颜色加深，随后平衡右移
// 消耗 NO₂ 使颜色回浅，但仍比压缩前深。这个两段式过程必须在动画上体现出来，
// 否则学生只会记住"压缩变深"这个错误结论。
import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Color, type Group, type Mesh, type MeshStandardMaterial } from "three";

const BARREL_R = 0.19;
const BARREL_H = 1.5;
const BARREL_Y = 0.9;
/** 活塞行程：未压缩时气柱占满，压缩到 0.45 倍 */
const FULL = 1;
const PRESSED = 0.45;

export interface SyringeProps {
  /** 气体颜色，null 表示无色气体（仍画装置） */
  gasColor: string | null;
  /** 是否处于压缩状态 */
  pressed: boolean;
}

export function Syringe({ gasColor, pressed }: SyringeProps) {
  const gasRef = useRef<Mesh>(null);
  const matRef = useRef<MeshStandardMaterial>(null);
  const plungerRef = useRef<Group>(null);
  // 当前气柱长度比例，与目标值之间做插值，得到活塞平滑推进的手感
  const frac = useRef(FULL);
  // 平衡进度：压缩后从 0 → 1，用来把"浓度骤升的深色"回落到"平衡后的中间色"
  const equil = useRef(1);
  const base = useRef(new Color(gasColor ?? "#ffffff"));

  useFrame((_, dt) => {
    const target = pressed ? PRESSED : FULL;
    const k = Math.min(1, dt * 2.6);
    const prev = frac.current;
    frac.current += (target - frac.current) * k;
    // 活塞还在明显移动时，平衡被不断打破；停稳后平衡才逐渐建立
    const moving = Math.abs(target - frac.current) > 0.01;
    equil.current = moving
      ? Math.max(0, equil.current - dt * 2.2)
      : Math.min(1, equil.current + dt * 0.55);
    void prev;

    const f = frac.current;
    const h = BARREL_H * f;
    // 气柱始终顶在筒口（活塞从下方往上推）
    if (gasRef.current) {
      gasRef.current.scale.y = f;
      gasRef.current.position.y = BARREL_Y + BARREL_H / 2 - h / 2;
    }
    if (plungerRef.current) plungerRef.current.position.y = BARREL_Y + BARREL_H / 2 - h;

    if (matRef.current && gasColor) {
      // 浓度 ∝ 1/体积；平衡建立后有效浓度回落约 30%
      const conc = (1 / f) * (1 - 0.3 * equil.current * (1 - f));
      matRef.current.color.copy(base.current);
      matRef.current.opacity = Math.min(0.92, 0.16 + 0.34 * conc);
    }
  });

  return (
    <group position={[0, -0.3, 0]}>
      {/* 筒身：玻璃管 */}
      <mesh position={[0, BARREL_Y, 0]}>
        <cylinderGeometry args={[BARREL_R, BARREL_R, BARREL_H, 40, 1, true]} />
        <meshPhysicalMaterial
          color="#e8f2f7"
          transparent
          opacity={0.24}
          roughness={0.04}
          transmission={0.85}
          thickness={0.12}
          side={2}
        />
      </mesh>
      {/* 气柱 */}
      {gasColor && (
        <mesh ref={gasRef} position={[0, BARREL_Y, 0]}>
          <cylinderGeometry args={[BARREL_R * 0.93, BARREL_R * 0.93, BARREL_H, 36]} />
          <meshStandardMaterial
            ref={matRef}
            color={gasColor}
            transparent
            opacity={0.4}
            roughness={0.5}
            depthWrite={false}
          />
        </mesh>
      )}
      {/* 顶部锥形出口 + 封堵胶帽（密闭体系的前提） */}
      <mesh position={[0, BARREL_Y + BARREL_H / 2 + 0.09, 0]}>
        <cylinderGeometry args={[0.03, BARREL_R * 0.8, 0.18, 24]} />
        <meshStandardMaterial color="#dbe7ee" roughness={0.3} transparent opacity={0.6} />
      </mesh>
      <mesh position={[0, BARREL_Y + BARREL_H / 2 + 0.22, 0]}>
        <cylinderGeometry args={[0.045, 0.045, 0.1, 20]} />
        <meshStandardMaterial color="#c2453a" roughness={0.75} />
      </mesh>
      {/* 活塞 + 推杆 + 拇指托 */}
      <group ref={plungerRef}>
        <mesh>
          <cylinderGeometry args={[BARREL_R * 0.95, BARREL_R * 0.95, 0.09, 32]} />
          <meshStandardMaterial color="#3f4a52" roughness={0.6} />
        </mesh>
        <mesh position={[0, -0.42, 0]}>
          <boxGeometry args={[0.055, 0.84, 0.055]} />
          <meshStandardMaterial color="#8f9aa2" roughness={0.4} />
        </mesh>
        <mesh position={[0, -0.86, 0]}>
          <cylinderGeometry args={[0.17, 0.17, 0.035, 28]} />
          <meshStandardMaterial color="#8f9aa2" roughness={0.4} />
        </mesh>
      </group>
    </group>
  );
}
