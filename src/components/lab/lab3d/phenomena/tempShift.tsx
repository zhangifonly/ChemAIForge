"use client";

// 温度变化的可视化：溶解热 / 稀释放热这类实验没有颜色、气泡、沉淀，
// 唯一现象就是"手摸杯壁发烫或发凉"。3D 里靠两种真实可见的伴随现象来表达：
//   升温 → 液面上方升起淡淡热雾（水蒸气）
//   降温 → 杯外壁凝出细密水珠（空气中水汽遇冷液化），杯底甚至结霜
// 这比单纯把液体染成红/蓝色诚实得多，也是学生在实验室真正看到的东西。
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { Points } from "three";
import { VESSEL_GEOM } from "../Vessels";
import type { VesselKind } from "@/lib/chem/scenePlan";

export interface TempShiftProps {
  kind: VesselKind;
  /** 液面高度 */
  topY: number;
  direction: "up" | "down";
}

export function TempShift({ kind, topY, direction }: TempShiftProps) {
  return direction === "up" ? (
    <WarmHaze kind={kind} topY={topY} />
  ) : (
    <Condensation kind={kind} topY={topY} />
  );
}

/** 升温热雾：贴着液面向上飘的稀薄白雾，比沸腾蒸汽更淡 */
function WarmHaze({ kind, topY }: { kind: VesselKind; topY: number }) {
  const g = VESSEL_GEOM[kind];
  const ref = useRef<Points>(null);
  const count = 34;
  const r = g.radiusAt(topY) * 0.8;

  const positions = useMemo(() => {
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const rr = Math.random() * r;
      arr[i * 3] = Math.cos(a) * rr;
      arr[i * 3 + 1] = topY + Math.random() * 0.8;
      arr[i * 3 + 2] = Math.sin(a) * rr;
    }
    return arr;
  }, [r, topY]);

  useFrame((_, dt) => {
    const pts = ref.current;
    if (!pts) return;
    const arr = pts.geometry.attributes.position.array as Float32Array;
    const step = Math.min(dt, 0.05);
    for (let i = 0; i < count; i++) {
      arr[i * 3 + 1] += step * (0.16 + (i % 4) * 0.04);
      if (arr[i * 3 + 1] > topY + 0.9) arr[i * 3 + 1] = topY;
    }
    pts.geometry.attributes.position.needsUpdate = true;
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        size={0.1}
        color="#f2f8fb"
        transparent
        opacity={0.2}
        sizeAttenuation
        depthWrite={false}
      />
    </points>
  );
}

/** 降温凝露：杯外壁贴着一层细密水珠，是"变凉"最直观的证据 */
function Condensation({ kind, topY }: { kind: VesselKind; topY: number }) {
  const g = VESSEL_GEOM[kind];
  const count = 90;

  const drops = useMemo(
    () =>
      Array.from({ length: count }, () => {
        // 只在液面以下的壁面凝露：液面以上杯壁不接触冷液体，不会结露
        const y = g.floorY + Math.random() * Math.max(0.06, topY - g.floorY);
        const a = Math.random() * Math.PI * 2;
        const rr = g.radiusAt(y) * 1.01;
        return {
          pos: [Math.cos(a) * rr, y, Math.sin(a) * rr] as [number, number, number],
          size: 0.012 + Math.random() * 0.016,
        };
      }),
    [g, topY],
  );

  return (
    <group>
      {drops.map((d, i) => (
        <mesh key={i} position={d.pos}>
          <sphereGeometry args={[d.size, 8, 6]} />
          <meshPhysicalMaterial
            color="#eaf6fb"
            transparent
            opacity={0.72}
            roughness={0.02}
            transmission={0.6}
          />
        </mesh>
      ))}
    </group>
  );
}
