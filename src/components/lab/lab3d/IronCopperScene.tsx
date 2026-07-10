"use client";

// 铁置换硫酸铜 3D 场景：遵循实验仪器定义 [试管, 砂纸, 镊子]。
// 试管架上竖直细长试管 + 硫酸铜蓝液 + 浸入的铁钉；台面摆砂纸(打磨除锈)与镊子(夹取)。
// 反应：蓝色渐浅 + 铁钉表面析红铜 + 铜屑下沉。由父组件传入派生状态。
// 坐标系沿用 LabPrimitives：y=0 为台面，试管内底 TUBE_FLOOR、口 TUBE_RIM_Y。
import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import type { MeshStandardMaterial, Group, Points } from "three";
import { Color, MathUtils } from "three";
import { LabBench, TubeRack, GlassTube, TUBE_R, TUBE_FLOOR } from "./LabPrimitives";

export interface IronCopperProps {
  hasFe: boolean;
  hasLiquid: boolean;
  reacted: boolean;
}

const LIQUID_TOP = 1.45; // 液面高度（试管内偏上）

export function IronCopperScene({ hasFe, hasLiquid, reacted }: IronCopperProps) {
  return (
    <group position={[0, -1.0, 0]}>
      <LabBench />
      <TubeRack />
      <GlassTube />
      {hasLiquid && <Liquid reacted={reacted} />}
      {hasFe && <IronNail reacted={reacted} />}
      {reacted && <CopperBits />}
      {/* 配套仪器：砂纸（打磨铁钉除锈）+ 镊子（夹取铁钉） */}
      <Sandpaper />
      <Tweezers />
    </group>
  );
}

