"use client";

// 铁置换硫酸铜 3D 场景：试管 + 硫酸铜蓝色溶液 + 铁钉。
// 由 labStore 驱动：容器内含 铁+硫酸铜 且已混合反应后，铁钉表面渐析红铜、溶液蓝色变浅。
// 仅 3D 呈现，反应判定仍来自引擎结果（labStore.result）。
import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { Group, MeshStandardMaterial } from "three";
import { MathUtils, Color } from "three";

// 由父组件（Canvas 外，能正确订阅 store）传入派生状态，避免 R3F 独立 reconciler
// 下跨 store 订阅失效的问题。
export function IronCopperScene({
  hasFe,
  hasLiquid,
  reacted,
}: {
  hasFe: boolean;
  hasLiquid: boolean;
  reacted: boolean;
}) {
  return (
    <group>
      <TestTube hasLiquid={hasLiquid} reacted={reacted} />
      {hasFe && <IronNail reacted={reacted} />}
    </group>
  );
}

// 试管：玻璃管壁 + 内部液体（蓝→浅蓝随反应渐变）
function TestTube({ hasLiquid, reacted }: { hasLiquid: boolean; reacted: boolean }) {
  const liquidMat = useRef<MeshStandardMaterial>(null);
  // 蓝（硫酸铜）→ 反应后变浅（接近无色淡蓝）
  const deep = new Color("#1f7fc7");
  const faded = new Color("#bcd9ee");

  useFrame((_, dt) => {
    if (!liquidMat.current) return;
    const target = reacted ? faded : deep;
    liquidMat.current.color.lerp(target, Math.min(1, dt * 0.8));
  });

  return (
    <group>
      {/* 玻璃管壁（半透明，不用 transmission 以保证各渲染器一致可见） */}
      <mesh position={[0, 0.6, 0]}>
        <cylinderGeometry args={[0.44, 0.44, 2.4, 48, 1, true]} />
        <meshStandardMaterial color="#cfe6f5" transparent opacity={0.22} roughness={0.1} side={2} />
      </mesh>
      {/* 圆底 */}
      <mesh position={[0, -0.55, 0]}>
        <sphereGeometry args={[0.44, 48, 32, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2]} />
        <meshStandardMaterial color="#cfe6f5" transparent opacity={0.22} roughness={0.1} side={2} />
      </mesh>
      {/* 液体（高饱和蓝，半透明使内部铁钉隐约可见） */}
      {hasLiquid && (
        <mesh position={[0, 0.05, 0]}>
          <cylinderGeometry args={[0.39, 0.39, 1.5, 48]} />
          <meshStandardMaterial
            ref={liquidMat}
            color="#1f7fc7"
            transparent
            opacity={0.85}
            roughness={0.3}
            emissive="#1f6fb0"
            emissiveIntensity={0.4}
          />
        </mesh>
      )}
    </group>
  );
}

// 铁钉：圆柱钉身，反应后表面叠加红铜层
function IronNail({ reacted }: { reacted: boolean }) {
  const copperMat = useRef<MeshStandardMaterial>(null);
  const nail = useRef<Group>(null);

  useFrame((_, dt) => {
    // 红铜层透明度从 0 渐显到 1
    if (copperMat.current) {
      const target = reacted ? 0.95 : 0;
      copperMat.current.opacity = MathUtils.lerp(copperMat.current.opacity, target, Math.min(1, dt * 0.6));
    }
  });

  return (
    <group ref={nail} position={[0, 0.3, 0]} rotation={[0, 0, 0.15]}>
      {/* 钉身（铁灰） */}
      <mesh>
        <cylinderGeometry args={[0.07, 0.05, 1.3, 24]} />
        <meshStandardMaterial color="#8a929c" metalness={0.7} roughness={0.4} />
      </mesh>
      {/* 钉帽 */}
      <mesh position={[0, 0.68, 0]}>
        <cylinderGeometry args={[0.13, 0.13, 0.08, 24]} />
        <meshStandardMaterial color="#8a929c" metalness={0.7} roughness={0.4} />
      </mesh>
      {/* 析出红铜层（渐显，高饱和橙红 + 自发光确保可见） */}
      <mesh>
        <cylinderGeometry args={[0.095, 0.072, 1.05, 24]} />
        <meshStandardMaterial
          ref={copperMat}
          color="#d2622a"
          metalness={0.5}
          roughness={0.45}
          emissive="#a8401a"
          emissiveIntensity={0.4}
          transparent
          opacity={0}
        />
      </mesh>
    </group>
  );
}
