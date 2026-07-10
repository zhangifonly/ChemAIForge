"use client";

// 锌与稀硫酸制氢 3D 场景：试管 + 稀硫酸 + 底部锌粒，反应时锌粒表面持续冒氢气泡上升。
// 由父组件传入派生状态。反应：加硫酸→无色液；加锌→锌粒沉底；混合→气泡上升。
// 坐标系沿用 LabPrimitives：y=0 为台面，试管内底 TUBE_FLOOR、口 TUBE_RIM_Y。
import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import type { Points } from "three";
import { LabBench, TubeRack, GlassTube, LiquidColumn, TUBE_R, TUBE_FLOOR } from "./LabPrimitives";

export interface ZincAcidProps {
  hasMetal: boolean; // 锌
  hasLiquid: boolean; // 稀硫酸
  reacted: boolean; // 已混合产气
}

const LIQUID_TOP = 1.45;

export function ZincAcidScene({ hasMetal, hasLiquid, reacted }: ZincAcidProps) {
  return (
    <group position={[0, -1.0, 0]}>
      <LabBench />
      <TubeRack />
      <GlassTube />
      {hasLiquid && <LiquidColumn color="#dbe7f0" topY={LIQUID_TOP} />}
      {hasMetal && <ZincGranules />}
      {reacted && <Bubbles />}
    </group>
  );
}

// 锌粒：管底几颗不规则金属灰小块
function ZincGranules() {
  const bits = useMemo(
    () =>
      Array.from({ length: 6 }, () => ({
        x: (Math.random() - 0.5) * TUBE_R,
        z: (Math.random() - 0.5) * TUBE_R,
        y: TUBE_FLOOR + 0.02 + Math.random() * 0.04,
        s: 0.04 + Math.random() * 0.03,
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

// 氢气泡：从管底锌粒区不断上升到液面消失（循环）
function Bubbles() {
  const pts = useRef<Points>(null);
  const data = useMemo(() => {
    const n = 70;
    const arr = new Float32Array(n * 3);
    const vy = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const r = Math.random() * (TUBE_R * 0.8);
      const a = Math.random() * Math.PI * 2;
      arr[i * 3] = Math.cos(a) * r;
      arr[i * 3 + 1] = TUBE_FLOOR + Math.random() * (LIQUID_TOP - TUBE_FLOOR);
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
      if (a[yi] > LIQUID_TOP) a[yi] = TUBE_FLOOR; // 到液面后回到底部循环
    }
    pts.current.geometry.attributes.position.needsUpdate = true;
  });
  return (
    <points ref={pts}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[data.arr, 3]} />
      </bufferGeometry>
      <pointsMaterial color="#ffffff" size={0.04} sizeAttenuation transparent opacity={0.85} />
    </points>
  );
}