// 液体：试管内蓝色硫酸铜溶液（半球底 + 圆柱，嵌入试管内壁），反应后蓝色渐浅。
function Liquid({ reacted }: { reacted: boolean }) {
  const bodyMat = useRef<MeshStandardMaterial>(null);
  const ballMat = useRef<MeshStandardMaterial>(null);
  const surfMat = useRef<MeshStandardMaterial>(null);
  const deep = useMemo(() => new Color("#2f93dd"), []);
  const faded = useMemo(() => new Color("#cfe6f2"), []);
  const r = TUBE_R * 0.9;
  const bottomCY = TUBE_FLOOR + TUBE_R; // 与试管半球底同心
  const h = LIQUID_TOP - bottomCY;
  const cy = bottomCY + h / 2;

  useFrame((_, dt) => {
    const target = reacted ? faded : deep;
    const k = Math.min(1, dt * 0.7);
    bodyMat.current?.color.lerp(target, k);
    ballMat.current?.color.lerp(target, k);
    surfMat.current?.color.lerp(target, k);
    if (bodyMat.current) bodyMat.current.emissive.lerp(target, k);
    if (ballMat.current) ballMat.current.emissive.lerp(target, k);
  });

  return (
    <group>
      {/* 半球底 */}
      <mesh position={[0, bottomCY, 0]}>
        <sphereGeometry args={[r, 40, 24, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2]} />
        <meshStandardMaterial
          ref={ballMat}
          color="#2f93dd"
          transparent
          opacity={0.82}
          roughness={0.12}
          emissive="#2f93dd"
          emissiveIntensity={0.5}
        />
      </mesh>
      {/* 圆柱体 */}
      <mesh position={[0, cy, 0]}>
        <cylinderGeometry args={[r, r, h, 48]} />
        <meshStandardMaterial
          ref={bodyMat}
          color="#2f93dd"
          transparent
          opacity={0.82}
          roughness={0.12}
          emissive="#2f93dd"
          emissiveIntensity={0.5}
        />
      </mesh>
      {/* 液面 */}
      <mesh position={[0, LIQUID_TOP, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[r, 48]} />
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

// 铁钉：细长竖直浸入试管，钉帽露出液面；反应后浸入段渐显蓬松红铜层。
function IronNail({ reacted }: { reacted: boolean }) {
  const copperMat = useRef<MeshStandardMaterial>(null);
  const copperMesh = useRef<Group>(null);
  // 钉身从管底略上方延伸到液面上方；中心定位
  const bodyH = 1.5;
  const bodyCY = TUBE_FLOOR + 0.05 + bodyH / 2; // ≈0.96
  useFrame((_, dt) => {
    const k = Math.min(1, dt * 0.45);
    if (copperMat.current) {
      copperMat.current.opacity = MathUtils.lerp(copperMat.current.opacity, reacted ? 1 : 0, k);
    }
    if (copperMesh.current) {
      const s = reacted ? 1 : 0.4;
      copperMesh.current.scale.x = MathUtils.lerp(copperMesh.current.scale.x, s, k);
      copperMesh.current.scale.z = MathUtils.lerp(copperMesh.current.scale.z, s, k);
    }
  });
  return (
    <group position={[0.02, 0, 0]} rotation={[0, 0, 0.05]}>
      {/* 钉身 */}
      <mesh position={[0, bodyCY, 0]}>
        <cylinderGeometry args={[0.032, 0.024, bodyH, 24]} />
        <meshStandardMaterial color="#9aa3ad" metalness={0.85} roughness={0.35} />
      </mesh>
      {/* 钉帽（露出液面） */}
      <mesh position={[0, bodyCY + bodyH / 2, 0]}>
        <cylinderGeometry args={[0.06, 0.06, 0.04, 24]} />
        <meshStandardMaterial color="#9aa3ad" metalness={0.85} roughness={0.35} />
      </mesh>
      {/* 析出红铜层（浸入段，反应后加粗显现） */}
      <group ref={copperMesh}>
        <mesh position={[0, TUBE_FLOOR + 0.05 + 0.55, 0]}>
          <cylinderGeometry args={[0.06, 0.045, 1.1, 20]} />
          <meshStandardMaterial
            ref={copperMat}
            color="#c0481f"
            metalness={0.35}
            roughness={0.75}
            emissive="#7a2a10"
            emissiveIntensity={0.35}
            transparent
            opacity={0}
          />
        </mesh>
      </group>
    </group>
  );
}

// 析出的铜屑：红铜颗粒在液中缓缓下沉到管底堆积。
function CopperBits() {
  const pts = useRef<Points>(null);
  const data = useMemo(() => {
    const n = 50;
    const arr = new Float32Array(n * 3);
    const vy = new Float32Array(n);
    const floor = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const rr = Math.random() * (TUBE_R * 0.8);
      const a = Math.random() * Math.PI * 2;
      arr[i * 3] = Math.cos(a) * rr;
      arr[i * 3 + 1] = TUBE_FLOOR + 0.2 + Math.random() * 1.0;
      arr[i * 3 + 2] = Math.sin(a) * rr;
      vy[i] = 0.05 + Math.random() * 0.07;
      floor[i] = TUBE_FLOOR + 0.02 + Math.random() * 0.05;
    }
    return { arr, vy, floor, n };
  }, []);
  useFrame((_, dt) => {
    if (!pts.current) return;
    const pos = pts.current.geometry.attributes.position;
    const a = pos.array as Float32Array;
    for (let i = 0; i < data.n; i++) {
      const yi = i * 3 + 1;
      if (a[yi] > data.floor[i]) a[yi] -= data.vy[i] * dt;
    }
    pos.needsUpdate = true;
    pts.current.rotation.y += dt * 0.08;
  });
  return (
    <points ref={pts}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[data.arr, 3]} />
      </bufferGeometry>
      <pointsMaterial color="#c0481f" size={0.03} sizeAttenuation transparent opacity={0.9} />
    </points>
  );
}

// 砂纸：台面左侧一张磨砂方片（打磨铁钉除锈用）。
function Sandpaper() {
  return (
    <group position={[-1.5, 0.02, 1.0]} rotation={[-Math.PI / 2, 0, 0.3]}>
      <mesh receiveShadow castShadow>
        <boxGeometry args={[0.8, 0.6, 0.02]} />
        <meshStandardMaterial color="#b08552" roughness={0.95} metalness={0.02} />
      </mesh>
    </group>
  );
}

// 镊子：台面右侧一把不锈钢镊子（夹取铁钉用）——两条收拢的金属臂 + 铰接头。
function Tweezers() {
  return (
    <group position={[1.5, 0.04, 0.9]} rotation={[0, -0.5, 0]}>
      {[-0.03, 0.03].map((z, i) => (
        <mesh key={i} position={[0, 0, z]} rotation={[0, 0, Math.PI / 2]} castShadow>
          <cylinderGeometry args={[0.016, 0.009, 1.0, 12]} />
          <meshStandardMaterial color="#c7ccd2" metalness={0.9} roughness={0.25} />
        </mesh>
      ))}
      <mesh position={[0.5, 0, 0]} castShadow>
        <sphereGeometry args={[0.045, 16, 12]} />
        <meshStandardMaterial color="#c7ccd2" metalness={0.9} roughness={0.25} />
      </mesh>
    </group>
  );
}
