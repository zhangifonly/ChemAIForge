"use client";

// 铁架台 + 滴定管夹（蝴蝶夹）：铸铁底座、立杆、横向夹臂与双爪。
// 坐标：y=0 为台面，立杆在 x=-0.95 处，夹臂伸向 x=0 夹住滴定管。

const iron = (r = 0.4) => (
  <meshStandardMaterial color="#3c434b" roughness={r} metalness={0.75} />
);

/** 铸铁底座：厚重梯形底板 */
function Base() {
  return (
    <group>
      <mesh position={[0, 0.06, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.1, 0.12, 0.7]} />
        {iron(0.55)}
      </mesh>
      {/* 底板斜边收口，显得厚重 */}
      <mesh position={[0, 0.14, 0]} castShadow>
        <boxGeometry args={[0.9, 0.06, 0.55]} />
        {iron(0.5)}
      </mesh>
    </group>
  );
}

/** 立杆：不锈钢圆杆。需高于滴定管顶（管顶约 y=5.65）才符合实际装配。 */
function Rod({ height = 6.0 }: { height?: number }) {
  return (
    <mesh position={[0, height / 2, 0]} castShadow>
      <cylinderGeometry args={[0.055, 0.055, height, 24]} />
      <meshStandardMaterial color="#aeb6bf" roughness={0.28} metalness={0.9} />
    </mesh>
  );
}

/**
 * 滴定管夹：套在立杆上的夹块 + 伸出的横臂 + 末端两片包胶夹爪。
 * y 为夹持高度，reach 为横臂长度（从立杆伸向滴定管）。
 */
function Clamp({ y, reach }: { y: number; reach: number }) {
  return (
    <group position={[0, y, 0]}>
      {/* 套杆夹块 + 紧固螺丝 */}
      <mesh castShadow>
        <boxGeometry args={[0.22, 0.26, 0.22]} />
        {iron(0.45)}
      </mesh>
      <mesh position={[0, 0, 0.17]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <cylinderGeometry args={[0.035, 0.035, 0.14, 16]} />
        <meshStandardMaterial color="#8b939c" roughness={0.35} metalness={0.85} />
      </mesh>
      {/* 横臂 */}
      <mesh position={[reach / 2, 0, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[0.035, 0.035, reach, 16]} />
        <meshStandardMaterial color="#aeb6bf" roughness={0.3} metalness={0.88} />
      </mesh>
      {/* 末端双爪：以管轴为圆心的两个半环包胶软垫，从前后合抱管身 */}
      <group position={[reach, 0, 0]}>
        {[0, Math.PI].map((rot, i) => (
          <mesh key={i} rotation={[Math.PI / 2, 0, rot]} castShadow>
            <torusGeometry args={[0.135, 0.026, 8, 22, Math.PI * 0.9]} />
            <meshStandardMaterial color="#2f353c" roughness={0.85} metalness={0.1} />
          </mesh>
        ))}
        {/* 爪根连接块 */}
        <mesh position={[-0.06, 0, 0]} castShadow>
          <boxGeometry args={[0.1, 0.1, 0.09]} />
          <meshStandardMaterial color="#3c434b" roughness={0.45} metalness={0.7} />
        </mesh>
      </group>
    </group>
  );
}

/** 完整铁架台：底座在 x=-0.95，夹臂伸到 x=0 夹住滴定管两处 */
export function Stand({ clampYs = [1.5, 2.9] }: { clampYs?: number[] }) {
  const x = -0.95;
  return (
    <group position={[x, 0, 0]}>
      <Base />
      <Rod />
      {clampYs.map((y) => (
        <Clamp key={y} y={y} reach={-x} />
      ))}
    </group>
  );
}
