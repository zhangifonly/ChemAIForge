"use client";

// 电极组件：电解 / 电镀 / 原电池共用。两根电极自器皿口斜插入液面下，
// 上端由导线接到电源或电压表。电极颜色区分材质（碳黑 / 铂银亮 / 铜红）。
import { useMemo } from "react";

/** 电极材质外观 */
const ELECTRODE_LOOK: Record<string, { color: string; metalness: number; roughness: number }> = {
  carbon: { color: "#2a2a30", metalness: 0.25, roughness: 0.72 },
  platinum: { color: "#dfe3e8", metalness: 0.95, roughness: 0.16 },
  silver: { color: "#e8ecef", metalness: 0.95, roughness: 0.18 },
  copper: { color: "#c9743a", metalness: 0.9, roughness: 0.26 },
  zinc: { color: "#9aa4ad", metalness: 0.8, roughness: 0.36 },
  iron: { color: "#8d949c", metalness: 0.85, roughness: 0.34 },
};

export type ElectrodeMaterial = keyof typeof ELECTRODE_LOOK;

/** 从仪器清单推断电极材质（左右两极可不同，如电镀：银阳极 + 铁阴极） */
export function inferElectrodes(apparatus: string[]): [ElectrodeMaterial, ElectrodeMaterial] {
  const all = apparatus.join(" ");
  const pick = (): ElectrodeMaterial | null => {
    if (all.includes("铂")) return "platinum";
    if (all.includes("银")) return "silver";
    if (all.includes("铜")) return "copper";
    if (all.includes("锌")) return "zinc";
    if (all.includes("碳") || all.includes("石墨")) return "carbon";
    return null;
  };
  const base = pick() ?? "carbon";
  // 同时出现两种金属名时左右分别取（原电池 / 电镀常见）
  if (all.includes("锌") && all.includes("铜")) return ["zinc", "copper"];
  if (all.includes("银") && all.includes("铁")) return ["iron", "silver"];
  if (all.includes("铁") && all.includes("碳")) return ["iron", "carbon"];
  return [base, base];
}

export interface ElectrodeProps {
  x: number;
  /** 电极下端浸入深度对应的底部 y */
  bottomY: number;
  /** 电极顶端 y（接线处） */
  topY: number;
  material: ElectrodeMaterial;
}

export function Electrode({ x, bottomY, topY, material }: ElectrodeProps) {
  const look = ELECTRODE_LOOK[material] ?? ELECTRODE_LOOK.carbon;
  const h = Math.max(0.2, topY - bottomY);
  return (
    <mesh position={[x, bottomY + h / 2, 0]} castShadow>
      <cylinderGeometry args={[0.045, 0.045, h, 20]} />
      <meshStandardMaterial
        color={look.color}
        metalness={look.metalness}
        roughness={look.roughness}
      />
    </mesh>
  );
}

/** 电极上端的导线：从两极顶端各拉一段到中间上方（电源 / 电压表位置） */
export function Wires({ x, topY, hubY }: { x: number; topY: number; hubY: number }) {
  const pts = useMemo(() => [-x, x], [x]);
  return (
    <group>
      {pts.map((px) => (
        <group key={px}>
          {/* 竖直段 */}
          <mesh position={[px, (topY + hubY) / 2, 0]}>
            <cylinderGeometry args={[0.018, 0.018, Math.abs(hubY - topY), 10]} />
            <meshStandardMaterial color="#33383d" roughness={0.6} />
          </mesh>
          {/* 水平段：接到中间 */}
          <mesh position={[px / 2, hubY, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.018, 0.018, Math.abs(px), 10]} />
            <meshStandardMaterial color="#33383d" roughness={0.6} />
          </mesh>
        </group>
      ))}
    </group>
  );
}
