"use client";

// 通用气泡粒子：在给定竖直区间内从底部持续上升到顶部循环。
// 供产气类实验复用（金属+酸、碳酸盐+酸、电解产气等），可调半径/数量/颜色/速度。
import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import type { Points } from "three";

export interface BubblesProps {
  /** 气泡分布圆柱半径 */
  radius?: number;
  /** 上升区间底 / 顶（世界或父 group 坐标） */
  bottomY?: number;
  topY?: number;
  /** 粒子数量 */
  count?: number;
  /** 上升速度基准 */
  speed?: number;
  /** 气泡中心 x/z 偏移（多电极场景可错开） */
  cx?: number;
  cz?: number;
  size?: number;
  color?: string;
  opacity?: number;
}

export function Bubbles({
  radius = 0.16,
  bottomY = 0.16,
  topY = 1.45,
  count = 70,
  speed = 0.45,
  cx = 0,
  cz = 0,
  size = 0.04,
  color = "#ffffff",
  opacity = 0.85,
}: BubblesProps) {
  const pts = useRef<Points>(null);
  const data = useMemo(() => {
    const arr = new Float32Array(count * 3);
    const vy = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      const r = Math.random() * radius;
      const a = Math.random() * Math.PI * 2;
      arr[i * 3] = cx + Math.cos(a) * r;
      arr[i * 3 + 1] = bottomY + Math.random() * (topY - bottomY);
      arr[i * 3 + 2] = cz + Math.sin(a) * r;
      vy[i] = speed * (0.8 + Math.random() * 1.1);
    }
    return { arr, vy };
  }, [count, radius, bottomY, topY, speed, cx, cz]);

  useFrame((_, dt) => {
    if (!pts.current) return;
    const a = pts.current.geometry.attributes.position.array as Float32Array;
    for (let i = 0; i < count; i++) {
      const yi = i * 3 + 1;
      a[yi] += data.vy[i] * dt;
      if (a[yi] > topY) a[yi] = bottomY;
    }
    pts.current.geometry.attributes.position.needsUpdate = true;
  });

  return (
    <points ref={pts}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[data.arr, 3]} />
      </bufferGeometry>
      <pointsMaterial color={color} size={size} sizeAttenuation transparent opacity={opacity} />
    </points>
  );
}
