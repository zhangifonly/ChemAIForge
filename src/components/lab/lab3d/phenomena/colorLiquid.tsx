"use client";

// 可渐变色液柱：半球底 + 圆柱 + 液面，颜色在 from→to 间平滑过渡（反应触发）。
// 供变色/褪色/显色类实验复用：高锰酸钾褪色、硫氰合铁显红、铜氨变深蓝等。
// 坐标与 LabPrimitives 的试管对齐（半球底中心 = TUBE_FLOOR + TUBE_R）。
import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import type { MeshStandardMaterial } from "three";
import { Color, MathUtils } from "three";
import { TUBE_R, TUBE_FLOOR } from "../LabPrimitives";

export interface ColorLiquidProps {
  from: string; // 初始颜色
  to: string; // 反应后颜色
  reacted: boolean;
  topY?: number;
  /** 过渡速度（每秒插值比例） */
  rate?: number;
  emissive?: number;
}

export function ColorLiquid({
  from,
  to,
  reacted,
  topY = 1.45,
  rate = 1.6,
  emissive = 0.3,
}: ColorLiquidProps) {
  const bodyMat = useRef<MeshStandardMaterial>(null);
  const ballMat = useRef<MeshStandardMaterial>(null);
  const surfMat = useRef<MeshStandardMaterial>(null);
  const cFrom = useMemo(() => new Color(from), [from]);
  const cTo = useMemo(() => new Color(to), [to]);

  const r = TUBE_R * 0.9;
  const bottomCY = TUBE_FLOOR + TUBE_R;
  const h = topY - bottomCY;
  const cy = bottomCY + h / 2;

  useFrame((_, dt) => {
    const target = reacted ? cTo : cFrom;
    const k = Math.min(1, rate * dt);
    for (const m of [bodyMat.current, ballMat.current, surfMat.current]) {
      if (!m) continue;
      m.color.lerp(target, k);
      m.emissive.lerp(target, k);
    }
  });

  return (
    <group>
      <mesh position={[0, bottomCY, 0]}>
        <sphereGeometry args={[r, 40, 24, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2]} />
        <meshStandardMaterial ref={ballMat} color={from} transparent opacity={0.8} roughness={0.13} emissive={from} emissiveIntensity={emissive} />
      </mesh>
      <mesh position={[0, cy, 0]}>
        <cylinderGeometry args={[r, r, h, 48]} />
        <meshStandardMaterial ref={bodyMat} color={from} transparent opacity={0.8} roughness={0.13} emissive={from} emissiveIntensity={emissive} />
      </mesh>
      <mesh position={[0, topY, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[r, 48]} />
        <meshStandardMaterial ref={surfMat} color={from} transparent opacity={0.9} roughness={0.06} metalness={0.1} emissive={from} emissiveIntensity={emissive} />
      </mesh>
    </group>
  );
}
