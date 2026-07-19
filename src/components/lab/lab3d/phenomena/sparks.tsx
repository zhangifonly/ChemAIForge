"use client";

// 火星四射：从中心向四周迸发的橙黄炽热颗粒，做抛物线运动后回收循环。
// 供铁丝在氧气中燃烧（火星四射、落下熔珠）等场景。
import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import type { Points } from "three";

export function Sparks({
  origin = [0, 0, 0],
  count = 80,
  color = "#ffb64a",
  spread = 1.4,
  gravity = 2.2,
  floorY = -0.9,
}: {
  origin?: [number, number, number];
  count?: number;
  color?: string;
  spread?: number; // 迸发初速度水平分量
  gravity?: number;
  floorY?: number; // 落到此高度回收
}) {
  const pts = useRef<Points>(null);
  const state = useMemo(() => {
    const arr = new Float32Array(count * 3);
    const vel = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const up = 1.2 + Math.random() * 1.6;
      const sp = spread * (0.3 + Math.random() * 0.9);
      arr[i * 3] = origin[0];
      arr[i * 3 + 1] = origin[1];
      arr[i * 3 + 2] = origin[2];
      vel[i * 3] = Math.cos(a) * sp;
      vel[i * 3 + 1] = up;
      vel[i * 3 + 2] = Math.sin(a) * sp;
    }
    return { arr, vel };
  }, [count, origin, spread]);

  useFrame((_, dt) => {
    if (!pts.current) return;
    const a = pts.current.geometry.attributes.position.array as Float32Array;
    const v = state.vel;
    for (let i = 0; i < count; i++) {
      const xi = i * 3;
      v[xi + 1] -= gravity * dt;
      a[xi] += v[xi] * dt;
      a[xi + 1] += v[xi + 1] * dt;
      a[xi + 2] += v[xi + 2] * dt;
      if (a[xi + 1] < floorY) {
        // 回收：重新从中心迸发
        const ang = Math.random() * Math.PI * 2;
        const up = 1.2 + Math.random() * 1.6;
        const sp = spread * (0.3 + Math.random() * 0.9);
        a[xi] = origin[0];
        a[xi + 1] = origin[1];
        a[xi + 2] = origin[2];
        v[xi] = Math.cos(ang) * sp;
        v[xi + 1] = up;
        v[xi + 2] = Math.sin(ang) * sp;
      }
    }
    pts.current.geometry.attributes.position.needsUpdate = true;
  });

  return (
    <points ref={pts}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[state.arr, 3]} />
      </bufferGeometry>
      <pointsMaterial color={color} size={0.06} sizeAttenuation transparent opacity={0.95} toneMapped={false} depthWrite={false} />
    </points>
  );
}
