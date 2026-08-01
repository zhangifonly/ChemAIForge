"use client";

// 有机相分层：酯 / 苯 / 汽油浮在水面上，四氯化碳沉在水下。
// 关键真实感在两处：① 界面必须清晰可辨（两层折射率不同，界面是一条亮线）
// ② 上层液面呈弧形凸起（有机相表面张力小、易铺展，边缘微微爬壁）。
import { VESSEL_GEOM } from "../Vessels";
import type { VesselKind } from "@/lib/chem/scenePlan";

export interface OrganicLayerProps {
  kind: VesselKind;
  /** 水层液面高度（世界坐标 Y） */
  waterTopY: number;
  /** 有机相在水层之上还是之下 */
  side: "top" | "bottom";
  color: string;
  /** 层厚（相对器皿高度的比例） */
  thickness?: number;
}

export function OrganicLayer({
  kind,
  waterTopY,
  side,
  color,
  thickness = 0.16,
}: OrganicLayerProps) {
  const g = VESSEL_GEOM[kind];
  const h = Math.max(0.06, (g.maxY - g.floorY) * thickness);
  // 上层：坐在水面上；下层：贴着器皿底，水层被它顶高（这里只画层本身）
  const baseY = side === "top" ? waterTopY : g.floorY;
  const topY = baseY + h;
  const rBottom = g.radiusAt(baseY) * 0.94;
  const rTop = g.radiusAt(topY) * 0.94;

  return (
    <group>
      <mesh position={[0, baseY + h / 2, 0]}>
        <cylinderGeometry args={[rTop, rBottom, h, 44, 1, true]} />
        <meshStandardMaterial
          color={color}
          transparent
          opacity={0.72}
          roughness={0.08}
          side={2}
        />
      </mesh>
      {/* 相界面：两层之间的一条高亮薄环，是"分层"最直接的视觉证据 */}
      <mesh position={[0, baseY + 0.002, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[rBottom * 0.72, rBottom, 44]} />
        <meshStandardMaterial
          color="#ffffff"
          transparent
          opacity={0.5}
          roughness={0.02}
          metalness={0.3}
        />
      </mesh>
      {/* 有机相自身的液面 */}
      <mesh position={[0, topY - 0.004, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[rTop, 44]} />
        <meshStandardMaterial
          color={color}
          transparent
          opacity={0.88}
          roughness={0.04}
          metalness={0.12}
        />
      </mesh>
    </group>
  );
}
