"use client";

// 铁置换硫酸铜 3D 场景（标杆级）：真实折射玻璃试管 + 硫酸铜蓝液(带液面) + 铁钉。
// 由父组件传入派生状态（规避 R3F 跨 reconciler 订阅失效）。
// 反应：加硫酸铜→深蓝液；加铁→铁钉浸入；混合反应→蓝色渐浅 + 铁钉表面析红铜 + 细碎颗粒。
import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { MeshTransmissionMaterial } from "@react-three/drei";
import type { MeshStandardMaterial, Group, Points } from "three";
import { Color, MathUtils } from "three";

export interface IronCopperProps {
  hasFe: boolean;
  hasLiquid: boolean;
  reacted: boolean;
}

export function IronCopperScene({ hasFe, hasLiquid, reacted }: IronCopperProps) {
  return (
    <group position={[0, -0.5, 0]} scale={0.82}>
      <GlassTube />
      {hasLiquid && <Liquid reacted={reacted} />}
      {hasFe && <IronNail reacted={reacted} />}
      {reacted && <CopperBits />}
      <TubeStand />
    </group>
  );
}

// 真实折射玻璃试管（管壁 + 圆底，MeshTransmissionMaterial）
function GlassTube() {
  return (
    <group>
      <mesh position={[0, 0.7, 0]}>
        <cylinderGeometry args={[0.46, 0.46, 2.6, 64, 1, true]} />
        <MeshTransmissionMaterial
          transmission={1}
          thickness={0.35}
          roughness={0.04}
          ior={1.45}
          chromaticAberration={0.03}
          backside
          backsideThickness={0.2}
          samples={6}
          resolution={512}
          color="#eaf6ff"
          attenuationColor="#d6ecff"
          attenuationDistance={2}
        />
      </mesh>
      {/* 圆底 */}
      <mesh position={[0, -0.6, 0]}>
        <sphereGeometry args={[0.46, 64, 40, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2]} />
        <MeshTransmissionMaterial
          transmission={1}
          thickness={0.35}
          roughness={0.04}
          ior={1.45}
          chromaticAberration={0.03}
          backside
          samples={6}
          resolution={512}
          color="#eaf6ff"
        />
      </mesh>
      {/* 管口圈 */}
      <mesh position={[0, 2.0, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.46, 0.025, 16, 64]} />
        <meshStandardMaterial color="#dfeefb" roughness={0.2} metalness={0.1} transparent opacity={0.6} />
      </mesh>
    </group>
  );
}

// 液体：圆柱液柱 + 顶部液面椭圆（meniscus）；反应后蓝色渐浅
function Liquid({ reacted }: { reacted: boolean }) {
  const bodyMat = useRef<MeshStandardMaterial>(null);
  const surfMat = useRef<MeshStandardMaterial>(null);
  const deep = useMemo(() => new Color("#1f7fc7"), []);
  const faded = useMemo(() => new Color("#cfe6f2"), []);

  useFrame((_, dt) => {
    const target = reacted ? faded : deep;
    const k = Math.min(1, dt * 0.7);
    bodyMat.current?.color.lerp(target, k);
    surfMat.current?.color.lerp(target, k);
  });

  return (
    <group>
      {/* 液柱 */}
      <mesh position={[0, 0.15, 0]}>
        <cylinderGeometry args={[0.42, 0.42, 1.7, 64]} />
        <meshStandardMaterial
          ref={bodyMat}
          color="#1f7fc7"
          transparent
          opacity={0.82}
          roughness={0.18}
          emissive="#1b6aa8"
          emissiveIntensity={0.22}
        />
      </mesh>
      {/* 液面（略微下凹的圆盘 + 高光） */}
      <mesh position={[0, 1.0, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.42, 64]} />
        <meshStandardMaterial
          ref={surfMat}
          color="#2a8fd6"
          transparent
          opacity={0.9}
          roughness={0.08}
          metalness={0.1}
          emissive="#2a8fd6"
          emissiveIntensity={0.15}
        />
      </mesh>
    </group>
  );
}

// 铁钉：金属钉身 + 钉帽；反应后表面渐显红铜层
function IronNail({ reacted }: { reacted: boolean }) {
  const copperMat = useRef<MeshStandardMaterial>(null);
  useFrame((_, dt) => {
    if (copperMat.current) {
      const t = reacted ? 0.96 : 0;
      copperMat.current.opacity = MathUtils.lerp(copperMat.current.opacity, t, Math.min(1, dt * 0.5));
    }
  });
  return (
    <group position={[0.06, 0.35, 0]} rotation={[0, 0, 0.12]}>
      <mesh>
        <cylinderGeometry args={[0.06, 0.045, 1.5, 32]} />
        <meshStandardMaterial color="#9aa3ad" metalness={0.85} roughness={0.35} />
      </mesh>
      <mesh position={[0, 0.8, 0]}>
        <cylinderGeometry args={[0.12, 0.12, 0.07, 32]} />
        <meshStandardMaterial color="#9aa3ad" metalness={0.85} roughness={0.35} />
      </mesh>
      {/* 析出红铜层（渐显，金属铜质感） */}
      <mesh>
        <cylinderGeometry args={[0.075, 0.058, 1.2, 32]} />
        <meshStandardMaterial
          ref={copperMat}
          color="#c9682f"
          metalness={0.7}
          roughness={0.5}
          emissive="#7a3416"
          emissiveIntensity={0.3}
          transparent
          opacity={0}
        />
      </mesh>
    </group>
  );
}

// 析出的铜屑：少量悬浮/沉降的红铜颗粒点
function CopperBits() {
  const pts = useRef<Points>(null);
  const positions = useMemo(() => {
    const arr = new Float32Array(60 * 3);
    for (let i = 0; i < 60; i++) {
      const r = Math.random() * 0.38;
      const a = Math.random() * Math.PI * 2;
      arr[i * 3] = Math.cos(a) * r;
      arr[i * 3 + 1] = -0.5 + Math.random() * 1.3;
      arr[i * 3 + 2] = Math.sin(a) * r;
    }
    return arr;
  }, []);
  useFrame((_, dt) => {
    if (pts.current) pts.current.rotation.y += dt * 0.15;
  });
  return (
    <points ref={pts}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial color="#c9682f" size={0.035} sizeAttenuation transparent opacity={0.85} />
    </points>
  );
}

// 试管架：简洁木质托
function TubeStand() {
  return (
    <group position={[0, -1.05, 0]}>
      <mesh receiveShadow>
        <cylinderGeometry args={[0.6, 0.7, 0.12, 32]} />
        <meshStandardMaterial color="#6b5640" roughness={0.8} />
      </mesh>
    </group>
  );
}
