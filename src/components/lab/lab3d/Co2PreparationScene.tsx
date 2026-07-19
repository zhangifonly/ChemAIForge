"use client";

// 二氧化碳实验室制取 3D 场景：左侧锥形瓶中大理石(碳酸钙)与稀盐酸反应产气，
// 气体经导管通入右侧试管的澄清石灰水，石灰水由清变浑浊。
// 反应：加盐酸→瓶内起泡；反应→导管出气泡进石灰水→石灰水渐浑。
import { LabBench, TUBE_R } from "./LabPrimitives";
import { Bubbles } from "./phenomena";
import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import type { MeshStandardMaterial } from "three";
import { Color } from "three";

export interface Co2Props {
  hasAcid: boolean; // 已加盐酸
  reacted: boolean; // 反应产气中
}

export function Co2PreparationScene({ hasAcid, reacted }: Co2Props) {
  return (
    <group position={[0, -1.0, 0]}>
      <LabBench />
      {/* 左：锥形瓶反应器（大理石+盐酸） */}
      <group position={[-1.3, 0, 0]}>
        <ConicalFlask />
        {hasAcid && <FlaskLiquid />}
        <Marble />
        {reacted && <Bubbles radius={0.34} bottomY={0.12} topY={0.75} count={60} speed={0.5} color="#eef6ff" />}
      </group>
      {/* 导管：从锥形瓶口斜插到右侧试管底 */}
      <DeliveryTube />
      {/* 右：试管盛石灰水，通入 CO2 后变浑浊 */}
      <group position={[1.25, 0, 0]}>
        <TestTubeSimple />
        <LimewaterLiquid reacted={reacted} />
        {reacted && <Bubbles radius={TUBE_R * 0.6} bottomY={0.5} topY={1.4} count={30} speed={0.6} color="#ffffff" />}
      </group>
    </group>
  );
}

// 锥形瓶：下宽上窄的瓶身（圆锥台）+ 细瓶颈，玻璃质感。
function ConicalFlask() {
  const glass = (
    <meshPhysicalMaterial color="#eef7ff" transparent opacity={0.26} roughness={0.08} transmission={0.65} ior={1.3} side={2} depthWrite={false} />
  );
  return (
    <group>
      {/* 瓶身：圆锥台（底 0.5 → 颈 0.16） */}
      <mesh position={[0, 0.45, 0]} castShadow>
        <cylinderGeometry args={[0.16, 0.5, 0.9, 48, 1, true]} />
        {glass}
      </mesh>
      {/* 瓶底 */}
      <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.5, 48]} />
        {glass}
      </mesh>
      {/* 瓶颈 */}
      <mesh position={[0, 1.02, 0]}>
        <cylinderGeometry args={[0.16, 0.16, 0.26, 32, 1, true]} />
        {glass}
      </mesh>
    </group>
  );
}

// 瓶内稀盐酸：底部一层浅液
function FlaskLiquid() {
  return (
    <mesh position={[0, 0.22, 0]}>
      <cylinderGeometry args={[0.4, 0.46, 0.34, 40]} />
      <meshStandardMaterial color="#dfeaf2" transparent opacity={0.7} roughness={0.15} emissive="#dfeaf2" emissiveIntensity={0.15} />
    </mesh>
  );
}

// 大理石块（碳酸钙）：瓶底几颗灰白不规则石块
function Marble() {
  const bits = [
    [0.1, 0.08, 0.05, 0.11],
    [-0.14, 0.07, -0.08, 0.09],
    [0.02, 0.06, -0.13, 0.08],
    [-0.05, 0.07, 0.12, 0.1],
  ] as const;
  return (
    <group>
      {bits.map(([x, y, z, s], i) => (
        <mesh key={i} position={[x, y, z]} rotation={[i, i * 1.4, 0]} castShadow>
          <dodecahedronGeometry args={[s, 0]} />
          <meshStandardMaterial color="#d8d4c8" roughness={0.85} metalness={0.02} />
        </mesh>
      ))}
    </group>
  );
}
// 导气管：从左瓶口(约 -1.3,1.15) 折向右试管内(约 1.25,0.6)，用两段细圆柱近似。
function DeliveryTube() {
  const mat = <meshStandardMaterial color="#cfd6dc" roughness={0.3} metalness={0.3} transparent opacity={0.85} />;
  return (
    <group>
      {/* 水平段（架在两容器口之上） */}
      <mesh position={[0, 1.5, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[0.035, 0.035, 2.7, 20]} />
        {mat}
      </mesh>
      {/* 左竖段：接入锥形瓶口 */}
      <mesh position={[-1.3, 1.32, 0]} castShadow>
        <cylinderGeometry args={[0.035, 0.035, 0.4, 20]} />
        {mat}
      </mesh>
      {/* 右竖段：插入试管深处 */}
      <mesh position={[1.25, 1.0, 0]} castShadow>
        <cylinderGeometry args={[0.035, 0.035, 1.1, 20]} />
        {mat}
      </mesh>
    </group>
  );
}

// 简易试管（右侧盛石灰水）：直立细管
function TestTubeSimple() {
  const glass = (
    <meshPhysicalMaterial color="#eef7ff" transparent opacity={0.24} roughness={0.08} transmission={0.6} ior={1.3} side={2} depthWrite={false} />
  );
  return (
    <group>
      <mesh position={[0, 0.9, 0]}>
        <cylinderGeometry args={[TUBE_R, TUBE_R, 1.5, 40, 1, true]} />
        {glass}
      </mesh>
      <mesh position={[0, 0.16, 0]}>
        <sphereGeometry args={[TUBE_R, 40, 24, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2]} />
        {glass}
      </mesh>
    </group>
  );
}

// 石灰水：清澈→通入 CO2 后乳白浑浊（提高 opacity + 变白）
function LimewaterLiquid({ reacted }: { reacted: boolean }) {
  const mat = useRef<MeshStandardMaterial>(null);
  const clear = useMemo(() => new Color("#eaf4f0"), []);
  const milky = useMemo(() => new Color("#f4f6f2"), []);
  useFrame((_, dt) => {
    if (!mat.current) return;
    const k = Math.min(1, dt * 0.8);
    mat.current.color.lerp(reacted ? milky : clear, k);
    mat.current.opacity = reacted
      ? Math.min(0.95, mat.current.opacity + dt * 0.3)
      : Math.max(0.5, mat.current.opacity - dt * 0.3);
  });
  const r = TUBE_R * 0.9;
  return (
    <mesh position={[0, 0.55, 0]}>
      <cylinderGeometry args={[r, r, 0.8, 40]} />
      <meshStandardMaterial ref={mat} color="#eaf4f0" transparent opacity={0.5} roughness={0.12} />
    </mesh>
  );
}
