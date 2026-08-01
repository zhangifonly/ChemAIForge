"use client";

// 温度计：玻璃管 + 液柱 + 球泡。液柱高度随温度变化（0~100℃ 映射到管长），
// 让热效应实验（中和热 / 溶解热 / 冷敷袋）有可读的 3D 反馈。
import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { Mesh } from "three";

const T_MIN = -10;
const T_MAX = 110;

export interface ThermometerProps {
  /** 球泡所在高度（浸入液中） */
  bulbY: number;
  /** 管顶高度 */
  topY: number;
  x?: number;
  z?: number;
  /** 当前温度（摄氏度） */
  temperature: number;
}

export function Thermometer({ bulbY, topY, x = 0.24, z = 0.16, temperature }: ThermometerProps) {
  const col = useRef<Mesh>(null);
  const h = Math.max(0.3, topY - bulbY);
  const frac = Math.min(1, Math.max(0.03, (temperature - T_MIN) / (T_MAX - T_MIN)));

  useFrame(() => {
    if (!col.current) return;
    // 液柱用缩放模拟上升，并同步位移让底端固定在球泡处
    const target = frac;
    const cur = col.current.scale.y;
    const next = cur + (target - cur) * 0.12;
    col.current.scale.y = next;
    col.current.position.y = bulbY + (h * next) / 2;
  });

  return (
    <group position={[x, 0, z]}>
      {/* 玻璃管 */}
      <mesh position={[0, bulbY + h / 2, 0]}>
        <cylinderGeometry args={[0.042, 0.042, h, 18, 1, true]} />
        <meshPhysicalMaterial
          color="#eef7ff"
          transparent
          opacity={0.3}
          roughness={0.06}
          transmission={0.7}
          ior={1.45}
          side={2}
          depthWrite={false}
        />
      </mesh>
      {/* 水银 / 红色液柱 */}
      <mesh ref={col} position={[0, bulbY + h / 2, 0]}>
        <cylinderGeometry args={[0.022, 0.022, h, 14]} />
        <meshStandardMaterial color="#d2352b" emissive="#8f1a12" emissiveIntensity={0.25} />
      </mesh>
      {/* 球泡 */}
      <mesh position={[0, bulbY, 0]}>
        <sphereGeometry args={[0.055, 20, 20]} />
        <meshStandardMaterial color="#d2352b" emissive="#8f1a12" emissiveIntensity={0.3} />
      </mesh>
    </group>
  );
}
