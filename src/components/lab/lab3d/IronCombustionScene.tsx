"use client";

// 铁丝在氧气中燃烧 3D 场景：集气瓶盛氧气，螺旋铁丝(端头系火柴)伸入瓶中，
// 点燃后剧烈燃烧、火星四射，生成黑色四氧化三铁熔珠落下；瓶底铺细沙防炸裂。
// 状态：hasFe（螺旋铁丝）→ reacted（火星四射 + 熔珠 + 强光）。
import { LabBench } from "./LabPrimitives";
import { Sparks, BrightFlare } from "./phenomena";
import { useMemo } from "react";

export interface IronCombustionProps {
  hasFe: boolean; // 铁丝已伸入
  reacted: boolean; // 已点燃燃烧
}

export function IronCombustionScene({ hasFe, reacted }: IronCombustionProps) {
  return (
    <group position={[0, -1.0, 0]}>
      <LabBench />
      <GasJar />
      <SandLayer />
      {hasFe && <IronSpiral reacted={reacted} />}
      {reacted && (
        <>
          <Sparks origin={[0, 1.0, 0]} count={90} spread={0.6} floorY={0.35} color="#ffbe4d" />
          <BrightFlare position={[0, 1.0, 0]} radius={0.1} color="#ffd27a" />
          <pointLight position={[0, 1.0, 0]} intensity={6} distance={4} color="#ffcf7a" />
        </>
      )}
    </group>
  );
}

// 集气瓶：广口玻璃瓶
function GasJar() {
  const glass = (
    <meshPhysicalMaterial color="#eef7ff" transparent opacity={0.2} roughness={0.06} transmission={0.7} ior={1.3} side={2} depthWrite={false} />
  );
  return (
    <group>
      <mesh position={[0, 0.85, 0]}>
        <cylinderGeometry args={[0.55, 0.55, 1.5, 48, 1, true]} />
        {glass}
      </mesh>
      <mesh position={[0, 0.12, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.55, 48]} />
        {glass}
      </mesh>
      {/* 瓶口圈 */}
      <mesh position={[0, 1.6, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.55, 0.03, 12, 48]} />
        <meshStandardMaterial color="#eaf4ff" roughness={0.2} metalness={0.2} transparent opacity={0.7} />
      </mesh>
    </group>
  );
}

// 瓶底细沙（防高温熔珠炸裂瓶底）
function SandLayer() {
  return (
    <mesh position={[0, 0.2, 0]}>
      <cylinderGeometry args={[0.5, 0.5, 0.16, 40]} />
      <meshStandardMaterial color="#c8b487" roughness={1} metalness={0} />
    </mesh>
  );
}

// 螺旋铁丝：用若干小段近似螺旋线；燃烧时转暗（生成四氧化三铁）
function IronSpiral({ reacted }: { reacted: boolean }) {
  const segs = useMemo(() => {
    const arr: { x: number; y: number; z: number; ry: number }[] = [];
    const turns = 3;
    const n = 42;
    for (let i = 0; i < n; i++) {
      const t = i / n;
      const a = t * Math.PI * 2 * turns;
      const r = 0.22;
      arr.push({ x: Math.cos(a) * r, y: 0.55 + t * 0.9, z: Math.sin(a) * r, ry: a });
    }
    return arr;
  }, []);
  return (
    <group>
      {segs.map((s, i) => (
        <mesh key={i} position={[s.x, s.y, s.z]} rotation={[0, s.ry, Math.PI / 2]} castShadow>
          <cylinderGeometry args={[0.018, 0.018, 0.12, 8]} />
          <meshStandardMaterial
            color={reacted ? "#2a2a2e" : "#8c949e"}
            metalness={reacted ? 0.4 : 0.85}
            roughness={reacted ? 0.7 : 0.35}
          />
        </mesh>
      ))}
    </group>
  );
}
