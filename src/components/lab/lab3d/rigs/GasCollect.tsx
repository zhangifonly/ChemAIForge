"use client";

// 集气装置：发生容器（由通用场景渲染）经橡皮塞 + 导管把气体导入右侧集气瓶。
// 集气瓶内气体累积时液面（排水法）下降或瓶内染上气体颜色，给出"收集到了"的反馈。
export interface GasCollectProps {
  /** 导出气体的颜色（无气体传 null，此时只显示空装置） */
  gasColor?: string | null;
  /** 集气瓶内已收集的比例 0~1 */
  filled?: number;
}

export function GasCollect({ gasColor = null, filled = 0 }: GasCollectProps) {
  return (
    <group>
      <Stopper />
      <DeliveryTube />
      <GasJar gasColor={gasColor} filled={filled} />
    </group>
  );
}

/** 橡皮塞：塞在发生容器口 */
function Stopper() {
  return (
    <mesh position={[0, 1.16, 0]}>
      <cylinderGeometry args={[0.42, 0.48, 0.22, 28]} />
      <meshStandardMaterial color="#3f3a36" roughness={0.88} />
    </mesh>
  );
}

/** 导管：自塞子竖直向上再折向右下方伸入集气瓶 */
function DeliveryTube() {
  const glass = (
    <meshPhysicalMaterial
      color="#eef7ff"
      transparent
      opacity={0.34}
      roughness={0.06}
      transmission={0.66}
      ior={1.45}
      side={2}
    />
  );
  return (
    <group>
      {/* 竖直上升段 */}
      <mesh position={[0, 1.52, 0]}>
        <cylinderGeometry args={[0.052, 0.052, 0.56, 16, 1, true]} />
        {glass}
      </mesh>
      {/* 水平横跨段 */}
      <mesh position={[0.82, 1.8, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.052, 0.052, 1.64, 16, 1, true]} />
        {glass}
      </mesh>
      {/* 下插入瓶段 */}
      <mesh position={[1.64, 1.4, 0]}>
        <cylinderGeometry args={[0.052, 0.052, 0.8, 16, 1, true]} />
        {glass}
      </mesh>
    </group>
  );
}

/** 集气瓶：广口玻璃瓶，瓶内气体按 filled 比例自上而下染色 */
function GasJar({ gasColor, filled }: { gasColor: string | null; filled: number }) {
  const H = 1.24;
  const f = Math.min(1, Math.max(0, filled));
  return (
    <group position={[1.64, 0, 0]}>
      {/* 瓶身 */}
      <mesh position={[0, H / 2 + 0.02, 0]}>
        <cylinderGeometry args={[0.42, 0.42, H, 36, 1, true]} />
        <meshPhysicalMaterial
          color="#eef7ff"
          transparent
          opacity={0.16}
          roughness={0.05}
          transmission={0.82}
          ior={1.45}
          side={2}
          depthWrite={false}
        />
      </mesh>
      <mesh position={[0, 0.02, 0]}>
        <cylinderGeometry args={[0.42, 0.42, 0.04, 36]} />
        <meshPhysicalMaterial color="#eef7ff" transparent opacity={0.28} roughness={0.06} />
      </mesh>
      {/* 瓶口磨砂沿 */}
      <mesh position={[0, H + 0.04, 0]}>
        <cylinderGeometry args={[0.45, 0.45, 0.06, 36, 1, true]} />
        <meshStandardMaterial color="#dfe6ea" roughness={0.85} side={2} />
      </mesh>
      {/* 已收集的气体：自瓶底向上填充（气体轻，实际自上而下积，但排水法从上往下压水，
          这里用"上部先染色"更贴近向上排空气法的观感） */}
      {gasColor && f > 0.02 && (
        <mesh position={[0, H + 0.02 - (H * f) / 2, 0]}>
          <cylinderGeometry args={[0.4, 0.4, H * f, 32]} />
          <meshStandardMaterial
            color={gasColor}
            transparent
            opacity={0.34}
            emissive={gasColor}
            emissiveIntensity={0.2}
            depthWrite={false}
          />
        </mesh>
      )}
    </group>
  );
}
