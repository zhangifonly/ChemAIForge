"use client";

// 锌与稀硫酸制氢 3D 场景：试管 + 稀硫酸 + 底部锌粒，反应时锌粒表面持续冒氢气泡上升。
// 由父组件传入派生状态。反应：加硫酸→无色液；加锌→锌粒沉底；混合→气泡上升。
import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import type { Points } from "three";
import { LabBench, TubeRack, GlassTube, LiquidColumn } from "./LabPrimitives";

export interface ZincAcidProps {
  hasMetal: boolean; // 锌
  hasLiquid: boolean; // 稀硫酸
  reacted: boolean; // 已混合产气
}

export function ZincAcidScene({ hasMetal, hasLiquid, reacted }: ZincAcidProps) {
  return (
    <group position={[0, -0.95, 0]}>
      <LabBench />
      <group position={[0, 0.12, 0]} scale={0.8}>
        <TubeRack />
        <group position={[0, 0.55, 0]}>
          <GlassTube />
          {hasLiquid && <LiquidColumn color="#dbe7f0" />}
          {hasMetal && <ZincGranules />}
          {reacted && <Bubbles />}
        </group>
      </group>
    </group>
  );
}

// 锌粒：底部几颗不规则金属灰小块
function ZincGranules() {
  const bits = useMemo(
    () =>
      Array.from({ length: 6 }, () => ({
        x: (Math.random() - 0.5) * 0.5,
        z: (Math.random() - 0.5) * 0.5,
        y: -0.62 + Math.random() * 0.04,
        s: 0.07 + Math.random() * 0.05,
        r: Math.random() * Math.PI,
      })),
    [],
  );
  return (
    <group>
      {bits.map((b, i) => (
        <mesh key={i} position={[b.x, b.y, b.z]} rotation={[b.r, b.r * 1.3, 0]} castShadow>
          <dodecahedronGeometry args={[b.s, 0]} />
          <meshStandardMaterial color="#8c949e" metalness={0.7} roughness={0.45} />
        </mesh>
      ))}
    </group>
  );
}

// 氢气泡：从底部锌粒区不断上升到液面消失（循环）
function Bubbles() {
  const pts = useRef<Points>(null);
  const data = useMemo(() => {
    const n = 80;
    const arr = new Float32Array(n * 3);
    const vy = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const r = Math.random() * 0.34;
      const a = Math.random() * Math.PI * 2;
      arr[i * 3] = Math.cos(a) * r;
      arr[i * 3 + 1] = -0.6 + Math.random() * 1.2;
      arr[i * 3 + 2] = Math.sin(a) * r;
      vy[i] = 0.4 + Math.random() * 0.5;
    }
    return { arr, vy, n };
  }, []);
  useFrame((_, dt) => {
    if (!pts.current) return;
    const a = pts.current.geometry.attributes.position.array as Float32Array;
    for (let i = 0; i < data.n; i++) {
      const yi = i * 3 + 1;
      a[yi] += data.vy[i] * dt; // 上升
      if (a[yi] > 0.6) a[yi] = -0.6; // 到液面后回到底部循环
    }
    pts.current.geometry.attributes.position.needsUpdate = true;
  });
  return (
    <points ref={pts}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[data.arr, 3]} />
      </bufferGeometry>
      <pointsMaterial color="#ffffff" size={0.05} sizeAttenuation transparent opacity={0.85} />
    </points>
  );
}
