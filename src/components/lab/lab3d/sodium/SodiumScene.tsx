"use client";

// 钠与水 3D 场景：结晶皿（车削出壁厚与圆唇）+ 动态水面 + 钠球；
// 右侧是准备区：煤油试剂瓶（钠保存在煤油中）、滤纸上的钠块（切面银白光泽逐渐变暗）。
// 投入时钠块从准备区上方落入水中，溅起一圈冲击波后才开始反应。
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { LabBench } from "../LabPrimitives";
import { FitPortrait } from "../showcase/FitPortrait";
import { glassMaterial } from "../Vessels";
import { WaterSurface } from "./WaterSurface";
import { SodiumBall } from "./SodiumBall";
import { PrepArea } from "./PrepArea";
import { DISH, newMotion, CM, MAG } from "./shared";
import { phenolphthaleinPink, radiusCm, type SodiumReadings } from "./model";

export type SodiumPhase = "prep" | "falling" | "reacting" | "done";

export interface SodiumSceneProps {
  phase: SodiumPhase;
  readings: SodiumReadings;
  massG: number;
  phenol: boolean;
  /** 切下钠块的时刻（performance.now 毫秒）；null 表示还没切 */
  cutAt: number | null;
  meltT: number;
  onLanded: () => void;
}

const DROP_FROM: [number, number, number] = [1.9, 1.5, 0.3];
const DROP_S = 0.75;

export function SodiumScene(p: SodiumSceneProps) {
  const motion = useRef(newMotion());
  const block = useRef<THREE.Group>(null);
  const fallT = useRef(0);
  const landed = useRef(false);

  useFrame((_, rawDt) => {
    const g = block.current;
    if (!g) return;
    if (p.phase !== "falling") {
      fallT.current = 0;
      landed.current = false;
      g.visible = false;
      return;
    }
    // 镊子夹着钠块沿抛物线移到杯中央上方再松开
    fallT.current += Math.min(rawDt, 0.05);
    const u = Math.min(1, fallT.current / DROP_S);
    const m = motion.current;
    const ex = 0.15, ez = 0.1;
    g.visible = true;
    g.position.set(
      THREE.MathUtils.lerp(DROP_FROM[0], ex, u),
      THREE.MathUtils.lerp(DROP_FROM[1], DISH.water, u * u) + Math.sin(u * Math.PI) * 0.35,
      THREE.MathUtils.lerp(DROP_FROM[2], ez, u),
    );
    g.rotation.set(u * 2.4, u * 1.3, 0);
    if (u >= 1 && !landed.current) {
      landed.current = true;
      Object.assign(m, newMotion(), { x: ex, z: ez, splash: 1 });
      p.onLanded();
    }
  });

  const blockSize = radiusCm(p.massG) * CM * MAG * 1.5;
  const pinkAll = phenolphthaleinPink(p.readings.ph);
  const showBall = p.phase === "reacting" || p.phase === "done";

  return (
    <group position={[0, -1.0, 0]}>
      <LabBench />
      <FitPortrait baseFov={42} />
      <Dish />
      <WaterBody pink={p.phenol ? pinkAll : 0} />
      <WaterSurface motion={motion} pinkAll={pinkAll} phenol={p.phenol} />
      {showBall && <SodiumBall motion={motion} r={p.readings} meltT={p.meltT} />}
      <group ref={block} visible={false}>
        <mesh castShadow>
          <boxGeometry args={[blockSize, blockSize * 0.7, blockSize * 0.85]} />
          <meshStandardMaterial color="#b9bdc2" metalness={0.85} roughness={0.35} />
        </mesh>
      </group>
      <PrepArea massG={p.massG} cutAt={p.cutAt} hasPiece={p.phase === "prep"} phenol={p.phenol} />
    </group>
  );
}

/** 结晶皿：车削轮廓（外壁 → 圆唇 → 内壁 → 内底），玻璃有真实壁厚，侧面能看到厚度的高光边 */
function Dish() {
  const geom = useMemo(() => {
    const { r, h, wall } = DISH;
    const pts: THREE.Vector2[] = [new THREE.Vector2(r + wall - 0.05, 0)];
    // 外底圆角
    for (let i = 0; i <= 6; i++) {
      const a = (-Math.PI / 2) * (1 - i / 6);
      pts.push(new THREE.Vector2(r + wall - 0.05 + Math.cos(a) * 0.05, 0.05 + Math.sin(a) * 0.05));
    }
    pts.push(new THREE.Vector2(r + wall, h));
    // 圆唇
    for (let i = 1; i < 8; i++) {
      const a = (Math.PI * i) / 8;
      pts.push(new THREE.Vector2(r + wall / 2 + (Math.cos(a) * wall) / 2, h + Math.sin(a) * wall * 0.6));
    }
    pts.push(new THREE.Vector2(r, h), new THREE.Vector2(r, wall + 0.04), new THREE.Vector2(r - 0.04, wall));
    return new THREE.LatheGeometry(pts, 96);
  }, []);
  // 车削轮廓不经过轴线：轴上那一圈顶点法线退化，透明玻璃底会出现放射状条纹。底板单独用圆片
  return (
    <group>
      <mesh geometry={geom} renderOrder={3}>{glassMaterial()}</mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, DISH.wall, 0]} renderOrder={3}>
        <circleGeometry args={[DISH.r - 0.035, 96]} />
        {glassMaterial()}
      </mesh>
    </group>
  );
}

/** 水体：略带蓝绿的透明体，整体酚酞显色时变粉红 */
function WaterBody({ pink }: { pink: number }) {
  const mat = useRef<THREE.MeshPhysicalMaterial>(null);
  const clear = useMemo(() => new THREE.Color("#cfe6ee"), []);
  const magenta = useMemo(() => new THREE.Color("#e8508f"), []);
  useFrame((_, dt) => {
    const m = mat.current;
    if (!m) return;
    // 整杯变红要等 NaOH 扩散开（十几秒量级），比钠球身后的红迹慢得多
    m.color.lerp(clear.clone().lerp(magenta, Math.min(1, pink * 0.85)), 1 - Math.exp(-Math.min(dt, 0.1) / 10));
    m.opacity = 0.22 + pink * 0.35;
  });
  const h = DISH.water - DISH.wall;
  return (
    <mesh position={[0, DISH.wall + h / 2, 0]} renderOrder={1}>
      <cylinderGeometry args={[DISH.r - 0.004, DISH.r - 0.004, h, 96, 1, true]} />
      <meshPhysicalMaterial ref={mat} transparent opacity={0.22} roughness={0.1} transmission={0.3} side={THREE.DoubleSide} depthWrite={false} />
    </mesh>
  );
}
