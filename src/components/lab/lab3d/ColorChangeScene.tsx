"use client";

// 通用"滴加显色/褪色"3D 场景：试管内液体在反应后由 from 色平滑过渡到 to 色。
// 供硫氰合铁显血红、高锰酸钾被草酸褪色等复用——只需传入前后颜色。
// 坐标沿用 LabPrimitives。配套滴瓶提示"滴加试剂"。
import { LabBench, TubeRack, GlassTube, DropperBottle } from "./LabPrimitives";
import { ColorLiquid } from "./phenomena";

export interface ColorChangeProps {
  hasLiquid: boolean; // 主体液体已加入
  reacted: boolean; // 已滴加试剂并反应
  fromColor: string; // 反应前色
  toColor: string; // 反应后色
  dropperColor?: string; // 滴瓶内试剂色
}

const LIQUID_TOP = 1.45;

export function ColorChangeScene({
  hasLiquid,
  reacted,
  fromColor,
  toColor,
  dropperColor = "#d8d8d8",
}: ColorChangeProps) {
  return (
    <group position={[0, -1.0, 0]}>
      <LabBench />
      <TubeRack />
      <GlassTube />
      {hasLiquid && (
        <ColorLiquid from={fromColor} to={toColor} reacted={reacted} topY={LIQUID_TOP} emissive={0.32} />
      )}
      <DropperBottle position={[1.15, 0, 0.2]} liquidColor={dropperColor} />
    </group>
  );
}
