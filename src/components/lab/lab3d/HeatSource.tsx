"use client";

// 加热装置：酒精灯 + 跳动的火焰。吸热反应或需加热的实验在器皿下方点燃，
// 让"要加热"这件事在 3D 里看得见，而不是只在文字里写"加热"。
import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { Mesh, PointLight } from "three";

export function HeatSource({ y = 0 }: { y?: number }) {
  const flame = useRef<Mesh>(null);
  const light = useRef<PointLight>(null);

  // 火焰高频轻微缩放 + 光强同步跳动，模拟真实焰心晃动
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const s = 1 + Math.sin(t * 15) * 0.09 + Math.sin(t * 27) * 0.04;
    if (flame.current) {
      flame.current.scale.set(1 + (s - 1) * 0.4, s, 1 + (s - 1) * 0.4);
    }
    if (light.current) light.current.intensity = 1.5 + (s - 1) * 4;
  });

  return (
    <group position={[0, y - 0.62, 0]}>
      {/* 灯座 */}
      <mesh position={[0, 0.11, 0]} castShadow>
        <cylinderGeometry args={[0.19, 0.22, 0.22, 28]} />
        <meshPhysicalMaterial color="#dfe8ee" roughness={0.16} transmission={0.35} ior={1.4} transparent opacity={0.75} />
      </mesh>
      {/* 灯芯座（金属） */}
      <mesh position={[0, 0.25, 0]} castShadow>
        <cylinderGeometry args={[0.055, 0.075, 0.08, 20]} />
        <meshStandardMaterial color="#b0b6bb" roughness={0.4} metalness={0.8} />
      </mesh>
      {/* 外焰（锥形，橙黄半透） */}
      <mesh ref={flame} position={[0, 0.42, 0]}>
        <coneGeometry args={[0.075, 0.3, 20]} />
        <meshBasicMaterial color="#ffb347" transparent opacity={0.72} />
      </mesh>
      {/* 内焰（更亮更小） */}
      <mesh position={[0, 0.36, 0]}>
        <coneGeometry args={[0.04, 0.16, 16]} />
        <meshBasicMaterial color="#9fd8ff" transparent opacity={0.5} />
      </mesh>
      <pointLight ref={light} position={[0, 0.45, 0]} color="#ffb45a" intensity={1.5} distance={2.6} decay={2} />
    </group>
  );
}
