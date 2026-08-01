"use client";

// 乳浊液：用大量缓慢布朗漂移的白色微粒填满液体内部。
// 之所以不直接把液体调成白色，是因为乳浊的特征是"浑而不透"——
// 光线被微粒散射，隔着杯子看不清后面的东西，只有粒子云能表达这一点。
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { Points } from "three";
import { VESSEL_GEOM } from "../Vessels";
import type { VesselKind } from "@/lib/chem/scenePlan";

export interface TurbidityProps {
  kind: VesselKind;
  /** 液面高度（世界坐标 Y） */
  topY: number;
  /** 浑浊程度 0~1，越大粒子越密、越不透明 */
  density?: number;
  color?: string;
}

export function Turbidity({ kind, topY, density = 1, color = "#f4f7f8" }: TurbidityProps) {
  const g = VESSEL_GEOM[kind];
  const ref = useRef<Points>(null);
  const count = Math.round(120 + 220 * Math.min(1, Math.max(0, density)));

  const { positions, drift } = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const drift = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      const y = g.floorY + Math.random() * Math.max(0.05, topY - g.floorY);
      // 按该高度的内壁半径撒点，粒子才不会穿出杯壁
      const r = g.radiusAt(y) * 0.88 * Math.sqrt(Math.random());
      const a = Math.random() * Math.PI * 2;
      positions[i * 3] = Math.cos(a) * r;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = Math.sin(a) * r;
      drift[i] = 0.2 + Math.random() * 0.8;
    }
    return { positions, drift };
  }, [count, g, topY]);

  // 布朗运动：极缓慢的上下浮沉，让浊液看起来是"活的"而非静止贴图
  useFrame((state, dt) => {
    const pts = ref.current;
    if (!pts) return;
    const arr = pts.geometry.attributes.position.array as Float32Array;
    const t = state.clock.elapsedTime;
    const step = Math.min(dt, 0.05);
    for (let i = 0; i < count; i++) {
      arr[i * 3 + 1] += Math.sin(t * drift[i] + i) * step * 0.02;
      const y = arr[i * 3 + 1];
      if (y > topY) arr[i * 3 + 1] = g.floorY;
      else if (y < g.floorY) arr[i * 3 + 1] = topY;
    }
    pts.geometry.attributes.position.needsUpdate = true;
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        size={0.028}
        color={color}
        transparent
        opacity={0.5 + 0.35 * Math.min(1, density)}
        sizeAttenuation
        depthWrite={false}
      />
    </points>
  );
}
