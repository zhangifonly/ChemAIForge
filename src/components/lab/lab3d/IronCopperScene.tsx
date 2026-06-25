"use client";

// 铁置换硫酸铜 3D 场景（标杆级）：真实折射玻璃试管 + 硫酸铜蓝液(带液面) + 铁钉。
// 由父组件传入派生状态（规避 R3F 跨 reconciler 订阅失效）。
// 反应：加硫酸铜→深蓝液；加铁→铁钉浸入；混合反应→蓝色渐浅 + 铁钉表面析红铜 + 细碎颗粒。
import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import type { MeshStandardMaterial, Group, Points } from "three";
import { Color, MathUtils } from "three";

export interface IronCopperProps {
  hasFe: boolean;
  hasLiquid: boolean;
  reacted: boolean;
}

export function IronCopperScene({ hasFe, hasLiquid, reacted }: IronCopperProps) {
  return (
    <group position={[0, -0.95, 0]}>
      {/* 实验室台面与背景 */}
      <LabBench />
      {/* 试管架 + 试管组（抬到台面上） */}
      <group position={[0, 0.12, 0]} scale={0.8}>
        <TubeRack />
        <group position={[0, 0.55, 0]}>
          <GlassTube />
          {hasLiquid && <Liquid reacted={reacted} />}
          {hasFe && <IronNail reacted={reacted} />}
          {reacted && <CopperBits />}
        </group>
      </group>
    </group>
  );
}

// 实验室台面（大桌面）+ 背景墙，营造真实实验室场景
function LabBench() {
  return (
    <group>
      {/* 桌面 */}
      <mesh position={[0, 0, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[14, 10]} />
        <meshStandardMaterial color="#d9d2c4" roughness={0.85} metalness={0.05} />
      </mesh>
      {/* 背景墙 */}
      <mesh position={[0, 3, -3.2]} receiveShadow>
        <planeGeometry args={[16, 9]} />
        <meshStandardMaterial color="#c2cdd6" roughness={1} />
      </mesh>
    </group>
  );
}

// 玻璃试管（管壁 + 圆底）。用半透明物理材质，跨设备/渲染器表现稳定、始终通透
// （MeshTransmissionMaterial 折射在软件渲染或低端设备会退化发黑，故不采用）。
function GlassTube() {
  return (
    <group>
      <mesh position={[0, 0.45, 0]}>
        <cylinderGeometry args={[0.44, 0.44, 2.0, 64, 1, true]} />
        <meshPhysicalMaterial
          color="#eef7ff"
          transparent
          opacity={0.28}
          roughness={0.08}
          metalness={0}
          transmission={0.6}
          ior={1.3}
          side={2}
          depthWrite={false}
        />
      </mesh>
      {/* 圆底 */}
      <mesh position={[0, -0.55, 0]}>
        <sphereGeometry args={[0.44, 64, 40, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2]} />
        <meshPhysicalMaterial
          color="#eef7ff"
          transparent
          opacity={0.28}
          roughness={0.08}
          transmission={0.6}
          ior={1.3}
          side={2}
          depthWrite={false}
        />
      </mesh>
      {/* 管口圈 */}
      <mesh position={[0, 1.45, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.44, 0.028, 16, 64]} />
        <meshStandardMaterial color="#eaf4ff" roughness={0.15} metalness={0.2} transparent opacity={0.85} />
      </mesh>
    </group>
  );
}

// 液体：圆柱液柱 + 顶部液面椭圆（meniscus）；反应后蓝色渐浅
function Liquid({ reacted }: { reacted: boolean }) {
  const bodyMat = useRef<MeshStandardMaterial>(null);
  const surfMat = useRef<MeshStandardMaterial>(null);
  const deep = useMemo(() => new Color("#2f93dd"), []);
  const faded = useMemo(() => new Color("#bfe0f0"), []);

  useFrame((_, dt) => {
    const target = reacted ? faded : deep;
    const k = Math.min(1, dt * 0.7);
    bodyMat.current?.color.lerp(target, k);
    surfMat.current?.color.lerp(target, k);
    if (bodyMat.current) bodyMat.current.emissive.lerp(target, k);
  });

  return (
    <group>
      {/* 液柱（明亮通透的蓝，约占试管下 2/3） */}
      <mesh position={[0, -0.05, 0]}>
        <cylinderGeometry args={[0.4, 0.4, 1.3, 64]} />
        <meshStandardMaterial
          ref={bodyMat}
          color="#2f93dd"
          transparent
          opacity={0.8}
          roughness={0.12}
          emissive="#2f93dd"
          emissiveIntensity={0.5}
        />
      </mesh>
      {/* 液面（圆盘 + 高光） */}
      <mesh position={[0, 0.6, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.4, 64]} />
        <meshStandardMaterial
          ref={surfMat}
          color="#54aee8"
          transparent
          opacity={0.92}
          roughness={0.06}
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
    <group position={[0.05, 0.05, 0]} rotation={[0, 0, 0.1]}>
      <mesh>
        <cylinderGeometry args={[0.055, 0.04, 1.2, 32]} />
        <meshStandardMaterial color="#9aa3ad" metalness={0.85} roughness={0.35} />
      </mesh>
      <mesh position={[0, 0.65, 0]}>
        <cylinderGeometry args={[0.1, 0.1, 0.06, 32]} />
        <meshStandardMaterial color="#9aa3ad" metalness={0.85} roughness={0.35} />
      </mesh>
      {/* 析出红铜层（渐显，金属铜质感） */}
      <mesh>
        <cylinderGeometry args={[0.07, 0.052, 1.0, 32]} />
        <meshStandardMaterial
          ref={copperMat}
          color="#d2691e"
          metalness={0.6}
          roughness={0.45}
          emissive="#b5471a"
          emissiveIntensity={0.5}
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
// 木质试管架：底座 + 立柱 + 带孔顶板，试管插入其中
function TubeRack() {
  return (
    <group position={[0, 0, 0]}>
      {/* 底座 */}
      <mesh position={[0, 0.05, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.5, 0.12, 0.7]} />
        <meshStandardMaterial color="#9a7b4f" roughness={0.75} />
      </mesh>
      {/* 两根立柱 */}
      {[-0.6, 0.6].map((x) => (
        <mesh key={x} position={[x, 0.55, 0]} castShadow>
          <boxGeometry args={[0.1, 1, 0.1]} />
          <meshStandardMaterial color="#9a7b4f" roughness={0.75} />
        </mesh>
      ))}
      {/* 顶板（带圆孔，试管从这里插入） */}
      <mesh position={[0, 1.05, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.5, 0.1, 0.7]} />
        <meshStandardMaterial color="#a8895c" roughness={0.7} />
      </mesh>
      {/* 孔圈装饰 */}
      <mesh position={[0, 1.11, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.3, 0.03, 12, 32]} />
        <meshStandardMaterial color="#7d6238" roughness={0.7} />
      </mesh>
    </group>
  );
}

