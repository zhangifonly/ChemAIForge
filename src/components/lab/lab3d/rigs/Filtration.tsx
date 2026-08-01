"use client";

// 过滤装置：铁架台铁圈架住漏斗，漏斗内贴滤纸，下接烧杯承接滤液。
// 有沉淀时滤纸上留下沉淀层，滤液滴入下方烧杯——这是"过滤"的可视化核心。
import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import type { Mesh } from "three";

export interface FiltrationProps {
  /** 滤纸上的沉淀颜色（无沉淀传 null） */
  residueColor?: string | null;
  /** 是否正在滴滤液 */
  dripping?: boolean;
}

export function Filtration({ residueColor = null, dripping = false }: FiltrationProps) {
  return (
    <group>
      <IronStand />
      <Funnel />
      <FilterPaper residueColor={residueColor} />
      {dripping && <Drip />}
    </group>
  );
}

/** 铁架台：底座 + 立杆 + 铁圈 */
function IronStand() {
  const metal = <meshStandardMaterial color="#4a5058" metalness={0.7} roughness={0.42} />;
  return (
    <group position={[-0.95, 0, -0.1]}>
      <mesh position={[0, 0.04, 0]} castShadow>
        <boxGeometry args={[0.7, 0.08, 0.5]} />
        {metal}
      </mesh>
      <mesh position={[0, 1.3, 0]}>
        <cylinderGeometry args={[0.045, 0.045, 2.6, 18]} />
        {metal}
      </mesh>
      {/* 横臂伸向器皿中心 */}
      <mesh position={[0.5, 1.86, 0.1]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.032, 0.032, 1.0, 14]} />
        {metal}
      </mesh>
      {/* 铁圈 */}
      <mesh position={[0.95, 1.86, 0.1]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.34, 0.03, 12, 36]} />
        {metal}
      </mesh>
    </group>
  );
}

/** 漏斗：倒锥 + 细颈 */
function Funnel() {
  const glass = (
    <meshPhysicalMaterial
      color="#eef7ff"
      transparent
      opacity={0.22}
      roughness={0.06}
      transmission={0.78}
      ior={1.45}
      side={2}
      depthWrite={false}
    />
  );
  return (
    <group position={[0, 0, 0]}>
      <mesh position={[0, 2.06, 0]}>
        <coneGeometry args={[0.44, 0.62, 36, 1, true]} />
        {glass}
      </mesh>
      <mesh position={[0, 1.5, 0]}>
        <cylinderGeometry args={[0.055, 0.055, 0.52, 18, 1, true]} />
        {glass}
      </mesh>
    </group>
  );
}

/** 滤纸：贴在漏斗内壁的锥面，上面可堆积沉淀 */
function FilterPaper({ residueColor }: { residueColor: string | null }) {
  return (
    <group position={[0, 2.04, 0]}>
      <mesh>
        <coneGeometry args={[0.38, 0.54, 32, 1, true]} />
        <meshStandardMaterial color="#f7f8f5" roughness={0.95} side={2} />
      </mesh>
      {residueColor && (
        <mesh position={[0, -0.12, 0]}>
          <coneGeometry args={[0.28, 0.3, 28, 1, true]} />
          <meshStandardMaterial color={residueColor} roughness={0.9} side={2} />
        </mesh>
      )}
    </group>
  );
}

/** 滤液滴：从漏斗颈口落向下方烧杯，循环复位 */
function Drip({ fromY = 1.24, toY = 0.6 }: { fromY?: number; toY?: number }) {
  const refs = useRef<(Mesh | null)[]>([]);
  const phase = useMemo(() => [0, 0.34, 0.68], []);
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    refs.current.forEach((m, i) => {
      if (!m) return;
      const p = (t * 0.9 + phase[i]) % 1;
      m.position.y = fromY - (fromY - toY) * p;
      m.visible = p < 0.95;
    });
  });
  return (
    <group>
      {phase.map((_, i) => (
        <mesh key={i} ref={(m) => { refs.current[i] = m; }} position={[0, fromY, 0]}>
          <sphereGeometry args={[0.045, 12, 12]} />
          <meshStandardMaterial color="#cfe4f0" transparent opacity={0.8} roughness={0.15} />
        </mesh>
      ))}
    </group>
  );
}
