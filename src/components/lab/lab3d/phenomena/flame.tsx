"use client";

// 燃烧光效组件：
//  - BrightFlare：耀眼白光球（配合 Bloom 产生炫光），供镁条燃烧等强放热反应。
//  - Smoke：白烟粒子向上飘散扩散，供燃烧生成白色烟雾/氧化物。
import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import type { Points, Mesh } from "three";

// 耀眼白光：一个高自发光小球，亮度轻微脉动，交给 Bloom 形成光晕。
export function BrightFlare({
  position = [0, 0, 0],
  color = "#fffdf0",
  radius = 0.14,
}: {
  position?: [number, number, number];
  color?: string;
  radius?: number;
}) {
  const mesh = useRef<Mesh>(null);
  useFrame(({ clock }) => {
    if (!mesh.current) return;
    const s = 1 + Math.sin(clock.elapsedTime * 22) * 0.12;
    mesh.current.scale.setScalar(s);
  });
  return (
    <mesh ref={mesh} position={position}>
      <sphereGeometry args={[radius, 24, 24]} />
      <meshBasicMaterial color={color} toneMapped={false} />
    </mesh>
  );
}

// 白烟：从 origin 升起并扩散、逐渐远离，循环。
export function Smoke({
  origin = [0, 0, 0],
  count = 40,
  color = "#f2f2f0",
  rise = 0.5,
  topY = 2.6,
}: {
  origin?: [number, number, number];
  count?: number;
  color?: string;
  rise?: number;
  topY?: number;
}) {
  const pts = useRef<Points>(null);
  const data = useMemo(() => {
    const arr = new Float32Array(count * 3);
    const vy = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      arr[i * 3] = origin[0] + (Math.random() - 0.5) * 0.1;
      arr[i * 3 + 1] = origin[1] + Math.random() * 0.4;
      arr[i * 3 + 2] = origin[2] + (Math.random() - 0.5) * 0.1;
      vy[i] = rise * (0.6 + Math.random() * 0.9);
    }
    return { arr, vy };
  }, [count, origin, rise]);

  useFrame((_, dt) => {
    if (!pts.current) return;
    const a = pts.current.geometry.attributes.position.array as Float32Array;
    for (let i = 0; i < count; i++) {
      const xi = i * 3;
      a[xi + 1] += data.vy[i] * dt;
      // 上升时向外扩散
      a[xi] += (a[xi] - origin[0]) * dt * 0.5;
      a[xi + 2] += (a[xi + 2] - origin[2]) * dt * 0.5;
      if (a[xi + 1] > topY) {
        a[xi] = origin[0] + (Math.random() - 0.5) * 0.1;
        a[xi + 1] = origin[1];
        a[xi + 2] = origin[2] + (Math.random() - 0.5) * 0.1;
      }
    }
    pts.current.geometry.attributes.position.needsUpdate = true;
  });

  return (
    <points ref={pts}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[data.arr, 3]} />
      </bufferGeometry>
      <pointsMaterial color={color} size={0.16} sizeAttenuation transparent opacity={0.32} depthWrite={false} />
    </points>
  );
}
