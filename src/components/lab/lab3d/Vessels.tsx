"use client";

// 通用 3D 器皿：烧杯 / 锥形瓶 / 试管，三者统一坐标约定（y=0 为台面，瓶底贴台）
// 并统一暴露"液面可用区间"与"内壁半径函数"，供通用场景把液体、气泡、沉淀
// 放到正确位置——这样新实验只要选定器皿就有正确的现象几何，无需逐个手写。
import type { ReactNode } from "react";
import type { VesselKind } from "@/lib/chem/scenePlan";

/** 器皿的几何契约：现象组件据此定位 */
export interface VesselGeom3D {
  /** 内底高度（液体 / 沉淀堆积起点） */
  floorY: number;
  /** 液体最高可达高度（不越过瓶口） */
  maxY: number;
  /** 给定高度处的内壁半径（锥形瓶随高度收缩） */
  radiusAt: (y: number) => number;
  /** 口沿高度（气泡逸出 / 导管接入位置） */
  rimY: number;
}

export const VESSEL_GEOM: Record<VesselKind, VesselGeom3D> = {
  beaker: {
    floorY: 0.03,
    maxY: 0.92,
    radiusAt: () => 0.46,
    rimY: 1.1,
  },
  flask: {
    floorY: 0.03,
    maxY: 0.82,
    // 锥形瓶：底宽 0.58 向瓶颈 0.16 收缩
    radiusAt: (y) => {
      const t = Math.min(1, Math.max(0, y / 1.1));
      return 0.55 - t * 0.4;
    },
    rimY: 1.28,
  },
  tube: {
    floorY: 0.36,
    maxY: 1.7,
    radiusAt: () => 0.18,
    rimY: 2.0,
  },
};

/** 玻璃材质（三种器皿共用，保证质感一致） */
export function glassMaterial() {
  return (
    <meshPhysicalMaterial
      color="#eef7ff"
      transparent
      opacity={0.2}
      roughness={0.07}
      transmission={0.7}
      ior={1.3}
      side={2}
      depthWrite={false}
    />
  );
}

/** 按类型渲染器皿外壳；children 为容器内的液体与现象 */
export function Vessel({
  kind,
  children,
}: {
  kind: VesselKind;
  children?: ReactNode;
}) {
  return (
    <group>
      {kind === "beaker" && <BeakerShell />}
      {kind === "flask" && <FlaskShell />}
      {kind === "tube" && <TubeShell />}
      {children}
    </group>
  );
}

function BeakerShell() {
  return (
    <group>
      {/* 杯壁 */}
      <mesh position={[0, 0.55, 0]}>
        <cylinderGeometry args={[0.5, 0.5, 1.1, 44, 1, true]} />
        {glassMaterial()}
      </mesh>
      {/* 杯底 */}
      <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.5, 44]} />
        {glassMaterial()}
      </mesh>
      {/* 口沿加厚圈：玻璃器皿的口沿在实物上明显更亮 */}
      <mesh position={[0, 1.1, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.5, 0.016, 12, 48]} />
        <meshStandardMaterial color="#eaf4ff" roughness={0.14} metalness={0.2} transparent opacity={0.85} />
      </mesh>
    </group>
  );
}

function FlaskShell() {
  return (
    <group>
      {/* 锥体瓶身：底宽向瓶颈收缩 */}
      <mesh position={[0, 0.55, 0]}>
        <cylinderGeometry args={[0.19, 0.6, 1.1, 48, 1, true]} />
        {glassMaterial()}
      </mesh>
      {/* 瓶底 */}
      <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.6, 44]} />
        {glassMaterial()}
      </mesh>
      {/* 瓶颈 */}
      <mesh position={[0, 1.19, 0]}>
        <cylinderGeometry args={[0.19, 0.19, 0.18, 32, 1, true]} />
        {glassMaterial()}
      </mesh>
      <mesh position={[0, 1.28, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.19, 0.016, 12, 40]} />
        <meshStandardMaterial color="#eaf4ff" roughness={0.14} metalness={0.2} transparent opacity={0.85} />
      </mesh>
    </group>
  );
}

function TubeShell() {
  return (
    <group>
      {/* 管壁 */}
      <mesh position={[0, 1.18, 0]}>
        <cylinderGeometry args={[0.2, 0.2, 1.64, 40, 1, true]} />
        {glassMaterial()}
      </mesh>
      {/* 半球底 */}
      <mesh position={[0, 0.36, 0]}>
        <sphereGeometry args={[0.2, 40, 24, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2]} />
        {glassMaterial()}
      </mesh>
      {/* 管口 */}
      <mesh position={[0, 2.0, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.2, 0.014, 12, 40]} />
        <meshStandardMaterial color="#eaf4ff" roughness={0.15} metalness={0.2} transparent opacity={0.85} />
      </mesh>
    </group>
  );
}
