"use client";

// 通用"滴加生成沉淀"3D 场景：试管内盛可溶盐溶液，滴入沉淀剂后生成絮状沉淀、
// 缓慢下沉堆积。供氢氧化铁(红棕)、氢氧化铜(蓝)等复用——只需传入液色与沉淀色。
// 坐标沿用 LabPrimitives：y=0 台面，试管内底 TUBE_FLOOR、口 TUBE_RIM_Y。
import { LabBench, TubeRack, GlassTube, LiquidColumn, DropperBottle, TUBE_R, TUBE_FLOOR } from "./LabPrimitives";
import { Precipitate } from "./phenomena";

export interface PrecipitationProps {
  hasSalt: boolean; // 盐溶液已加入
  reacted: boolean; // 已滴入沉淀剂并反应
  saltColor: string; // 盐溶液颜色
  precipColor: string; // 沉淀颜色
}

const LIQUID_TOP = 1.45;

export function PrecipitationScene({ hasSalt, reacted, saltColor, precipColor }: PrecipitationProps) {
  return (
    <group position={[0, -1.0, 0]}>
      <LabBench />
      <TubeRack />
      <GlassTube />
      {hasSalt && <LiquidColumn color={saltColor} topY={LIQUID_TOP} />}
      {reacted && (
        <Precipitate
          radius={TUBE_R * 0.82}
          floorY={TUBE_FLOOR + 0.02}
          topY={LIQUID_TOP - 0.05}
          count={130}
          color={precipColor}
        />
      )}
      {/* 配套：滴瓶（滴加沉淀剂用） */}
      <DropperBottle position={[1.15, 0, 0.2]} liquidColor={precipColor} />
    </group>
  );
}
