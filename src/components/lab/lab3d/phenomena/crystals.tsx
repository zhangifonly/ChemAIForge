"use client";

// 晶体析出：热饱和溶液冷却 / 蒸发时，杯底与杯壁长出棱角分明的晶体。
// 用八面体几何而非球体，因为"有棱有面、反光锐利"正是晶体区别于沉淀粉末的关键特征；
// 沉淀是无定形细粉（见 precipitate.tsx），两者不能用同一种表现。
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { Group } from "three";
import { VESSEL_GEOM } from "../Vessels";
import type { VesselKind } from "@/lib/chem/scenePlan";

export interface CrystalsProps {
  kind: VesselKind;
  color: string;
  /** 生长进度 0~1：0 完全没有，1 长满杯底 */
  growth?: number;
  count?: number;
}

export function Crystals({ kind, color, growth = 1, count = 26 }: CrystalsProps) {
  const g = VESSEL_GEOM[kind];
  const ref = useRef<Group>(null);
  const rBase = g.radiusAt(g.floorY) * 0.82;

  const seeds = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => {
        const a = (i / count) * Math.PI * 2 + Math.random();
        const r = rBase * Math.sqrt(Math.random());
        return {
          x: Math.cos(a) * r,
          z: Math.sin(a) * r,
          size: 0.022 + Math.random() * 0.03,
          rot: [Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI] as const,
          // 各晶体错开生长起点，模拟晶核先后出现而非齐刷刷冒出
          delay: Math.random() * 0.6,
        };
      }),
    [count, rBase],
  );

  // 生长动画：整体缩放平滑趋近目标，冷却过程中晶体逐渐变大
  useFrame((_, dt) => {
    const grp = ref.current;
    if (!grp) return;
    const k = Math.min(1, dt * 1.6);
    grp.children.forEach((child, i) => {
      const seed = seeds[i];
      if (!seed) return;
      const target = Math.max(0, (growth - seed.delay) / (1 - seed.delay || 1));
      const s = child.scale.x + (Math.max(0, Math.min(1, target)) - child.scale.x) * k;
      child.scale.setScalar(s);
    });
  });

  return (
    <group ref={ref}>
      {seeds.map((s, i) => (
        <mesh
          key={i}
          position={[s.x, g.floorY + s.size * 0.7, s.z]}
          rotation={[s.rot[0], s.rot[1], s.rot[2]]}
          scale={0}
        >
          <octahedronGeometry args={[s.size, 0]} />
          <meshStandardMaterial
            color={color}
            roughness={0.12}
            metalness={0.06}
            transparent
            opacity={0.92}
          />
        </mesh>
      ))}
    </group>
  );
}
