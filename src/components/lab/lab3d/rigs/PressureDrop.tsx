"use client";

// 内压下降：气体被溶液吸收后瓶内压强低于大气压，软塑料瓶被外界大气压瘪。
// 这是初中就在做的经典实验，看点不是颜色也不是气泡，而是"瓶子自己塌下去"——
// 所以核心是瓶身的形变动画：中段被压扁（X 向收缩、Z 向略鼓），瓶口不变。
import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { Group } from "three";

export interface PressureDropProps {
  /** 瓶身中心高度 */
  y: number;
  /** 是否已开始吸收（瓶子逐渐变瘪） */
  collapsing: boolean;
}

export function PressureDrop({ y, collapsing }: PressureDropProps) {
  const bodyRef = useRef<Group>(null);
  const capRef = useRef<Group>(null);

  useFrame((state, dt) => {
    const body = bodyRef.current;
    if (!body) return;
    // 目标形变：瘪到 0.68 倍宽度，同时纵向略微缩短（塑料瓶塌陷时会矮一点）
    const targetX = collapsing ? 0.68 : 1;
    const targetZ = collapsing ? 1.12 : 1;
    const targetY = collapsing ? 0.94 : 1;
    const k = Math.min(1, dt * 1.5);
    body.scale.x += (targetX - body.scale.x) * k;
    body.scale.z += (targetZ - body.scale.z) * k;
    body.scale.y += (targetY - body.scale.y) * k;
    // 塌陷过程中的轻微颤动，模拟塑料回弹发出的"咔咔"感
    if (collapsing) {
      const jitter = Math.sin(state.clock.elapsedTime * 9) * 0.006;
      body.scale.x += jitter;
    }
    // 瓶盖跟着瓶身下沉，避免与瓶口脱开
    if (capRef.current) capRef.current.position.y = 0.86 * body.scale.y;
  });

  return (
    <group position={[0, y, 0]}>
      <group ref={bodyRef}>
        {/* 瓶身：软塑料，半透明泛蓝 */}
        <mesh>
          <cylinderGeometry args={[0.42, 0.46, 1.5, 40, 1, true]} />
          <meshPhysicalMaterial
            color="#dceaf2"
            transparent
            opacity={0.34}
            roughness={0.18}
            transmission={0.7}
            thickness={0.1}
            side={2}
          />
        </mesh>
        {/* 瓶底 */}
        <mesh position={[0, -0.75, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[0.46, 40]} />
          <meshStandardMaterial color="#cfe0ea" transparent opacity={0.42} roughness={0.3} />
        </mesh>
        {/* 瓶肩：向瓶口收窄 */}
        <mesh position={[0, 0.62, 0]}>
          <cylinderGeometry args={[0.14, 0.42, 0.28, 32, 1, true]} />
          <meshPhysicalMaterial
            color="#dceaf2"
            transparent
            opacity={0.34}
            roughness={0.18}
            transmission={0.7}
            side={2}
          />
        </mesh>
        {/* 瓶身中部的一圈加强筋：塑料瓶的标志性细节，也让形变更容易被看出来 */}
        <mesh position={[0, 0, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.44, 0.014, 8, 40]} />
          <meshStandardMaterial color="#b9d2e0" transparent opacity={0.5} roughness={0.4} />
        </mesh>
      </group>
      {/* 瓶盖：拧紧才能形成密闭体系，是这个实验成立的前提 */}
      <group ref={capRef} position={[0, 0.86, 0]}>
        <mesh>
          <cylinderGeometry args={[0.15, 0.15, 0.13, 28]} />
          <meshStandardMaterial color="#3f6ea8" roughness={0.6} />
        </mesh>
      </group>
    </group>
  );
}
