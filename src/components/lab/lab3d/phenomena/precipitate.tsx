"use client";

// 絮状沉淀：一团半透明小颗粒在液体中缓慢下沉、堆积到底部。
// 供沉淀类实验复用（氢氧化铁红棕、氢氧化铜蓝、碳酸钙白等），换 color 即可。
import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import type { Points } from "three";

export interface PrecipitateProps {
  radius?: number;
  /** 沉淀最终堆积面（底） */
  floorY?: number;
  /** 初始悬浮上限 */
  topY?: number;
  count?: number;
  color?: string;
  size?: number;
  /** 下沉速度 */
  settle?: number;
}

export function Precipitate({
  radius = 0.15,
  floorY = 0.18,
  topY = 1.4,
  count = 120,
  color = "#c65a2e",
  size = 0.05,
  settle = 0.12,
}: PrecipitateProps) {
  const pts = useRef<Points>(null);
  const data = useMemo(() => {
    const arr = new Float32Array(count * 3);
    const rest = new Float32Array(count); // 各颗粒的最终停留高度（堆积成锥形）
    for (let i = 0; i < count; i++) {
      const r = Math.random() * radius;
      const a = Math.random() * Math.PI * 2;
      const rx = Math.cos(a) * r;
      const rz = Math.sin(a) * r;
      arr[i * 3] = rx;
      arr[i * 3 + 1] = floorY + Math.random() * (topY - floorY);
      arr[i * 3 + 2] = rz;
      // 越靠中心堆得越高，形成小丘
      rest[i] = floorY + (1 - r / radius) * 0.18 + Math.random() * 0.03;
    }
    return { arr, rest };
  }, [count, radius, floorY, topY]);

  useFrame((_, dt) => {
    if (!pts.current) return;
    const a = pts.current.geometry.attributes.position.array as Float32Array;
    for (let i = 0; i < count; i++) {
      const yi = i * 3 + 1;
      if (a[yi] > data.rest[i]) {
        a[yi] = Math.max(data.rest[i], a[yi] - settle * dt * (0.6 + Math.random() * 0.8));
      }
    }
    pts.current.geometry.attributes.position.needsUpdate = true;
  });

  return (
    <points ref={pts}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[data.arr, 3]} />
      </bufferGeometry>
      <pointsMaterial color={color} size={size} sizeAttenuation transparent opacity={0.72} />
    </points>
  );
}
