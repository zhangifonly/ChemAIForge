"use client";

// 电解硫酸铜 3D 场景：长方形电解槽、左阴极右阳极、直流电源、导线。
//
// 场景本身不持有任何化学状态 —— 所有可见变化（铜层、阳极变细、气泡、溶液颜色、离子数量）
// 都由父组件传入的 readings（来自 model.ts）驱动，保证画面与读数同源。
import { useMemo } from "react";
import * as THREE from "three";
import { LabBench } from "../LabPrimitives";
import { Bubbles } from "../phenomena";
import { IonField } from "./IonField";
import { ElectronFlow } from "./ElectronFlow";
import { copperLayerMicrons, solutionColor, type AnodeMaterial, type ElectrolysisReadings } from "./model";

export interface ElectrolysisSceneProps {
  readings: ElectrolysisReadings;
  anode: AnodeMaterial;
  current: number;
  energized: boolean;
  timeScale: number;
  microView: boolean;
  /** 已取出阴极称量：阴极从液体中抬起 */
  cathodeLifted: boolean;
}

// 电解槽内腔尺寸
const TANK = { w: 2.4, h: 1.5, d: 1.1, wall: 0.03 };
const LIQUID_TOP = 1.2;
const CATHODE_X = -0.7;
const ANODE_X = 0.7;
const ELECTRODE = { w: 0.34, h: 1.55, t: 0.05 };

export function ElectrolysisScene(props: ElectrolysisSceneProps) {
  const { readings, anode, current, energized, timeScale, microView, cathodeLifted } = props;
  const liquidColor = useMemo(() => solutionColor(readings.cuConcentration), [readings.cuConcentration]);

  // 铜层覆盖度：以 60 μm 视为完全覆盖成铜红。真实 1 A × 30 min 约 55 μm，
  // 所以一节课的时间刚好看到从灰到红的完整变化
  const coverage = Math.min(1, copperLayerMicrons(readings.copperDepositedG) / 60);
  // 铜阳极溶解：体积按溶解质量缩小。铜阳极初始质量取 8 g（2×4×0.12 cm 铜片）
  const anodeShrink = anode === "copper" ? Math.max(0.35, 1 - readings.anodeDissolvedG / 8) : 1;

  const live = energized && current > 0;

  return (
    <group position={[0, -1.0, 0]}>
      <LabBench />
      <Tank liquidColor={liquidColor} />

      <Cathode coverage={coverage} lifted={cathodeLifted} />
      <Anode material={anode} shrink={anodeShrink} />

      {/* 阳极氧气泡：只有石墨阳极放氧。数量随电流线性增加 */}
      {live && anode === "graphite" && (
        <Bubbles
          cx={ANODE_X}
          cz={0}
          radius={0.14}
          bottomY={0.2}
          topY={LIQUID_TOP}
          count={Math.round(20 + current * 40)}
          speed={0.35 + current * 0.15}
          size={0.035}
          color="#f4fbff"
          opacity={0.75}
        />
      )}

      {microView && (
        <IonField
          halfWidth={TANK.w / 2 - 0.08}
          height={LIQUID_TOP - 0.14}
          halfDepth={TANK.d / 2 - 0.08}
          bottomY={0.12}
          cathodeX={CATHODE_X + ELECTRODE.t}
          anodeX={ANODE_X - ELECTRODE.t}
          current={live ? current : 0}
          // 铜阳极不断补充 Cu²⁺，浓度不变
          cuFraction={readings.cuConcentration / 0.5}
          timeScale={timeScale}
        />
      )}

      <PowerSupply current={live ? current : 0} />
      {/* 称量前先拆下阴极导线：真实操作如此，否则导线会穿过抬起的电极 */}
      <Wires cathodeConnected={!cathodeLifted} />
      {/* 电子流：负极 → 阴极；阳极 → 正极。只在微观视角下显示，避免宏观画面过于杂乱 */}
      {microView && live && (
        <>
          <ElectronFlow
            points={WIRE_PATHS.toCathode()}
            current={current}
            timeScale={timeScale}
          />
          <ElectronFlow
            points={WIRE_PATHS.fromAnode()}
            current={current}
            timeScale={timeScale}
          />
        </>
      )}
    </group>
  );
}

