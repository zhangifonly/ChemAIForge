"use client";

// 3D 实验台通用基础元件：实验室台面、木质试管架、玻璃试管、通用液柱。
// 供各 3D 实验场景复用，统一观感与材质策略。
// 玻璃试管 / 试管架优先加载 public/models/lab 下的专业 glTF 模型，缺失则回退程序化几何。
import { ModelOrFallback } from "./ModelOrFallback";

// 实验室台面（大桌面）+ 背景墙
export function LabBench() {
  return (
    <group>
      <mesh position={[0, 0, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[14, 10]} />
        <meshStandardMaterial color="#d9d2c4" roughness={0.85} metalness={0.05} />
      </mesh>
      <mesh position={[0, 3, -3.2]} receiveShadow>
        <planeGeometry args={[16, 9]} />
        <meshStandardMaterial color="#c2cdd6" roughness={1} />
      </mesh>
    </group>
  );
}

// 木质试管架：优先加载模型，缺失回退程序化几何
export function TubeRack() {
  return (
    <ModelOrFallback url="/models/lab/tube-rack.glb" fallback={<ProceduralTubeRack />} />
  );
}

function ProceduralTubeRack() {
  return (
    <group>
      <mesh position={[0, 0.05, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.5, 0.12, 0.7]} />
        <meshStandardMaterial color="#9a7b4f" roughness={0.75} />
      </mesh>
      {[-0.6, 0.6].map((x) => (
        <mesh key={x} position={[x, 0.55, 0]} castShadow>
          <boxGeometry args={[0.1, 1, 0.1]} />
          <meshStandardMaterial color="#9a7b4f" roughness={0.75} />
        </mesh>
      ))}
      <mesh position={[0, 1.05, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.5, 0.1, 0.7]} />
        <meshStandardMaterial color="#a8895c" roughness={0.7} />
      </mesh>
      <mesh position={[0, 1.11, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.3, 0.03, 12, 32]} />
        <meshStandardMaterial color="#7d6238" roughness={0.7} />
      </mesh>
    </group>
  );
}

// 玻璃试管：优先加载模型，缺失回退程序化几何
export function GlassTube() {
  return (
    <ModelOrFallback url="/models/lab/test-tube.glb" fallback={<ProceduralGlassTube />} />
  );
}

function ProceduralGlassTube() {
  const glass = (
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
  );
  return (
    <group>
      <mesh position={[0, 0.45, 0]}>
        <cylinderGeometry args={[0.44, 0.44, 2.0, 64, 1, true]} />
        {glass}
      </mesh>
      <mesh position={[0, -0.55, 0]}>
        <sphereGeometry args={[0.44, 64, 40, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2]} />
        {glass}
      </mesh>
      <mesh position={[0, 1.45, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.44, 0.028, 16, 64]} />
        <meshStandardMaterial color="#eaf4ff" roughness={0.15} metalness={0.2} transparent opacity={0.85} />
      </mesh>
    </group>
  );
}

// 通用液柱（静态色，不随反应变化）：供无变色需求的场景使用
export function LiquidColumn({ color = "#cfe0ec" }: { color?: string }) {
  return (
    <group>
      <mesh position={[0, -0.05, 0]}>
        <cylinderGeometry args={[0.4, 0.4, 1.3, 64]} />
        <meshStandardMaterial color={color} transparent opacity={0.78} roughness={0.14} emissive={color} emissiveIntensity={0.35} />
      </mesh>
      <mesh position={[0, 0.6, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.4, 64]} />
        <meshStandardMaterial color={color} transparent opacity={0.9} roughness={0.06} metalness={0.1} />
      </mesh>
    </group>
  );
}
