"use client";

// 直流电源 / 电压表：装置类实验的"通电"硬件。
// 通电时电源指示灯亮、电压表指针偏转，给出明确的"我按了开关"反馈。
import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { Mesh, MeshStandardMaterial } from "three";

/** 直流电源：黑色机箱 + 红黑接线柱 + 通电指示灯 */
export function PowerSupply({ y = 1.9, on = false }: { y?: number; on?: boolean }) {
  const lamp = useRef<MeshStandardMaterial>(null);
  useFrame(({ clock }) => {
    if (!lamp.current) return;
    // 通电时指示灯做轻微呼吸，比常亮更像真实设备
    const t = clock.getElapsedTime();
    lamp.current.emissiveIntensity = on ? 1.6 + Math.sin(t * 4) * 0.35 : 0.05;
  });
  return (
    <group position={[0, y, -0.15]}>
      <mesh castShadow>
        <boxGeometry args={[0.86, 0.34, 0.32]} />
        <meshStandardMaterial color="#25282d" metalness={0.35} roughness={0.55} />
      </mesh>
      {/* 面板 */}
      <mesh position={[0, 0, 0.165]}>
        <boxGeometry args={[0.8, 0.26, 0.01]} />
        <meshStandardMaterial color="#3a3f46" roughness={0.7} />
      </mesh>
      {/* 接线柱：左负(黑) 右正(红) */}
      <mesh position={[-0.26, -0.12, 0.1]}>
        <cylinderGeometry args={[0.045, 0.045, 0.1, 16]} />
        <meshStandardMaterial color="#1a1c1f" roughness={0.5} />
      </mesh>
      <mesh position={[0.26, -0.12, 0.1]}>
        <cylinderGeometry args={[0.045, 0.045, 0.1, 16]} />
        <meshStandardMaterial color="#c02b23" roughness={0.5} />
      </mesh>
      {/* 通电指示灯 */}
      <mesh position={[0.3, 0.07, 0.175]}>
        <sphereGeometry args={[0.045, 16, 16]} />
        <meshStandardMaterial
          ref={lamp}
          color={on ? "#ff5a4a" : "#5a3a38"}
          emissive="#ff4a38"
          emissiveIntensity={on ? 1.6 : 0.05}
        />
      </mesh>
      {on && <pointLight position={[0.3, 0.07, 0.4]} intensity={0.5} distance={1.2} color="#ff7a5a" />}
    </group>
  );
}

/** 电压表：圆表盘 + 指针，通电时指针偏转到读数位置 */
export function Voltmeter({ y = 1.9, on = false }: { y?: number; on?: boolean }) {
  const needle = useRef<Mesh>(null);
  useFrame(({ clock }) => {
    if (!needle.current) return;
    const t = clock.getElapsedTime();
    // 偏转 + 轻微抖动，静止时归零
    const target = on ? -0.7 + Math.sin(t * 3) * 0.03 : 0.9;
    needle.current.rotation.z += (target - needle.current.rotation.z) * 0.08;
  });
  return (
    <group position={[0, y, -0.15]}>
      {/* 表体：圆柱默认沿 Y 轴，绕 X 转 90° 才是"表盘朝向观察者" */}
      <mesh castShadow rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.34, 0.34, 0.14, 32]} />
        <meshStandardMaterial color="#e6e9ec" roughness={0.5} />
      </mesh>
      {/* 表盘 */}
      <mesh position={[0, 0, 0.075]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.3, 0.3, 0.01, 32]} />
        <meshStandardMaterial color="#fbfcfd" roughness={0.8} />
      </mesh>
      {/* 指针：绕表盘中心旋转 */}
      <mesh ref={needle} position={[0, 0, 0.09]}>
        <boxGeometry args={[0.022, 0.26, 0.012]} />
        <meshStandardMaterial color="#1a1c1f" roughness={0.5} />
      </mesh>
      <mesh position={[0, 0, 0.1]}>
        <sphereGeometry args={[0.035, 12, 12]} />
        <meshStandardMaterial color="#33383d" metalness={0.6} roughness={0.4} />
      </mesh>
    </group>
  );
}