/** 电解槽：玻璃外壳 + 溶液。溶液颜色随 Cu²⁺ 浓度按 Beer–Lambert 变化 */
function Tank({ liquidColor }: { liquidColor: string }) {
  return (
    <group>
      {/* 玻璃槽：开口长方体，用五块板拼，避免顶面挡住视线 */}
      {[
        { p: [0, TANK.h / 2, TANK.d / 2], s: [TANK.w, TANK.h, TANK.wall] },
        { p: [0, TANK.h / 2, -TANK.d / 2], s: [TANK.w, TANK.h, TANK.wall] },
        { p: [TANK.w / 2, TANK.h / 2, 0], s: [TANK.wall, TANK.h, TANK.d] },
        { p: [-TANK.w / 2, TANK.h / 2, 0], s: [TANK.wall, TANK.h, TANK.d] },
        { p: [0, 0.015, 0], s: [TANK.w, TANK.wall, TANK.d] },
      ].map((b, i) => (
        <mesh key={i} position={b.p as [number, number, number]}>
          <boxGeometry args={b.s as [number, number, number]} />
          <meshPhysicalMaterial
            color="#eef7ff"
            transparent
            opacity={0.18}
            roughness={0.05}
            transmission={0.75}
            ior={1.45}
            depthWrite={false}
          />
        </mesh>
      ))}
      {/* 溶液：略小于内腔，半透明，颜色即浓度 */}
      <mesh position={[0, LIQUID_TOP / 2 + 0.02, 0]}>
        <boxGeometry args={[TANK.w - 0.07, LIQUID_TOP - 0.04, TANK.d - 0.07]} />
        <meshPhysicalMaterial
          color={liquidColor}
          transparent
          opacity={0.42}
          roughness={0.1}
          transmission={0.35}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}

/**
 * 阴极：石墨板，析出的铜从浸没部分开始覆盖。
 * 颜色按覆盖度从石墨灰插值到铜红，同时加一层略厚的"镀层"壳体表示长厚。
 */
function Cathode({ coverage, lifted }: { coverage: number; lifted: boolean }) {
  const graphite = new THREE.Color("#3a3d42");
  const copper = new THREE.Color("#b8633a");
  const color = graphite.clone().lerp(copper, coverage);
  // 浸没段：从液面以下到板底
  const submergedH = LIQUID_TOP - 0.1;
  const y = lifted ? 1.1 : 0;
  return (
    <group position={[CATHODE_X, y, 0]}>
      {/* 石墨本体 */}
      <mesh position={[0, 0.1 + ELECTRODE.h / 2, 0]} castShadow>
        <boxGeometry args={[ELECTRODE.t, ELECTRODE.h, ELECTRODE.w]} />
        <meshStandardMaterial color="#3a3d42" roughness={0.85} />
      </mesh>
      {/* 铜镀层：只包住浸没部分，厚度随覆盖度增加（放大显示，真实数十微米肉眼只见颜色） */}
      {coverage > 0.01 && (
        <mesh position={[0, 0.1 + submergedH / 2, 0]}>
          <boxGeometry args={[ELECTRODE.t + 0.012 * coverage, submergedH, ELECTRODE.w + 0.012 * coverage]} />
          <meshStandardMaterial
            color={color}
            metalness={0.6}
            roughness={0.4 - coverage * 0.1}
            // 微弱自发光：隔着蓝色溶液看，纯反射的铜会被染成灰紫，辨认不出是铜
            emissive={color}
            emissiveIntensity={0.18 * coverage}
          />
        </mesh>
      )}
      <Clip />
    </group>
  );
}

/**
 * 阳极：石墨板始终不变；铜阳极随溶解变薄、变窄（电解精炼中粗铜阳极被逐渐消耗）。
 */
function Anode({ material, shrink }: { material: AnodeMaterial; shrink: number }) {
  const isCu = material === "copper";
  const submergedH = LIQUID_TOP - 0.1;
  return (
    <group position={[ANODE_X, 0, 0]}>
      {/* 液面以上部分不参与反应，保持原尺寸 */}
      <mesh position={[0, 0.1 + submergedH + (ELECTRODE.h - submergedH) / 2, 0]} castShadow>
        <boxGeometry args={[ELECTRODE.t, ELECTRODE.h - submergedH, ELECTRODE.w]} />
        <meshStandardMaterial color={isCu ? "#b8633a" : "#3a3d42"} metalness={isCu ? 0.75 : 0} roughness={isCu ? 0.35 : 0.85} />
      </mesh>
      {/* 浸没部分：铜阳极按溶解量缩小 */}
      <mesh position={[0, 0.1 + submergedH / 2, 0]} castShadow>
        <boxGeometry args={[ELECTRODE.t * shrink, submergedH, ELECTRODE.w * (0.6 + 0.4 * shrink)]} />
        <meshStandardMaterial
          color={isCu ? "#a8582f" : "#3a3d42"}
          metalness={isCu ? 0.6 : 0}
          roughness={isCu ? 0.55 + (1 - shrink) * 0.3 : 0.85}
        />
      </mesh>
      <Clip />
    </group>
  );
}

/** 电极夹 */
function Clip() {
  return (
    <mesh position={[0, 0.1 + ELECTRODE.h + 0.04, 0]}>
      <boxGeometry args={[0.12, 0.08, 0.18]} />
      <meshStandardMaterial color="#c0392b" roughness={0.4} />
    </mesh>
  );
}

/**
 * 电源摆放：放在槽的正左侧、与槽同一深度，略转向镜头。
 * 试过三处都不行：右侧会被画面裁掉、导线横穿阳极前方；正后方与左后方
 * 隔着透明槽看，电源像泡在溶液里（相机从右前方俯视，槽后方的物体全在槽的投影里）。
 * 与槽平齐放在左边，投影就落在槽外。
 */
const PSU_POS = new THREE.Vector3(-2.35, 0.35, 0.45);
const PSU_ROT_Y = 0.35;
// 接线柱：负极放靠槽的一侧（+x），这样负极→阴极、阳极→正极两根线不交叉
const PSU_TERMINAL_LOCAL = { neg: new THREE.Vector3(0.55, -0.15, 0.31), pos: new THREE.Vector3(-0.55, -0.15, 0.31) };

/** 电源接线柱的世界坐标：导线与电子流都从这里出发，改电源位置时自动跟随 */
function terminal(kind: "neg" | "pos"): [number, number, number] {
  const p = PSU_TERMINAL_LOCAL[kind].clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), PSU_ROT_Y).add(PSU_POS);
  return [p.x, p.y, p.z];
}

