"use client";

// 铜氨配离子 3D 场景：硫酸铜浅蓝溶液滴加氨水，先生成蓝色氢氧化铜沉淀，
// 过量氨水后沉淀溶解为深蓝色铜氨配离子溶液。
// 两阶段：hasCu(浅蓝液) → reacted(深蓝液 + 沉淀短暂出现后由 excess 溶解消散)。
import { useState, useEffect } from "react";
import { LabBench, TubeRack, GlassTube, DropperBottle, TUBE_R, TUBE_FLOOR } from "./LabPrimitives";
import { ColorLiquid, Precipitate } from "./phenomena";

export interface CopperAmmoniaProps {
  hasCu: boolean; // 硫酸铜溶液已加入
  reacted: boolean; // 已加氨水并反应（自动演示先沉淀后溶解两阶段）
}

const LIQUID_TOP = 1.45;

export function CopperAmmoniaScene({ hasCu, reacted }: CopperAmmoniaProps) {
  // 反应后先显示蓝色沉淀 1.6s，再溶解为深蓝配离子（模拟氨水由适量到过量）
  const [excess, setExcess] = useState(false);
  useEffect(() => {
    if (!reacted) {
      setExcess(false);
      return;
    }
    const t = setTimeout(() => setExcess(true), 1600);
    return () => clearTimeout(t);
  }, [reacted]);

  return (
    <group position={[0, -1.0, 0]}>
      <LabBench />
      <TubeRack />
      <GlassTube />
      {/* 液体：浅蓝→（过量后）深蓝铜氨配离子 */}
      {hasCu && (
        <ColorLiquid
          from="#8fd0f0"
          to={excess ? "#1846c8" : "#7fc4ec"}
          reacted={excess}
          topY={LIQUID_TOP}
          emissive={0.4}
        />
      )}
      {/* 中间态：加氨水但未过量 → 蓝色氢氧化铜絮状沉淀；过量后不再显示（已溶解） */}
      {reacted && !excess && (
        <Precipitate
          radius={TUBE_R * 0.8}
          floorY={TUBE_FLOOR + 0.02}
          topY={LIQUID_TOP - 0.05}
          count={110}
          color="#2f7fd0"
        />
      )}
      <DropperBottle position={[1.15, 0, 0.2]} liquidColor="#dfeaf2" />
    </group>
  );
}
