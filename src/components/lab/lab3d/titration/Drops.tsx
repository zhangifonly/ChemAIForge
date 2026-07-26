"use client";

// 逐滴下落的液滴（真球体 InstancedMesh，非朝向相机的贴片）+ 落入液面的扩散涡。
// rate 为滴/秒（0 表示活塞关闭）。每滴自由落体，落到 landY 时触发一次扩散涡。
import { useRef, useMemo, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import type { InstancedMesh, Mesh } from "three";
import { Object3D, MathUtils } from "three";
import { dropsThisFrame } from "./model";

const MAX_DROPS = 24;
const G = 5.2; // 视觉重力

export interface DropsProps {
  /** 滴速：滴/秒，0 为关闭 */
  rate: number;
  /** 出液口高度 */
  fromY: number;
  /** 液面高度（落点） */
  landY: number;
  /** 每落下一滴时回调（父组件据此累加体积） */
  onLand?: () => void;
}

export function Drops({ rate, fromY, landY, onLand }: DropsProps) {
  const inst = useRef<InstancedMesh>(null);
  const dummy = useMemo(() => new Object3D(), []);
  const land = useRef(onLand);
  useEffect(() => {
    land.current = onLand;
  }, [onLand]);

  // 每滴状态：y 位置、速度、是否存活
  const st = useMemo(
    () => ({
      y: new Float32Array(MAX_DROPS),
      v: new Float32Array(MAX_DROPS),
      alive: new Uint8Array(MAX_DROPS),
      acc: 0, // 生成计时器
    }),
    [],
  );

  useFrame((_, dt) => {
    if (!inst.current) return;
    // 物理步长钳制以免掉帧时穿透液面；但生成计时必须用真实 dt，
    // 否则低帧率机器上滴速会被同比例拖慢（实测只剩设定值的三分之一），
    // 相当于"电脑越慢滴定越慢"。上限 0.25s 防止切回标签页时瞬间倾出一堆滴。
    const d = Math.min(dt, 0.05);
    // 按滴速生成新滴（生成量的计算在 model.ts，有单测覆盖帧率解耦）
    const gen = dropsThisFrame(st.acc, dt, rate);
    st.acc = gen.acc;
    for (let k = 0; k < gen.count; k++) {
      const i = st.alive.indexOf(0);
      if (i < 0) break;
      st.alive[i] = 1;
      st.y[i] = fromY;
      st.v[i] = 0;
    }
    // 自由落体推进
    for (let i = 0; i < MAX_DROPS; i++) {
      if (!st.alive[i]) {
        dummy.position.set(0, -99, 0);
        dummy.scale.setScalar(0.001);
      } else {
        st.v[i] += G * d;
        st.y[i] -= st.v[i] * d;
        if (st.y[i] <= landY) {
          st.alive[i] = 0;
          land.current?.();
          dummy.position.set(0, -99, 0);
          dummy.scale.setScalar(0.001);
        } else {
          // 下落中略拉长成水滴形
          dummy.position.set(0, st.y[i], 0);
          dummy.scale.set(1, 1 + Math.min(0.8, st.v[i] * 0.18), 1);
        }
      }
      dummy.updateMatrix();
      inst.current.setMatrixAt(i, dummy.matrix);
    }
    inst.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={inst} args={[undefined, undefined, MAX_DROPS]} frustumCulled={false}>
      <sphereGeometry args={[0.032, 16, 12]} />
      <meshPhysicalMaterial
        color="#dceaf6"
        transparent
        opacity={0.85}
        roughness={0.05}
        transmission={0.6}
        ior={1.4}
      />
    </instancedMesh>
  );
}

/**
 * 滴入点的局部粉红扩散涡：一圈半透明环随每滴滴入而扩张淡出。
 * key 变化（滴数）时重新播放，表现"滴入处先局部变色再摇匀"。
 */
export function DiffusionRing({
  y,
  color = "#e0327d",
  maxR = 0.45,
}: {
  y: number;
  color?: string;
  maxR?: number;
}) {
  const m = useRef<Mesh>(null);
  const t = useRef(0);
  useFrame((_, dt) => {
    if (!m.current) return;
    t.current = Math.min(1, t.current + dt * 1.8);
    const s = MathUtils.lerp(0.15, maxR, t.current);
    m.current.scale.set(s, s, s);
    const mat = m.current.material as { opacity: number };
    mat.opacity = (1 - t.current) * 0.55;
  });
  return (
    <mesh ref={m} position={[0, y + 0.005, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[0.5, 1.0, 32]} />
      <meshBasicMaterial color={color} transparent opacity={0.55} depthWrite={false} />
    </mesh>
  );
}