/**
 * 两条回路的路径（按电子流动方向）：
 *   负极 → 阴极夹：电子从电源负极流向阴极，在阴极被 Cu²⁺ 夺走
 *   阳极夹 → 正极：阳极失去的电子流回电源正极；这条线绕到槽后方，不从阳极前面横穿
 */
export const WIRE_PATHS = {
  toCathode: (): [number, number, number][] => {
    const n = terminal("neg");
    return [n, [n[0] + 0.15, n[1] + 0.8, n[2] + 0.2], [CATHODE_X - 0.3, 2.3, -0.05], [CATHODE_X, 2.3, 0], [CATHODE_X, 1.75, 0]];
  },
  fromAnode: (): [number, number, number][] => {
    const p = terminal("pos");
    return [[ANODE_X, 1.75, 0], [ANODE_X, 2.4, -0.2], [0, 2.6, -0.8], [p[0] + 0.2, 1.4, p[2] - 0.5], p];
  },
};

/** 直流电源：带数显电流表，读数与传入电流一致 */
function PowerSupply({ current }: { current: number }) {
  return (
    <group position={PSU_POS} rotation={[0, PSU_ROT_Y, 0]}>
      <mesh castShadow>
        <boxGeometry args={[1.5, 0.7, 0.6]} />
        <meshStandardMaterial color="#e6e9ec" roughness={0.5} />
      </mesh>
      {/* 数显屏：通电时发光 */}
      <mesh position={[0, 0.12, 0.305]}>
        <planeGeometry args={[0.7, 0.24]} />
        <meshStandardMaterial
          color={current > 0 ? "#0b3b2a" : "#1d2226"}
          emissive={current > 0 ? "#22c55e" : "#000000"}
          emissiveIntensity={current > 0 ? 0.35 : 0}
        />
      </mesh>
      {/* 接线柱：负极黑、正极红，位置取自 PSU_TERMINAL_LOCAL，与导线端点同源 */}
      <mesh position={PSU_TERMINAL_LOCAL.neg} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.05, 0.05, 0.06, 16]} />
        <meshStandardMaterial color="#1b1b1b" />
      </mesh>
      <mesh position={PSU_TERMINAL_LOCAL.pos} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.05, 0.05, 0.06, 16]} />
        <meshStandardMaterial color="#c0392b" />
      </mesh>
    </group>
  );
}

/** 导线：负极 → 阴极（黑），阳极 → 正极（红） */
function Wires({ cathodeConnected }: { cathodeConnected: boolean }) {
  const tube = (pts: [number, number, number][]) =>
    new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p))), 40, 0.012, 6);
  const black = useMemo(() => tube(WIRE_PATHS.toCathode()), []);
  const red = useMemo(() => tube(WIRE_PATHS.fromAnode()), []);
  return (
    <>
      {cathodeConnected && (
        <mesh geometry={black}>
          <meshStandardMaterial color="#1b1b1b" roughness={0.6} />
        </mesh>
      )}
      <mesh geometry={red}>
        <meshStandardMaterial color="#c0392b" roughness={0.6} />
      </mesh>
    </>
  );
}
