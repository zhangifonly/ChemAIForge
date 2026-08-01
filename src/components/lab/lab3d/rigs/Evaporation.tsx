"use client";

// 蒸发结晶：铁圈架住蒸发皿，酒精灯在下加热，水汽向上散去、皿内液面下降、晶体析出。
// 复用现成的酒精灯造型（rigs/FlameTestRig 里的 SpiritLampBody），避免第二套灯。
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { Points } from "three";
import { SpiritLampBody } from "./FlameTestRig";

export interface EvaporationProps {
  /** 蒸发皿口沿高度 */
  rimY: number;
  /** 是否正在加热 */
  heating: boolean;
}

export function Evaporation({ rimY, heating }: EvaporationProps) {
  return (
    <group>
      {/* 铁圈：托住蒸发皿 */}
      <mesh position={[0, rimY - 0.22, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.44, 0.018, 10, 40]} />
        <meshStandardMaterial color="#5b6570" roughness={0.55} metalness={0.5} />
      </mesh>
      {/* 立杆 + 底座 */}
      <mesh position={[0.66, rimY - 0.9, 0]}>
        <cylinderGeometry args={[0.032, 0.032, 1.9, 16]} />
        <meshStandardMaterial color="#4e5762" roughness={0.5} metalness={0.45} />
      </mesh>
      <mesh position={[0.66, rimY - 1.84, 0]}>
        <boxGeometry args={[0.62, 0.05, 0.42]} />
        <meshStandardMaterial color="#3f4753" roughness={0.6} metalness={0.35} />
      </mesh>
      {/* 连接臂 */}
      <mesh position={[0.34, rimY - 0.22, 0]}>
        <boxGeometry args={[0.36, 0.03, 0.03]} />
        <meshStandardMaterial color="#4e5762" roughness={0.5} metalness={0.45} />
      </mesh>
      {/* 酒精灯：放在铁圈下方，火焰高度对准皿底 */}
      <group position={[0, rimY - 1.3, 0]}>
        <SpiritLampBody />
        {heating && <EvapFlame />}
      </group>
      {heating && <Vapor baseY={rimY + 0.05} />}
    </group>
  );
}

/** 蒸发用的普通酒精灯火焰（淡蓝焰心 + 黄外焰） */
function EvapFlame() {
  const ref = useRef<Points>(null);
  void ref;
  return (
    <group position={[0, 0.5, 0]}>
      <mesh>
        <coneGeometry args={[0.09, 0.34, 18]} />
        <meshStandardMaterial
          color="#ffd27a"
          emissive="#ffb347"
          emissiveIntensity={1.5}
          transparent
          opacity={0.7}
        />
      </mesh>
      <mesh position={[0, -0.04, 0]}>
        <coneGeometry args={[0.05, 0.18, 16]} />
        <meshStandardMaterial
          color="#9fd4ff"
          emissive="#7ec0ff"
          emissiveIntensity={1.8}
          transparent
          opacity={0.8}
        />
      </mesh>
      <pointLight color="#ffb347" intensity={1.1} distance={2.2} />
    </group>
  );
}

/** 水蒸气：从皿口向上飘散并逐渐变淡 */
function Vapor({ baseY }: { baseY: number }) {
  const ref = useRef<Points>(null);
  const count = 48;
  const positions = useMemo(() => {
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = Math.random() * 0.3;
      arr[i * 3] = Math.cos(a) * r;
      arr[i * 3 + 1] = baseY + Math.random() * 1.4;
      arr[i * 3 + 2] = Math.sin(a) * r;
    }
    return arr;
  }, [baseY]);

  useFrame((_, dt) => {
    const pts = ref.current;
    if (!pts) return;
    const arr = pts.geometry.attributes.position.array as Float32Array;
    const step = Math.min(dt, 0.05);
    for (let i = 0; i < count; i++) {
      arr[i * 3 + 1] += step * (0.32 + (i % 5) * 0.05);
      if (arr[i * 3 + 1] > baseY + 1.5) arr[i * 3 + 1] = baseY;
    }
    pts.geometry.attributes.position.needsUpdate = true;
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial size={0.09} color="#e8f4f8" transparent opacity={0.34} sizeAttenuation depthWrite={false} />
    </points>
  );
}
