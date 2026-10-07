"use client";

// 焰色反应 3D 场景：本生灯（体积火焰）、铂丝（带玻璃柄，灼烧时发红热）、
// 白色点滴板（各金属盐溶液）、稀盐酸小烧杯、可举到眼前的蓝色钴玻璃。
// 铂丝在几个位置之间移动：先抬高、平移、再落下，像手拿着一样。
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { LabBench } from "../LabPrimitives";
import { FitPortrait } from "../showcase/FitPortrait";
import { BunsenFlame, type FlameLook } from "./BunsenFlame";
import { BunsenBurner, AcidBeaker, SpotPlate, WELL_POS, CobaltGlass } from "./FlameProps";
import type { Sample } from "./samples";

export type WirePose = "rest" | "flame" | "acid" | Sample;

const BURNER_TOP = 0.75;
const FLAME_H = 0.9;
const TRAVEL_Y = 1.75;
const ACID_POS = new THREE.Vector3(-1.05, 0.32, 0.35);
const POSES: Record<"rest" | "flame", THREE.Vector3> = {
  rest: new THREE.Vector3(0.55, 1.35, 0.55),
  flame: new THREE.Vector3(0.03, BURNER_TOP + FLAME_H * 0.3, 0),
};

function poseTarget(p: WirePose): THREE.Vector3 {
  if (p === "rest" || p === "flame") return POSES[p];
  if (p === "acid") return ACID_POS;
  const [x, z] = WELL_POS[p];
  return new THREE.Vector3(x, 0.08, z);
}

export function FlameScene({
  pose,
  lit,
  cobalt,
  look,
  onInFlame,
}: {
  pose: WirePose;
  lit: boolean;
  cobalt: boolean;
  look: React.MutableRefObject<FlameLook>;
  /** 铂丝环实际进入/离开外焰时回调 —— 灼烧计时以它为准，而不是按钮按下的时刻 */
  onInFlame: (inside: boolean) => void;
}) {
  const wire = useRef<THREE.Group>(null);
  const loopMat = useRef<THREE.MeshStandardMaterial>(null);
  const pos = useRef(POSES.rest.clone());
  const heat = useRef(0);
  const wasIn = useRef(false);
  const wireLocal = useRef(new THREE.Vector3(9, 9, 9));
  const goal = useMemo(() => new THREE.Vector3(), []);

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    const target = poseTarget(pose);
    const p = pos.current;
    const far = Math.hypot(target.x - p.x, target.z - p.z) > 0.04;
    // 水平没到位时先保持在高处，避免铂丝从器皿里"穿"过去
    goal.set(target.x, far ? Math.max(TRAVEL_Y, p.y) : target.y, target.z);
    // 抬升时瞄准略高于巡航高度，指数逼近才能很快越过阈值
    if (far && p.y < TRAVEL_Y - 0.05) goal.set(p.x, TRAVEL_Y + 0.15, p.z);
    p.lerp(goal, 1 - Math.exp(-dt * 7));
    wire.current?.position.copy(p);

    // 铂丝环在火焰局部坐标（底 = 灯管口，高度归一）
    wireLocal.current.set(p.x / FLAME_H, (p.y - BURNER_TOP) / FLAME_H, p.z / FLAME_H);
    const inFlame = lit && Math.hypot(p.x, p.z) < 0.12 && p.y > BURNER_TOP + 0.1 && p.y < BURNER_TOP + FLAME_H;
    if (inFlame !== wasIn.current) {
      wasIn.current = inFlame;
      onInFlame(inFlame);
    }
    heat.current += ((inFlame ? 1 : 0) - heat.current) * (1 - Math.exp(-dt * (inFlame ? 2.5 : 1.2)));
    const m = loopMat.current;
    if (m) {
      // 铂丝红热：黑体色从暗红到橙
      m.emissive.setRGB(1, 0.28 + 0.25 * heat.current, 0.06).multiplyScalar(heat.current * 1.8);
    }
  });

  return (
    <group position={[0, -1.0, 0]}>
      <LabBench />
      <FitPortrait baseFov={40} />
      <BunsenBurner top={BURNER_TOP} />
      <group position={[0, BURNER_TOP, 0]}>
        <BunsenFlame look={look} wireLocal={wireLocal} lit={lit} height={FLAME_H} />
      </group>
      <SpotPlate />
      <AcidBeaker position={[ACID_POS.x, 0, ACID_POS.z]} />
      <group ref={wire}>
        {/* 铂丝末端的小环 */}
        <mesh rotation={[Math.PI / 2, 0, 0.4]}>
          <torusGeometry args={[0.028, 0.006, 8, 24]} />
          <meshStandardMaterial ref={loopMat} color="#d9dde1" metalness={1} roughness={0.25} emissive="#000" />
        </mesh>
        {/* 铂丝 + 玻璃柄：斜向右上方伸出，像被手握着 */}
        <group rotation={[0, 0, -0.85]}>
          <mesh position={[0, 0.2, 0]}>
            <cylinderGeometry args={[0.004, 0.004, 0.36, 6]} />
            <meshStandardMaterial color="#d9dde1" metalness={1} roughness={0.3} />
          </mesh>
          <mesh position={[0, 0.62, 0]} castShadow>
            <cylinderGeometry args={[0.022, 0.022, 0.5, 16]} />
            <meshPhysicalMaterial color="#e9f3f8" transparent opacity={0.45} roughness={0.08} transmission={0.6} />
          </mesh>
        </group>
      </group>
      <CobaltGlass raised={cobalt} flameAt={[0, BURNER_TOP + FLAME_H * 0.25, 0]} />
    </group>
  );
}
