"use client";

// 量热计 / 保温杯：白色隔热外壳套在内胆外，顶盖留两个孔（温度计 + 搅拌棒）。
// 热效应实验的主体装置——外壳挡住内部，故内胆液体用略高的不透明度以便看清。
export function Calorimeter({ topY = 1.24 }: { topY?: number }) {
  return (
    <group>
      {/* 隔热外壳（略大于烧杯，开口向上） */}
      <mesh position={[0, topY / 2, 0]}>
        <cylinderGeometry args={[0.62, 0.6, topY, 40, 1, true]} />
        <meshStandardMaterial color="#f2f4f6" roughness={0.85} metalness={0.05} side={2} />
      </mesh>
      {/* 外壳底 */}
      <mesh position={[0, 0.02, 0]}>
        <cylinderGeometry args={[0.6, 0.6, 0.04, 40]} />
        <meshStandardMaterial color="#e6e9ec" roughness={0.9} />
      </mesh>
      {/* 顶盖：环形，中间空出让温度计与搅拌棒插入 */}
      <mesh position={[0, topY, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.2, 0.64, 40]} />
        <meshStandardMaterial color="#dfe3e7" roughness={0.8} side={2} />
      </mesh>
      {/* 盖沿 */}
      <mesh position={[0, topY + 0.03, 0]}>
        <cylinderGeometry args={[0.65, 0.65, 0.06, 40, 1, true]} />
        <meshStandardMaterial color="#d6dade" roughness={0.8} side={2} />
      </mesh>
    </group>
  );
}

/** 环形玻璃搅拌棒：量热计标配，插在盖孔里 */
export function StirRing({ bottomY = 0.24, topY = 1.5 }: { bottomY?: number; topY?: number }) {
  const h = Math.max(0.3, topY - bottomY);
  const glass = (
    <meshPhysicalMaterial
      color="#eef7ff"
      transparent
      opacity={0.4}
      roughness={0.06}
      transmission={0.6}
      ior={1.45}
    />
  );
  return (
    <group position={[-0.2, 0, 0.1]}>
      <mesh position={[0, bottomY + h / 2, 0]}>
        <cylinderGeometry args={[0.028, 0.028, h, 14]} />
        {glass}
      </mesh>
      {/* 底端环 */}
      <mesh position={[0, bottomY, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.16, 0.026, 12, 32]} />
        {glass}
      </mesh>
    </group>
  );
}
