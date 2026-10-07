"use client";

// 焰色反应场景的静态器材：本生灯、点滴板、盐酸小烧杯、钴玻璃。
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import * as THREE from "three";
import { glassMaterial } from "../Vessels";
import { SAMPLES, FORMULA, SOLUTION_COLOR, type Sample } from "./samples";

/** 点滴板孔位（x, z）：两排四孔，摆在灯的右前方 */
export const WELL_POS = Object.fromEntries(
  SAMPLES.map((s, i) => [s, [0.75 + (i % 4) * 0.2, 0.45 + Math.floor(i / 4) * 0.22]]),
) as Record<Sample, [number, number]>;

export function BunsenBurner({ top }: { top: number }) {
  const metal = <meshStandardMaterial color="#9aa3ab" metalness={0.85} roughness={0.32} />;
  return (
    <group>
      <mesh position={[0, 0.03, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.2, 0.23, 0.06, 40]} />
        <meshStandardMaterial color="#2b2f33" metalness={0.5} roughness={0.5} />
      </mesh>
      <mesh position={[0, top / 2, 0]} castShadow>
        <cylinderGeometry args={[0.042, 0.048, top - 0.04, 24]} />
        {metal}
      </mesh>
      {/* 空气调节环：开着进风孔，所以是蓝色预混火焰 */}
      <mesh position={[0, 0.16, 0]} castShadow>
        <cylinderGeometry args={[0.058, 0.058, 0.08, 24]} />
        <meshStandardMaterial color="#c0a062" metalness={0.9} roughness={0.3} />
      </mesh>
      {/* 进气嘴 + 橡胶管 */}
      <mesh position={[-0.13, 0.08, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[0.018, 0.018, 0.16, 12]} />
        {metal}
      </mesh>
      <mesh position={[-0.55, 0.035, 0.05]} rotation={[0, 0.1, Math.PI / 2]}>
        <cylinderGeometry args={[0.03, 0.03, 0.7, 14]} />
        <meshStandardMaterial color="#b9442c" roughness={0.8} />
      </mesh>
    </group>
  );
}

export function SpotPlate() {
  const xs = SAMPLES.map((s) => WELL_POS[s][0]);
  const zs = SAMPLES.map((s) => WELL_POS[s][1]);
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2, cz = (Math.min(...zs) + Math.max(...zs)) / 2;
  return (
    <group>
      <mesh position={[cx, 0.035, cz]} castShadow receiveShadow>
        <boxGeometry args={[0.84, 0.07, 0.5]} />
        <meshPhysicalMaterial color="#fbfbf8" roughness={0.25} clearcoat={0.8} />
      </mesh>
      {SAMPLES.map((s) => (
        <group key={s} position={[WELL_POS[s][0], 0.071, WELL_POS[s][1]]}>
          <mesh rotation={[-Math.PI / 2, 0, 0]}>
            <circleGeometry args={[0.07, 32]} />
            <meshPhysicalMaterial color={SOLUTION_COLOR[s]} roughness={0.05} clearcoat={1} />
          </mesh>
          <Html position={[0, 0.02, 0.1]} center zIndexRange={[5, 0]} style={{ pointerEvents: "none" }}>
            <span className="whitespace-nowrap rounded bg-black/55 px-1 font-mono text-[10px] text-white">{FORMULA[s]}</span>
          </Html>
        </group>
      ))}
    </group>
  );
}

export function AcidBeaker({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh position={[0, 0.22, 0]} renderOrder={3}>
        <cylinderGeometry args={[0.15, 0.15, 0.44, 32, 1, true]} />
        {glassMaterial()}
      </mesh>
      <mesh position={[0, 0.15, 0]}>
        <cylinderGeometry args={[0.14, 0.14, 0.3, 32]} />
        <meshStandardMaterial color="#eaf3f7" transparent opacity={0.35} depthWrite={false} />
      </mesh>
      <Html position={[0, 0.5, 0]} center zIndexRange={[5, 0]} style={{ pointerEvents: "none" }}>
        <span className="whitespace-nowrap rounded bg-black/55 px-1 font-mono text-[10px] text-white">HCl</span>
      </Html>
    </group>
  );
}

/**
 * 钴玻璃：举起时停在"火焰与相机连线"上靠近相机的位置并正对相机，
 * 无论怎么转视角都挡在眼前；放下时退到台面右侧。
 * 玻璃本身是深蓝半透明：透过它看，整个场景都偏蓝，正如真实观察。
 */
export function CobaltGlass({ raised, flameAt }: { raised: boolean; flameAt: [number, number, number] }) {
  const g = useRef<THREE.Group>(null);
  const k = useRef(0);
  const flame = useMemo(() => new THREE.Vector3(...flameAt), [flameAt]);
  const rest = useMemo(() => new THREE.Vector3(1.55, 0.2, -0.1), []);
  const cam = useMemo(() => new THREE.Vector3(), []);
  const yAxis = useMemo(() => new THREE.Vector3(0, 1, 0), []);
  const q = useMemo(() => new THREE.Quaternion(), []);
  const restQ = useMemo(() => new THREE.Quaternion().setFromEuler(new THREE.Euler(-1.2, 0.3, 0)), []);
  const m4 = useMemo(() => new THREE.Matrix4(), []);

  useFrame((state, rawDt) => {
    const o = g.current;
    if (!o?.parent) return;
    k.current += ((raised ? 1 : 0) - k.current) * (1 - Math.exp(-Math.min(rawDt, 0.05) * 5));
    o.parent.worldToLocal(cam.copy(state.camera.position));
    // 举起位置：连线上距相机 0.55 处
    const held = cam.clone().lerp(flame, 1 - 0.55 / Math.max(0.6, cam.distanceTo(flame)));
    o.position.copy(rest).lerp(held, k.current);
    m4.lookAt(cam, held, yAxis);
    q.setFromRotationMatrix(m4);
    o.quaternion.copy(restQ).slerp(q, k.current);
  });

  return (
    <group ref={g}>
      <mesh renderOrder={20}>
        <boxGeometry args={[0.56, 0.5, 0.01]} />
        <meshPhysicalMaterial color="#1e3bd6" transparent opacity={0.62} roughness={0.05} metalness={0} depthWrite={false} />
      </mesh>
    </group>
  );
}
