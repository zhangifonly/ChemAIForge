"use client";

// 铜锌原电池 3D 场景：左烧杯锌片、右烧杯铜片，稀硫酸(单液)或盐桥连通，
// 导线经电流计相连。接通电路后电流计指针偏转，锌片溶解、铜片析氢。
// 状态：hasMetals（两电极就位）→ energized（指针偏转 + 气泡）。
import { LabBench } from "./LabPrimitives";
import { Bubbles } from "./phenomena";

export interface CopperZincCellProps {
  hasMetals: boolean; // 锌铜电极已放入
  energized: boolean; // 电路已接通
}

export function CopperZincCellScene({ hasMetals, energized }: CopperZincCellProps) {
  return (
    <group position={[0, -1.0, 0]}>
      <LabBench />
      <Beaker x={-1.1} liquidColor="#dfeaf2" />
      <Beaker x={1.1} liquidColor="#7fc4ec" />
      <SaltBridge />
      {hasMetals && (
        <>
          <Electrode x={-1.1} color="#c9ccd1" label="Zn" />
          <Electrode x={1.1} color="#d98a52" label="Cu" />
        </>
      )}
      <Galvanometer energized={energized} />
      {/* 接通后铜片(正极)表面析氢气泡 */}
      {energized && hasMetals && (
        <Bubbles cx={1.1} radius={0.12} bottomY={0.35} topY={1.0} count={35} speed={0.5} color="#eef6ff" />
      )}
    </group>
  );
}

// 烧杯：透明圆柱 + 底部液体
function Beaker({ x, liquidColor }: { x: number; liquidColor: string }) {
  const glass = (
    <meshPhysicalMaterial color="#eef7ff" transparent opacity={0.2} roughness={0.07} transmission={0.7} ior={1.3} side={2} depthWrite={false} />
  );
  return (
    <group position={[x, 0, 0]}>
      <mesh position={[0, 0.55, 0]}>
        <cylinderGeometry args={[0.5, 0.5, 1.1, 40, 1, true]} />
        {glass}
      </mesh>
      <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.5, 40]} />
        {glass}
      </mesh>
      {/* 液体 */}
      <mesh position={[0, 0.45, 0]}>
        <cylinderGeometry args={[0.46, 0.46, 0.8, 36]} />
        <meshStandardMaterial color={liquidColor} transparent opacity={0.68} roughness={0.12} emissive={liquidColor} emissiveIntensity={0.15} />
      </mesh>
    </group>
  );
}

// 盐桥：倒 U 形管连通两烧杯
function SaltBridge() {
  return (
    <mesh position={[0, 1.25, 0]} rotation={[0, 0, 0]}>
      <torusGeometry args={[1.1, 0.07, 16, 40, Math.PI]} />
      <meshPhysicalMaterial color="#eaf4ff" transparent opacity={0.5} roughness={0.1} transmission={0.5} ior={1.3} />
    </mesh>
  );
}

// 电极：插入烧杯的金属片
function Electrode({ x, color }: { x: number; color: string; label: string }) {
  return (
    <mesh position={[x, 0.7, 0]} castShadow>
      <boxGeometry args={[0.12, 1.0, 0.03]} />
      <meshStandardMaterial color={color} metalness={0.8} roughness={0.35} />
    </mesh>
  );
}

// 电流计：台面后方的表盘，通电后指针偏转
function Galvanometer({ energized }: { energized: boolean }) {
  return (
    <group position={[0, 0.9, -1.4]}>
      <mesh castShadow>
        <boxGeometry args={[0.7, 0.7, 0.25]} />
        <meshStandardMaterial color="#2f3439" roughness={0.6} metalness={0.3} />
      </mesh>
      {/* 表盘 */}
      <mesh position={[0, 0.05, 0.13]}>
        <circleGeometry args={[0.26, 32]} />
        <meshStandardMaterial color="#f4f2e8" roughness={0.9} />
      </mesh>
      {/* 指针：通电后偏转 */}
      <mesh position={[0, 0.05, 0.15]} rotation={[0, 0, energized ? -0.7 : 0]}>
        <boxGeometry args={[0.02, 0.24, 0.01]} />
        <meshStandardMaterial color="#c0392b" />
      </mesh>
    </group>
  );
}
