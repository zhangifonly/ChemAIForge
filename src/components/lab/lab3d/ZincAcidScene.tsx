"use client";

// 锌与稀硫酸制氢 3D 场景：试管 + 稀硫酸 + 底部锌粒，反应时锌粒表面持续冒氢气泡上升。
// 由父组件传入派生状态。反应：加硫酸→无色液；加锌→锌粒沉底；混合→气泡上升。
// 坐标系沿用 LabPrimitives：y=0 为台面，试管内底 TUBE_FLOOR、口 TUBE_RIM_Y。
import { useMemo } from "react";
import { LabBench, TubeRack, GlassTube, LiquidColumn, TUBE_R, TUBE_FLOOR } from "./LabPrimitives";
import { Bubbles } from "./phenomena";

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
      {reacted && (
        <Bubbles radius={TUBE_R * 0.8} bottomY={TUBE_FLOOR} topY={LIQUID_TOP} count={70} speed={0.45} />
      )}
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
