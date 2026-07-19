"use client";

// 电解水 3D 场景：U 形管盛稀硫酸电解液，两支电极接直流电源。
// 通电后阴极（接负极）产氢气泡多、阳极产氧气泡少，体积比约 2∶1。
// 状态：hasLiquid（电解液）→ energized（两极产气，阴极约 2 倍量）。
import { LabBench } from "./LabPrimitives";
import { Bubbles } from "./phenomena";

export interface ElectrolysisWaterProps {
  hasLiquid: boolean; // 电解液已注入
  energized: boolean; // 已通电
}

export function ElectrolysisWaterScene({ hasLiquid, energized }: ElectrolysisWaterProps) {
  return (
    <group position={[0, -1.0, 0]}>
      <LabBench />
      <UTube />
      {hasLiquid && <UTubeLiquid />}
      {/* 两电极 */}
      <Electrode x={-0.6} negative />
      <Electrode x={0.6} negative={false} />
      {/* 通电产气：阴极(左,-)氢气约 2 倍，阳极(右,+)氧气约 1 倍 */}
      {energized && hasLiquid && (
        <>
          <Bubbles cx={-0.6} radius={0.12} bottomY={0.5} topY={1.7} count={80} speed={0.6} color="#eaf6ff" />
          <Bubbles cx={0.6} radius={0.12} bottomY={0.5} topY={1.7} count={40} speed={0.6} color="#fff2ea" />
        </>
      )}
      <PowerSupply />
    </group>
  );
}

// U 形管：两竖管 + 底部连通横管（用粗圆环下半近似）
function UTube() {
  const glass = (
    <meshPhysicalMaterial color="#eef7ff" transparent opacity={0.22} roughness={0.07} transmission={0.68} ior={1.3} side={2} depthWrite={false} />
  );
  return (
    <group>
      {[-0.6, 0.6].map((x) => (
        <mesh key={x} position={[x, 1.0, 0]}>
          <cylinderGeometry args={[0.2, 0.2, 1.6, 40, 1, true]} />
          {glass}
        </mesh>
      ))}
      {/* 底部连通弯管：半环 */}
      <mesh position={[0, 0.4, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.6, 0.2, 24, 48, Math.PI]} />
        {glass}
      </mesh>
    </group>
  );
}

// U 形管内电解液（两竖管 + 底弯液体近似为两液柱）
function UTubeLiquid() {
  const mat = (
    <meshStandardMaterial color="#dbe7f0" transparent opacity={0.6} roughness={0.12} emissive="#dbe7f0" emissiveIntensity={0.12} />
  );
  return (
    <group>
      {[-0.6, 0.6].map((x) => (
        <mesh key={x} position={[x, 0.95, 0]}>
          <cylinderGeometry args={[0.17, 0.17, 1.4, 32]} />
          {mat}
        </mesh>
      ))}
      <mesh position={[0, 0.4, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.6, 0.16, 20, 40, Math.PI]} />
        {mat}
      </mesh>
    </group>
  );
}

// 电极：插入管内的碳棒，顶端引线颜色区分正负（负极红、正极黑按惯例可调）
function Electrode({ x, negative }: { x: number; negative: boolean }) {
  return (
    <group position={[x, 0, 0]}>
      <mesh position={[0, 1.5, 0]} castShadow>
        <cylinderGeometry args={[0.04, 0.04, 1.4, 16]} />
        <meshStandardMaterial color="#2b2b2e" roughness={0.6} metalness={0.3} />
      </mesh>
      {/* 引线接头 */}
      <mesh position={[0, 2.2, 0]}>
        <sphereGeometry args={[0.06, 16, 16]} />
        <meshStandardMaterial color={negative ? "#3a6fd0" : "#d03a3a"} metalness={0.5} roughness={0.4} />
      </mesh>
    </group>
  );
}

// 直流电源：台面上的小方盒 + 正负接线柱
function PowerSupply() {
  return (
    <group position={[0, 0.35, -1.3]}>
      <mesh castShadow>
        <boxGeometry args={[1.0, 0.6, 0.5]} />
        <meshStandardMaterial color="#3a3f45" roughness={0.6} metalness={0.3} />
      </mesh>
      {[[-0.2, "#d03a3a"], [0.2, "#3a6fd0"]].map(([px, c], i) => (
        <mesh key={i} position={[px as number, 0.15, 0.28]}>
          <cylinderGeometry args={[0.05, 0.05, 0.12, 16]} />
          <meshStandardMaterial color={c as string} metalness={0.6} roughness={0.3} />
        </mesh>
      ))}
    </group>
  );
}
