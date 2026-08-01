"use client";

// 装置层：把 ScenePlan.rig 映射到具体 3D 硬件。与"器皿内的化学现象"分离，
// 这样电解 / 量热 / 水浴 / 焰色 / 过滤 / 蒸馏这些"看点在装置"的实验也能自动出 3D。
import { VESSEL_GEOM } from "./Vessels";
import { liquidTopY } from "./VesselLiquid";
import {
  Calorimeter,
  Distillation,
  Electrode,
  Evaporation,
  Filtration,
  FlameTestRig,
  GasCollect,
  PhMeter,
  PowerSupply,
  PressureDrop,
  Syringe,
  StirRing,
  Thermometer,
  TitrationRig,
  Voltmeter,
  WaterBath,
  Wires,
  type ElectrodeMaterial,
} from "./rigs";
import type { ScenePlan } from "@/lib/chem/scenePlan";

export function RigLayer({ plan, fill }: { plan: ScenePlan; fill: number }) {
  const { rig } = plan;
  const g = VESSEL_GEOM[plan.vessel];
  const topY = liquidTopY(plan.vessel, fill);
  const [leftMat, rightMat] = rig.electrodes as [ElectrodeMaterial, ElectrodeMaterial];

  // 焰色装置没有液体容器，整体替换掉器皿部分
  if (rig.kind === "flame-test") {
    return <FlameTestRig sample={rig.flameSample ?? undefined} lit={rig.active} />;
  }
  // 注射器自成密闭体系，同样接管整个画面（active = 压缩活塞）
  if (rig.kind === "syringe") {
    return <Syringe gasColor={rig.gasColor} pressed={rig.active} />;
  }
  // 软塑料瓶变瘪：瓶子本身就是容器，不再画烧杯
  if (rig.kind === "pressure-drop") {
    return <PressureDrop y={g.floorY + 0.78} collapsing={rig.active} />;
  }

  return (
    <>
      {(rig.kind === "electrolysis" || rig.kind === "cell") && (
        <>
          <Electrode x={-0.24} bottomY={g.floorY + 0.06} topY={g.rimY + 0.5} material={leftMat} />
          <Electrode x={0.24} bottomY={g.floorY + 0.06} topY={g.rimY + 0.5} material={rightMat} />
          <Wires x={0.24} topY={g.rimY + 0.5} hubY={g.rimY + 0.86} />
          {rig.kind === "electrolysis" ? (
            <PowerSupply y={g.rimY + 1.06} on={rig.active} />
          ) : (
            <Voltmeter y={g.rimY + 1.06} on={rig.active} />
          )}
        </>
      )}

      {rig.kind === "calorimeter" && (
        <>
          <Calorimeter topY={g.rimY + 0.16} />
          <StirRing bottomY={g.floorY + 0.2} topY={g.rimY + 0.6} />
        </>
      )}

      {rig.kind === "water-bath" && <WaterBath waterY={topY + 0.1} />}

      {rig.kind === "filtration" && (
        <Filtration residueColor={plan.precipitate?.color ?? null} dripping={rig.active} />
      )}

      {rig.kind === "distillation" && <Distillation running={rig.active} />}

      {rig.kind === "titration" && <TitrationRig dripping={rig.active} landY={topY} />}

      {rig.kind === "ph-meter" && <PhMeter liquidY={topY} ph={rig.ph} on={rig.active} />}

      {rig.kind === "evaporation" && <Evaporation rimY={g.rimY} heating={rig.active} />}

      {rig.kind === "gas-collect" && (
        <GasCollect
          gasColor={plan.bubbles?.color ?? null}
          filled={plan.bubbles ? (rig.active ? 0.85 : 0.35) : 0}
        />
      )}

      {/* 温度计：量热 / 水浴 / 蒸馏都要读数，插在器皿口偏一侧避免挡住主体 */}
      {rig.thermometer && (
        <Thermometer
          bulbY={g.floorY + 0.12}
          topY={g.rimY + 0.9}
          x={plan.vessel === "tube" ? 0.3 : 0.3}
          temperature={rig.temperature}
        />
      )}
    </>
  );
}
