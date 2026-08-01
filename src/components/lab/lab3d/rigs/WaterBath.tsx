"use client";

// 水浴：大烧杯盛水，试管坐在水中，下方酒精灯加热。水面有热气升腾。
// 水浴是"控温不超过 100℃"的标准手段，酯化 / 水解 / 银镜等实验都用。
import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import type { Points } from "three";

export function WaterBath({ waterY = 0.72 }: { waterY?: number }) {
  return (
    <group>
      {/* 外层大烧杯 */}
      <mesh position={[0, 0.55, 0]}>
        <cylinderGeometry args={[0.82, 0.8, 1.1, 44, 1, true]} />
        <meshPhysicalMaterial
          color="#eef7ff"
          transparent
          opacity={0.16}
          roughness={0.05}
          transmission={0.82}
          ior={1.45}
          side={2}
          depthWrite={false}
        />
      </mesh>
      <mesh position={[0, 0.02, 0]}>
        <cylinderGeometry args={[0.8, 0.8, 0.04, 44]} />
        <meshPhysicalMaterial color="#eef7ff" transparent opacity={0.24} roughness={0.06} />
      </mesh>
      {/* 浴水 */}
      <mesh position={[0, waterY / 2 + 0.02, 0]}>
        <cylinderGeometry args={[0.78, 0.77, waterY, 44]} />
        <meshStandardMaterial
          color="#bcd8ea"
          transparent
          opacity={0.55}
          roughness={0.15}
          emissive="#8fbcd8"
          emissiveIntensity={0.1}
        />
      </mesh>
      <Steam y={waterY + 0.06} />
    </group>
  );
}

/** 水面热气：稀疏白色粒子缓慢上升淡出 */
function Steam({ y, count = 42 }: { y: number; count?: number }) {
  const pts = useRef<Points>(null);
  const data = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const seed = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = Math.random() * 0.68;
      pos[i * 3] = Math.cos(a) * r;
      pos[i * 3 + 1] = y + Math.random() * 1.1;
      pos[i * 3 + 2] = Math.sin(a) * r;
      seed[i] = 0.16 + Math.random() * 0.2;
    }
    return { pos, seed };
  }, [count, y]);

  useFrame((_, dt) => {
    const g = pts.current?.geometry;
    if (!g) return;
    const a = g.attributes.position.array as Float32Array;
    const d = Math.min(dt, 0.05);
    for (let i = 0; i < count; i++) {
      a[i * 3 + 1] += data.seed[i] * d;
      if (a[i * 3 + 1] > y + 1.3) a[i * 3 + 1] = y;
    }
    g.attributes.position.needsUpdate = true;
  });

  return (
    <points ref={pts}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[data.pos, 3]} />
      </bufferGeometry>
      <pointsMaterial size={0.1} color="#ffffff" transparent opacity={0.22} depthWrite={false} />
    </points>
  );
}
