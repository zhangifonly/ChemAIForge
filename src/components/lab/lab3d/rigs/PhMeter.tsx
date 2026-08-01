"use client";

// pH 计：探头插入液中，机身液晶屏显示读数。
// 缓冲液实验的全部看点就在这块屏上——加入少量酸碱后读数只微动，
// 与纯水中 pH 剧烈跳变形成对比，所以读数必须真的随环境平滑变化。
import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Text } from "@react-three/drei";
import type { Mesh, MeshStandardMaterial } from "three";

export interface PhMeterProps {
  /** 探头浸入的深度基准（液面 Y） */
  liquidY: number;
  /** 目标 pH 读数 */
  ph: number;
  /** 是否已开机 */
  on: boolean;
}

/** pH → 屏幕数字颜色：酸红、中绿、碱蓝，与试纸色阶直觉一致 */
function phColor(ph: number): string {
  if (ph < 6) return "#ff6b52";
  if (ph > 8) return "#5aa8ff";
  return "#6fe08a";
}

export function PhMeter({ liquidY, ph, on }: PhMeterProps) {
  const shown = useRef(ph);
  const textRef = useRef<{ text: string }>(null);
  const lampRef = useRef<Mesh>(null);
  const x = 0.62;

  // 读数平滑趋近：真实 pH 计响应有滞后，瞬间跳数字反而不像仪器
  useFrame((_, dt) => {
    shown.current += (ph - shown.current) * Math.min(1, dt * 1.8);
    const t = textRef.current;
    if (t) t.text = on ? shown.current.toFixed(2) : "----";
    const lamp = lampRef.current;
    if (lamp) {
      const m = lamp.material as MeshStandardMaterial;
      m.emissiveIntensity = on ? 1.4 : 0.04;
    }
  });

  return (
    <group>
      {/* 探头：玻璃电极，斜插入液面下 */}
      <group position={[x, liquidY - 0.18, 0]} rotation={[0, 0, 0.22]}>
        <mesh>
          <cylinderGeometry args={[0.032, 0.032, 0.7, 20]} />
          <meshStandardMaterial color="#eef4f7" roughness={0.1} transparent opacity={0.85} />
        </mesh>
        {/* 敏感球泡：pH 计探头末端的标志性半球 */}
        <mesh position={[0, -0.36, 0]}>
          <sphereGeometry args={[0.036, 20, 14]} />
          <meshStandardMaterial color="#cfe0ea" roughness={0.05} metalness={0.15} />
        </mesh>
      </group>
      {/* 导线：探头连到机身 */}
      <mesh position={[x + 0.18, liquidY + 0.36, 0]} rotation={[0, 0, -0.5]}>
        <cylinderGeometry args={[0.012, 0.012, 0.6, 10]} />
        <meshStandardMaterial color="#2c3238" roughness={0.7} />
      </mesh>
      {/* 机身 */}
      <group position={[x + 0.52, liquidY + 0.5, 0]} rotation={[0, -0.35, 0]}>
        <mesh>
          <boxGeometry args={[0.42, 0.62, 0.14]} />
          <meshStandardMaterial color="#37424a" roughness={0.55} />
        </mesh>
        {/* 液晶屏 */}
        <mesh position={[0, 0.12, 0.075]}>
          <boxGeometry args={[0.34, 0.22, 0.01]} />
          <meshStandardMaterial color="#0d1a14" roughness={0.25} />
        </mesh>
        <Text
          ref={textRef as never}
          position={[0, 0.12, 0.088]}
          fontSize={0.11}
          color={phColor(ph)}
          anchorX="center"
          anchorY="middle"
        >
          {on ? ph.toFixed(2) : "----"}
        </Text>
        <Text position={[0, -0.06, 0.078]} fontSize={0.055} color="#9fb0bb" anchorX="center">
          pH
        </Text>
        {/* 电源指示灯 */}
        <mesh ref={lampRef} position={[0.14, -0.22, 0.078]}>
          <sphereGeometry args={[0.022, 14, 10]} />
          <meshStandardMaterial color="#6fe08a" emissive="#6fe08a" emissiveIntensity={0.04} />
        </mesh>
      </group>
    </group>
  );
}
