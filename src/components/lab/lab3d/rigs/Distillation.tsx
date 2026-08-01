"use client";

// 蒸馏装置：蒸馏烧瓶（由通用场景当作主容器）+ 斜置直形冷凝管 + 右下锥形瓶接收。
// 冷凝管带循环水外套，馏出液在管内下行并滴入接收瓶。
import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import type { Mesh } from "three";

export function Distillation({ running = false }: { running?: boolean }) {
  return (
    <group>
      <Condenser />
      <Receiver />
      {running && <Distillate />}
    </group>
  );
}

/** 冷凝管：内管 + 外水套，向右下倾斜 */
function Condenser() {
  const glass = (
    <meshPhysicalMaterial
      color="#eef7ff"
      transparent
      opacity={0.2}
      roughness={0.06}
      transmission={0.8}
      ior={1.45}
      side={2}
      depthWrite={false}
    />
  );
  return (
    <group position={[1.0, 1.5, 0]} rotation={[0, 0, -0.42]}>
      {/* 外水套 */}
      <mesh rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.17, 0.17, 1.7, 28, 1, true]} />
        {glass}
      </mesh>
      {/* 内管 */}
      <mesh rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.07, 0.07, 2.1, 20, 1, true]} />
        {glass}
      </mesh>
      {/* 进 / 出水口 */}
      {[-0.62, 0.62].map((x) => (
        <mesh key={x} position={[x, 0.19, 0]} rotation={[0, 0, 0.5]}>
          <cylinderGeometry args={[0.045, 0.045, 0.34, 14, 1, true]} />
          {glass}
        </mesh>
      ))}
      {/* 循环水：外套内的淡蓝水体 */}
      <mesh rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.155, 0.155, 1.62, 24]} />
        <meshStandardMaterial color="#a8cfe6" transparent opacity={0.34} roughness={0.2} />
      </mesh>
    </group>
  );
}

/** 接收锥形瓶 */
function Receiver() {
  const glass = (
    <meshPhysicalMaterial
      color="#eef7ff"
      transparent
      opacity={0.18}
      roughness={0.06}
      transmission={0.8}
      ior={1.45}
      side={2}
      depthWrite={false}
    />
  );
  return (
    <group position={[2.2, 0, 0]}>
      <mesh position={[0, 0.42, 0]}>
        <cylinderGeometry args={[0.14, 0.44, 0.84, 32, 1, true]} />
        {glass}
      </mesh>
      <mesh position={[0, 0.02, 0]}>
        <cylinderGeometry args={[0.44, 0.44, 0.04, 32]} />
        <meshPhysicalMaterial color="#eef7ff" transparent opacity={0.3} roughness={0.06} />
      </mesh>
      <mesh position={[0, 0.98, 0]}>
        <cylinderGeometry args={[0.14, 0.14, 0.28, 20, 1, true]} />
        {glass}
      </mesh>
      {/* 已馏出的液体 */}
      <mesh position={[0, 0.16, 0]}>
        <cylinderGeometry args={[0.3, 0.4, 0.24, 28]} />
        <meshStandardMaterial color="#dfeaf2" transparent opacity={0.62} roughness={0.14} />
      </mesh>
    </group>
  );
}

/** 馏出液滴：自冷凝管末端落入接收瓶 */
function Distillate({ fromY = 1.06, toY = 0.34 }: { fromY?: number; toY?: number }) {
  const refs = useRef<(Mesh | null)[]>([]);
  const phase = useMemo(() => [0, 0.5], []);
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    refs.current.forEach((m, i) => {
      if (!m) return;
      const p = (t * 1.1 + phase[i]) % 1;
      m.position.y = fromY - (fromY - toY) * p;
      m.visible = p < 0.94;
    });
  });
  return (
    <group position={[2.2, 0, 0]}>
      {phase.map((_, i) => (
        <mesh key={i} ref={(m) => { refs.current[i] = m; }} position={[0, fromY, 0]}>
          <sphereGeometry args={[0.04, 12, 12]} />
          <meshStandardMaterial color="#e4eef5" transparent opacity={0.85} roughness={0.12} />
        </mesh>
      ))}
    </group>
  );
}
