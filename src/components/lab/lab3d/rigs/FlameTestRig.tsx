"use client";

// 3D 焰色反应装置：酒精灯 + 铂丝（带小环）伸入外焰，火焰按金属离子呈特征焰色。
// 焰色实验没有液体容器，看点全在火焰颜色，故火焰做两层锥体 + 同色点光源。
import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { Mesh, PointLight } from "three";
import { flameColor } from "@/lib/chem/flameColor";

export function FlameTestRig({ sample, lit = true }: { sample?: string; lit?: boolean }) {
  const c = flameColor(sample);
  return (
    <group>
      <SpiritLampBody />
      {lit && <ColoredFlame color={c.color} outer={c.outer} />}
      <PlatinumWire />
    </group>
  );
}

/** 酒精灯灯体：玻璃座 + 金属灯芯座 */
/** 酒精灯灯体（不含火焰）：焰色装置与蒸发结晶共用，只维护一套造型 */
export function SpiritLampBody() {
  return (
    <group>
      <mesh position={[0, 0.26, 0]} castShadow>
        <cylinderGeometry args={[0.34, 0.4, 0.52, 36]} />
        <meshPhysicalMaterial
          color="#cfe0ea"
          transparent
          opacity={0.42}
          roughness={0.1}
          transmission={0.5}
          ior={1.45}
        />
      </mesh>
      {/* 灯内酒精 */}
      <mesh position={[0, 0.2, 0]}>
        <cylinderGeometry args={[0.3, 0.34, 0.32, 32]} />
        <meshStandardMaterial color="#dfeaf2" transparent opacity={0.55} roughness={0.2} />
      </mesh>
      {/* 灯芯座 */}
      <mesh position={[0, 0.58, 0]}>
        <cylinderGeometry args={[0.13, 0.16, 0.16, 24]} />
        <meshStandardMaterial color="#9aa2aa" metalness={0.75} roughness={0.34} />
      </mesh>
      {/* 灯芯 */}
      <mesh position={[0, 0.68, 0]}>
        <cylinderGeometry args={[0.05, 0.05, 0.08, 16]} />
        <meshStandardMaterial color="#5a5048" roughness={0.9} />
      </mesh>
    </group>
  );
}

/** 双层焰色火焰：外焰宽而暗，内焰窄而亮，随时间摇曳 */
function ColoredFlame({ color, outer }: { color: string; outer: string }) {
  const o = useRef<Mesh>(null);
  const i = useRef<Mesh>(null);
  const light = useRef<PointLight>(null);
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (o.current) o.current.scale.set(1, 1 + Math.sin(t * 11) * 0.09, 1);
    if (i.current) i.current.scale.set(1, 1 + Math.sin(t * 19 + 1.3) * 0.13, 1);
    if (light.current) light.current.intensity = 1.5 + Math.sin(t * 15) * 0.4;
  });
  return (
    <group position={[0, 0.72, 0]}>
      <mesh ref={o} position={[0, 0.34, 0]}>
        <coneGeometry args={[0.17, 0.68, 24]} />
        <meshStandardMaterial
          color={outer}
          emissive={outer}
          emissiveIntensity={1.7}
          transparent
          opacity={0.62}
          depthWrite={false}
        />
      </mesh>
      <mesh ref={i} position={[0, 0.24, 0]}>
        <coneGeometry args={[0.09, 0.44, 20]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={2.6}
          transparent
          opacity={0.9}
          depthWrite={false}
        />
      </mesh>
      <pointLight ref={light} position={[0, 0.4, 0]} color={color} intensity={1.5} distance={3.4} />
    </group>
  );
}

/** 铂丝：细金属丝 + 末端小环，斜插入外焰上部 */
function PlatinumWire() {
  const metal = <meshStandardMaterial color="#dfe3e8" metalness={0.95} roughness={0.15} />;
  return (
    <group position={[0.42, 1.16, 0.1]} rotation={[0, 0, 0.62]}>
      <mesh>
        <cylinderGeometry args={[0.014, 0.014, 0.9, 12]} />
        {metal}
      </mesh>
      {/* 末端小环（蘸取样品处） */}
      <mesh position={[0, -0.46, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.05, 0.012, 10, 24]} />
        {metal}
      </mesh>
      {/* 玻璃柄 */}
      <mesh position={[0, 0.62, 0]}>
        <cylinderGeometry args={[0.045, 0.05, 0.36, 16]} />
        <meshStandardMaterial color="#3a3f46" roughness={0.7} />
      </mesh>
    </group>
  );
}
