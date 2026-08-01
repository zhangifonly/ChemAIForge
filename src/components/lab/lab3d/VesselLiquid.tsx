"use client";

// 自适应器皿造型的液体：按 VESSEL_GEOM 的内壁半径函数生成液柱，上下渐变色，
// 液面单独一片（略低于柱顶避免共面 z-fighting，与滴定锥形瓶同一处理）。
// 反应发生时颜色平滑过渡到产物色，而不是硬切换。
import { useRef, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import { Color, type MeshStandardMaterial } from "three";
import type { VesselKind } from "@/lib/chem/scenePlan";
import type { SolutionTint } from "@/lib/chem/appearance";
import { VESSEL_GEOM } from "./Vessels";

export interface VesselLiquidProps {
  kind: VesselKind;
  tint: SolutionTint;
  /** 液面高度比例 0~1（相对 floorY→maxY 区间） */
  fill?: number;
  /** 颜色过渡速度（每秒插值比例） */
  rate?: number;
}

export function VesselLiquid({ kind, tint, fill = 0.62, rate = 2.2 }: VesselLiquidProps) {
  const g = VESSEL_GEOM[kind];
  // 液体可能由多块网格拼成（试管半球底 + 液柱），全部收集统一插值，
  // 否则只动其中一块会出现"半球底还是旧色"的割裂。
  const bodyMats = useRef<MeshStandardMaterial[]>([]);
  const collect = (m: MeshStandardMaterial | null) => {
    if (m && !bodyMats.current.includes(m)) bodyMats.current.push(m);
  };
  const surfMat = useRef<MeshStandardMaterial>(null);
  const target = useRef(new Color(tint.bottom));
  const surfTarget = useRef(new Color(tint.top));

  useEffect(() => {
    target.current.set(tint.bottom);
    surfTarget.current.set(tint.top);
  }, [tint.bottom, tint.top]);

  // 颜色渐变过渡：反应后液色不硬切
  useFrame((_, dt) => {
    const k = Math.min(1, dt * rate);
    for (const m of bodyMats.current) m.color.lerp(target.current, k);
    if (surfMat.current) surfMat.current.color.lerp(surfTarget.current, k);
  });

  const topY = g.floorY + (g.maxY - g.floorY) * Math.min(1, Math.max(0.04, fill));
  const rBottom = g.radiusAt(g.floorY) * 0.94;
  const rTop = g.radiusAt(topY) * 0.94;
  // 试管底是半球：液柱须从半球顶（floorY + r）起算，否则柱体会盖住球面显得平底
  const baseY = kind === "tube" ? g.floorY + rBottom : g.floorY;
  const h = Math.max(0.02, topY - baseY);

  return (
    <group>
      {/* 试管的半球底需要单独一块液体，否则液面以下会露空 */}
      {kind === "tube" && (
        <mesh position={[0, g.floorY, 0]}>
          <sphereGeometry args={[rBottom, 36, 20, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2]} />
          <meshStandardMaterial ref={collect} color={tint.bottom} transparent opacity={0.8} roughness={0.13} />
        </mesh>
      )}
      {/* 液柱：顶端开口，顶面交给液面片，避免共面条纹 */}
      <mesh position={[0, baseY + h / 2, 0]}>
        <cylinderGeometry args={[rTop, rBottom, h, 44, 1, true]} />
        <meshStandardMaterial
          ref={collect}
          color={tint.bottom}
          transparent
          opacity={0.78}
          roughness={0.13}
          side={2}
        />
      </mesh>
      {/* 液面 */}
      <mesh position={[0, topY - 0.004, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[rTop, 44]} />
        <meshStandardMaterial
          ref={surfMat}
          color={tint.top}
          transparent
          opacity={0.9}
          roughness={0.06}
          metalness={0.1}
        />
      </mesh>
    </group>
  );
}

/** 液面高度（世界坐标），供气泡 / 沉淀等现象定位 */
export function liquidTopY(kind: VesselKind, fill = 0.62): number {
  const g = VESSEL_GEOM[kind];
  return g.floorY + (g.maxY - g.floorY) * Math.min(1, Math.max(0.04, fill));
}
