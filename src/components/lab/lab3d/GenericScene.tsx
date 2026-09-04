"use client";

// 数据驱动的通用 3D 场景：不为单个实验写代码，而是按 ScenePlan（由反应引擎结果
// 推导）组装器皿 + 液体 + 现象。这样任意实验只要试剂能被解析、反应能被引擎识别，
// 就自动获得 3D 表现；个别需要特殊装置的实验（滴定 / 电解 / 原电池）仍走专用场景。
import { LabBench, TubeRack } from "./LabPrimitives";
import { Vessel, VESSEL_GEOM } from "./Vessels";
import { VesselLiquid, liquidTopY } from "./VesselLiquid";
import {
  Bubbles,
  Precipitate,
  BrightFlare,
  Smoke,
  OrganicLayer,
  Turbidity,
  Crystals,
  TempShift,
} from "./phenomena";
import { MetalSolid } from "./MetalSolid";
import { HeatSource } from "./HeatSource";
import { RigLayer } from "./RigLayer";
import type { ScenePlan, VesselKind } from "@/lib/chem/scenePlan";

const FILL = 0.62;

/** 各器皿的取景参数：试管细高需拉远抬高，烧杯矮胖可贴近 */
export const VESSEL_VIEW: Record<VesselKind, { camera: [number, number, number]; target: [number, number, number]; fov: number }> = {
  tube: { camera: [1.5, 1.5, 3.6], target: [0, 0.45, 0], fov: 42 },
  flask: { camera: [1.4, 1.1, 3.0], target: [0, 0.15, 0], fov: 42 },
  beaker: { camera: [1.4, 1.0, 2.8], target: [0, 0.1, 0], fov: 42 },
};

export function GenericScene({ plan }: { plan: ScenePlan }) {
  const g = VESSEL_GEOM[plan.vessel];
  const topY = liquidTopY(plan.vessel, FILL);
  const innerR = g.radiusAt(topY) * 0.82;

  // 焰色装置 / 注射器 / 软瓶都自带容器，看点全在装置本身，整体交给装置层
  if (
    plan.rig.kind === "flame-test" ||
    plan.rig.kind === "syringe" ||
    plan.rig.kind === "pressure-drop"
  ) {
    return (
      <group position={[0, -0.62, 0]}>
        <LabBench />
        <RigLayer plan={plan} fill={FILL} />
      </group>
    );
  }

  return (
    <group position={[0, -0.62, 0]}>
      <LabBench />
      {/* 试管必须架在试管架上，否则悬空不真实；水浴里的试管由浴杯支撑 */}
      {plan.vessel === "tube" && plan.rig.kind !== "water-bath" && <TubeRack />}
      {/* 加热装置在器皿下方，需先渲染避免遮挡玻璃透明排序 */}
      {plan.heating && <HeatSource />}
      <Vessel kind={plan.vessel}>
        {plan.liquid && <VesselLiquid kind={plan.vessel} tint={plan.liquid} fill={FILL} />}
        {/* 金属固体：沉在液底（无液时直接置于器皿底） */}
        {plan.solid && (
          <MetalSolid
            formula={plan.solid.formula}
            y={g.floorY + 0.06}
            dissolving={plan.solid.dissolving}
          />
        )}
        {/* 气泡：电解时贴着两极冒（阴极氢气约为阳极氧气的 2 倍），其余自液底整体升起 */}
        {plan.bubbles && plan.rig.kind === "electrolysis" && plan.rig.active ? (
          <>
            <Bubbles cx={-0.24} radius={0.1} bottomY={g.floorY + 0.06} topY={topY} count={54} color="#eaf6ff" />
            <Bubbles cx={0.24} radius={0.1} bottomY={g.floorY + 0.06} topY={topY} count={27} color="#fff2ea" />
          </>
        ) : (
          plan.bubbles && (
            <Bubbles
              radius={innerR}
              bottomY={g.floorY + 0.04}
              topY={topY}
              count={plan.vessel === "tube" ? 26 : 40}
              color={plan.bubbles.color}
            />
          )
        )}
        {/* 沉淀：自液面附近缓慢下沉堆积到器皿底 */}
        {plan.precipitate && (
          <Precipitate
            radius={innerR}
            floorY={g.floorY + 0.02}
            topY={topY - 0.05}
            // 沉淀要够密才像"浑浊"，稀疏点阵看着像杂点
            count={plan.vessel === "tube" ? 300 : 460}
            size={plan.vessel === "tube" ? 0.055 : 0.07}
            color={plan.precipitate.color}
          />
        )}
        {/* 乳浊：悬浮微粒填满液体，隔杯看不透——这是"浑浊"与"变色"的本质区别 */}
        {plan.turbid && plan.liquid && <Turbidity kind={plan.vessel} topY={topY} />}
        {/* 有机相分层：上层浮酯 / 苯，下层沉四氯化碳，界面有一道亮环 */}
        {plan.phase && plan.liquid && (
          <OrganicLayer
            kind={plan.vessel}
            waterTopY={topY}
            side={plan.phase.side}
            color={plan.phase.color}
          />
        )}
        {/* 晶体析出：棱角分明的八面体，区别于无定形沉淀粉末 */}
        {plan.crystal && <Crystals kind={plan.vessel} color={plan.crystal.color} />}
        {/* 燃烧：强光 + 白烟 */}
        {plan.flame && (
          <>
            <BrightFlare position={[0, topY + 0.1, 0]} />
            <Smoke origin={[0, topY + 0.2, 0]} topY={g.rimY + 1.4} />
          </>
        )}
      </Vessel>
      {/* 温度变化：热雾在液面上方、凝露贴在杯外壁，都在器皿之外，故放在 Vessel 后面。
          与 heating 的酒精灯不同——这里表现的是"体系自己变热/变冷"，没有外部热源。 */}
      {plan.tempShift && !plan.heating && (
        <TempShift kind={plan.vessel} topY={topY} direction={plan.tempShift} />
      )}
      {/* 装置层放在器皿之后：电极 / 温度计要压在玻璃前面，透明排序才正确 */}
      <RigLayer plan={plan} fill={FILL} />
    </group>
  );
}
