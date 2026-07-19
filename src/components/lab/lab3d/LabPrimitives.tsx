"use client";

// 3D 实验台通用基础元件：实验室台面、试管架、细长玻璃试管、通用液柱。
// 统一坐标系：本文件所有元件以 y=0 为台面，竖直向上为正；试管竖直插在架中。
// 试管/试管架用程序化几何（真实 glTF 模型接入参见历史烧杯做法）。

// —— 统一尺寸常量（供各场景对齐液体/金属/气泡） ——
export const TUBE_R = 0.2; // 试管内壁半径（细长）
export const TUBE_FLOOR = 0.16; // 试管内底（液体/沉淀堆积起点）
export const TUBE_RIM_Y = 2.0; // 试管口高度

// 实验室台面（大桌面）+ 背景墙
export function LabBench() {
  return (
    <group>
      <mesh position={[0, 0, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[14, 10]} />
        <meshStandardMaterial color="#d9d2c4" roughness={0.85} metalness={0.05} />
      </mesh>
      <mesh position={[0, 3, -3.2]} receiveShadow>
        <planeGeometry args={[16, 9]} />
        <meshStandardMaterial color="#c2cdd6" roughness={1} />
      </mesh>
    </group>
  );
}

// 木质试管架：底座 + 两立柱 + 顶部带孔板，细长试管从孔中穿过、底部落在底座上。
export function TubeRack() {
  const wood = (r = 0.72) => <meshStandardMaterial color="#9a7b4f" roughness={r} />;
  return (
    <group>
      {/* 底座（试管底落于其上） */}
      <mesh position={[0, 0.06, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.0, 0.12, 0.5]} />
        {wood(0.8)}
      </mesh>
      {/* 两侧立柱 */}
      {[-0.42, 0.42].map((x) => (
        <mesh key={x} position={[x, 0.85, 0]} castShadow>
          <boxGeometry args={[0.09, 1.45, 0.09]} />
          {wood()}
        </mesh>
      ))}
      {/* 顶部带孔板：四块板围出中央方孔，试管从此穿过 */}
      <group position={[0, 1.5, 0]}>
        <mesh position={[0, 0, 0.21]} castShadow receiveShadow>
          <boxGeometry args={[1.0, 0.1, 0.12]} />
          {wood(0.66)}
        </mesh>
        <mesh position={[0, 0, -0.21]} castShadow receiveShadow>
          <boxGeometry args={[1.0, 0.1, 0.12]} />
          {wood(0.66)}
        </mesh>
        {[-0.35, 0.35].map((x) => (
          <mesh key={x} position={[x, 0, 0]} castShadow receiveShadow>
            <boxGeometry args={[0.3, 0.1, 0.3]} />
            {wood(0.66)}
          </mesh>
        ))}
        <mesh position={[0, 0.06, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.23, 0.022, 12, 36]} />
          <meshStandardMaterial color="#7d6238" roughness={0.7} />
        </mesh>
      </group>
    </group>
  );
}

// 细长玻璃试管：直管壁 + 半球底 + 管口圈。底内壁约 y=TUBE_FLOOR，口约 y=TUBE_RIM_Y。
export function GlassTube() {
  const glass = (
    <meshPhysicalMaterial
      color="#eef7ff"
      transparent
      opacity={0.28}
      roughness={0.08}
      metalness={0}
      transmission={0.6}
      ior={1.3}
      side={2}
      depthWrite={false}
    />
  );
  // 半球底中心
  const bottomCY = TUBE_FLOOR + TUBE_R; // 0.36
  const wallH = TUBE_RIM_Y - bottomCY; // 直管高度
  const wallCY = bottomCY + wallH / 2;
  return (
    <group>
      <mesh position={[0, wallCY, 0]}>
        <cylinderGeometry args={[TUBE_R, TUBE_R, wallH, 48, 1, true]} />
        {glass}
      </mesh>
      <mesh position={[0, bottomCY, 0]}>
        <sphereGeometry args={[TUBE_R, 48, 32, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2]} />
        {glass}
      </mesh>
      <mesh position={[0, TUBE_RIM_Y, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[TUBE_R, 0.014, 16, 48]} />
        <meshStandardMaterial color="#eaf4ff" roughness={0.15} metalness={0.2} transparent opacity={0.85} />
      </mesh>
    </group>
  );
}

// 滴瓶：棕色小瓶 + 胶头滴管，摆在台面作配套器材。position 为瓶底中心。
export function DropperBottle({
  position = [0, 0, 0],
  liquidColor = "#8899aa",
}: {
  position?: [number, number, number];
  liquidColor?: string;
}) {
  return (
    <group position={position}>
      {/* 瓶身 */}
      <mesh position={[0, 0.28, 0]} castShadow>
        <cylinderGeometry args={[0.16, 0.16, 0.56, 32]} />
        <meshPhysicalMaterial color="#6b4f2a" transparent opacity={0.55} roughness={0.2} transmission={0.4} ior={1.4} />
      </mesh>
      {/* 内液 */}
      <mesh position={[0, 0.2, 0]}>
        <cylinderGeometry args={[0.13, 0.13, 0.34, 24]} />
        <meshStandardMaterial color={liquidColor} transparent opacity={0.85} emissive={liquidColor} emissiveIntensity={0.2} />
      </mesh>
      {/* 瓶颈 + 橡胶头 */}
      <mesh position={[0, 0.62, 0]} castShadow>
        <cylinderGeometry args={[0.05, 0.05, 0.16, 20]} />
        <meshStandardMaterial color="#5a411f" roughness={0.5} />
      </mesh>
      <mesh position={[0, 0.76, 0]} castShadow>
        <capsuleGeometry args={[0.06, 0.12, 8, 16]} />
        <meshStandardMaterial color="#33383d" roughness={0.7} />
      </mesh>
    </group>
  );
}

// 通用液柱（静态色）：半球底 + 圆柱，嵌入试管内壁（半球底中心与试管一致）。
export function LiquidColumn({
  color = "#cfe0ec",
  topY = 1.5,
}: {
  color?: string;
  topY?: number;
}) {
  const r = TUBE_R * 0.9;
  const bottomCY = TUBE_FLOOR + TUBE_R; // 与试管半球底同心 0.36
  const h = topY - bottomCY;
  const cy = bottomCY + h / 2;
  const mat = (
    <meshStandardMaterial color={color} transparent opacity={0.8} roughness={0.13} emissive={color} emissiveIntensity={0.35} />
  );
  return (
    <group>
      {/* 半球底 */}
      <mesh position={[0, bottomCY, 0]}>
        <sphereGeometry args={[r, 40, 24, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2]} />
        {mat}
      </mesh>
      {/* 圆柱体 */}
      <mesh position={[0, cy, 0]}>
        <cylinderGeometry args={[r, r, h, 48]} />
        {mat}
      </mesh>
      {/* 液面 */}
      <mesh position={[0, topY, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[r, 48]} />
        <meshStandardMaterial color={color} transparent opacity={0.9} roughness={0.06} metalness={0.1} />
      </mesh>
    </group>
  );
}
