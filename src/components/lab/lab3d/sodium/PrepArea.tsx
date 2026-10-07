"use client";

// 准备区：煤油广口瓶（钠浸在煤油里隔绝空气和水）、滤纸、钠块、小刀、酚酞滴瓶。
// 钠块的新切面一开始是银白金属光泽，暴露在空气里几秒内被氧化成灰白 ——
// 这是"钠很活泼、要保存在煤油中"最直接的证据，切开后用材质插值实时表现。
import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { DropperBottle } from "../LabPrimitives";
import { CM, MAG } from "./shared";
import { radiusCm } from "./model";

const FRESH = new THREE.Color("#eef1f4");
const TARNISHED = new THREE.Color("#9a9c98");
/** 新切面完全失去光泽所需秒数（课堂上约十几秒肉眼可见变暗） */
const TARNISH_S = 12;

export function PrepArea({
  massG,
  cutAt,
  hasPiece,
  phenol,
}: {
  massG: number;
  cutAt: number | null;
  hasPiece: boolean;
  phenol: boolean;
}) {
  const face = useRef<THREE.MeshStandardMaterial>(null);
  useFrame(() => {
    const m = face.current;
    if (!m) return;
    const u = cutAt === null ? 1 : Math.min(1, (performance.now() - cutAt) / 1000 / TARNISH_S);
    m.color.copy(FRESH).lerp(TARNISHED, Math.sqrt(u));
    m.roughness = 0.08 + 0.6 * u;
    m.metalness = 1 - 0.55 * u;
  });

  const s = radiusCm(massG) * CM * MAG * 1.5;
  return (
    <group position={[1.9, 0, 0.3]}>
      {/* 滤纸 */}
      <mesh position={[0, 0.004, 0]} rotation={[-Math.PI / 2, 0, 0.3]} receiveShadow>
        <circleGeometry args={[0.32, 48]} />
        <meshStandardMaterial color="#f7f5ef" roughness={0.95} />
      </mesh>
      {hasPiece && (
        <group position={[0, s * 0.35 + 0.006, 0]}>
          {/* 钠块外皮：氧化层灰白、哑光 */}
          <mesh castShadow position={[-s * 0.06, 0, 0]}>
            <boxGeometry args={[s * 0.88, s * 0.7, s * 0.85]} />
            <meshStandardMaterial color="#a9aba6" roughness={0.75} metalness={0.3} />
          </mesh>
          {/* 新切面：只有切过才出现 */}
          {cutAt !== null && (
            <mesh position={[s * 0.385, 0, 0]}>
              <boxGeometry args={[s * 0.01, s * 0.7, s * 0.85]} />
              <meshStandardMaterial ref={face} color="#eef1f4" metalness={1} roughness={0.08} />
            </mesh>
          )}
        </group>
      )}
      {/* 小刀 */}
      <group position={[0.05, 0.012, 0.36]} rotation={[0, -0.5, 0]}>
        <mesh castShadow>
          <boxGeometry args={[0.36, 0.01, 0.06]} />
          <meshStandardMaterial color="#c9ced3" metalness={0.9} roughness={0.25} />
        </mesh>
        <mesh position={[-0.28, 0.008, 0]} castShadow>
          <boxGeometry args={[0.22, 0.03, 0.07]} />
          <meshStandardMaterial color="#3b2a1d" roughness={0.6} />
        </mesh>
      </group>
      <KeroseneJar />
      <DropperBottle position={[0.15, 0, -0.55]} liquidColor={phenol ? "#f2f2f2" : "#e9eef2"} />
    </group>
  );
}

/** 煤油广口瓶：淡黄透明煤油，底部沉着几块灰色钠 */
function KeroseneJar() {
  return (
    <group position={[0.78, 0, -0.2]}>
      <mesh position={[0, 0.3, 0]} castShadow>
        <cylinderGeometry args={[0.22, 0.22, 0.6, 40, 1, true]} />
        <meshPhysicalMaterial color="#f2f6f8" transparent opacity={0.22} roughness={0.05} transmission={0.7} side={2} depthWrite={false} />
      </mesh>
      <mesh position={[0, 0.2, 0]}>
        <cylinderGeometry args={[0.205, 0.205, 0.38, 40]} />
        <meshStandardMaterial color="#f3e2a2" transparent opacity={0.35} depthWrite={false} />
      </mesh>
      {[[-0.06, 0.05, 0.03], [0.07, 0.045, -0.04], [0.0, 0.04, 0.09]].map((p, i) => (
        <mesh key={i} position={p as [number, number, number]} rotation={[0.3 * i, i, 0]}>
          <boxGeometry args={[0.09, 0.06, 0.08]} />
          <meshStandardMaterial color="#9ea19c" roughness={0.6} metalness={0.4} />
        </mesh>
      ))}
      <mesh position={[0, 0.63, 0]} castShadow>
        <cylinderGeometry args={[0.24, 0.24, 0.06, 40]} />
        <meshStandardMaterial color="#2f3438" roughness={0.5} />
      </mesh>
    </group>
  );
}
