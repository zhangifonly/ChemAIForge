"use client";

// 碘钟 3D 场景：恒温磁力搅拌器（带温度与计时数显）、主烧杯（A 液：KI + Na2S2O3 + 淀粉 + H2SO4）
// 里转动的搅拌子与涡旋液面；右边的 B 液（H2O2）烧杯会被端起、倾倒进主烧杯，倒完即开始计时。
import { useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import * as THREE from "three";
import { LabBench } from "../LabPrimitives";
import { FitPortrait } from "../showcase/FitPortrait";
import { glassMaterial } from "../Vessels";
import { VortexLiquid, CLEAR } from "./VortexLiquid";

export type ClockPhase = "ready" | "pouring" | "running" | "done";

const PLATE_Y = 0.36;
const BEAKER = { r: 0.42, h: 0.95 };
const LEVEL_A = 0.32, LEVEL_FULL = 0.58;
const POUR_S = 1.8;
// B 杯的变换点在杯口左缘（倾倒的枢轴），静置时杯底落在台面上
const B_REST = new THREE.Vector3(0.85, 0.5, 0.15);
const B_POUR = new THREE.Vector3(0.36, PLATE_Y + BEAKER.h + 0.1, 0);

export interface ClockSceneProps {
  phase: ClockPhase;
  tempC: number;
  elapsed: number;
  blue: number;
  yellow: number;
  onPoured: () => void;
}

export function ClockScene(p: ClockSceneProps) {
  const bGroup = useRef<THREE.Group>(null);
  const bLiquid = useRef<THREE.Mesh>(null);
  const stream = useRef<THREE.Mesh>(null);
  const bar = useRef<THREE.Mesh>(null);
  const pourT = useRef(0);
  const fired = useRef(false);
  const levelState = useRef(LEVEL_A);

  // 阶段切换时重置倾倒进度：不能放在帧回调里判断 —— 低帧率下"再做一次→倒入"可能在两帧之间连着发生，
  // 帧回调根本看不到中间的 ready，倾倒就卡在"已完成"状态不再触发 onPoured
  useEffect(() => {
    if (p.phase === "pouring" || p.phase === "ready") {
      pourT.current = 0;
      fired.current = false;
    }
  }, [p.phase]);

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    if (bar.current) bar.current.rotation.y += dt * 18;
    const g = bGroup.current;
    if (!g) return;
    if (p.phase === "ready") {
      levelState.current = LEVEL_A;
    } else if (p.phase === "pouring") {
      pourT.current = Math.min(POUR_S, pourT.current + dt);
    } else pourT.current = POUR_S + 1;
    const u = Math.min(1, pourT.current / POUR_S);
    // 0–0.3 端起移到杯口上方；0.3–0.85 倾倒；0.85–1 放回
    const move = smooth(Math.min(1, u / 0.3)) * (1 - smooth(Math.max(0, (u - 0.85) / 0.15)));
    const tilt = smooth(clamp01((u - 0.25) / 0.2)) * (1 - smooth(clamp01((u - 0.82) / 0.1)));
    const flowing = u > 0.38 && u < 0.84;
    g.position.copy(B_REST).lerp(B_POUR, move);
    g.rotation.z = tilt * 1.85;
    if (stream.current) stream.current.visible = flowing && p.phase === "pouring";
    if (p.phase !== "ready") levelState.current = LEVEL_A + (LEVEL_FULL - LEVEL_A) * clamp01((u - 0.38) / 0.46);
    if (bLiquid.current) bLiquid.current.scale.y = Math.max(0.02, 1 - clamp01((u - 0.38) / 0.46));
    if (p.phase === "pouring" && u >= 1 && !fired.current) {
      fired.current = true;
      p.onPoured();
    }
  });

  const stirring = p.phase !== "ready";
  return (
    <group position={[0, -1.0, 0]}>
      <LabBench />
      <FitPortrait baseFov={40} />
      <Stirrer tempC={p.tempC} elapsed={p.elapsed} running={stirring} />
      <group position={[0, PLATE_Y, 0]}>
        <mesh position={[0, BEAKER.h / 2, 0]} renderOrder={3}>
          <cylinderGeometry args={[BEAKER.r + 0.02, BEAKER.r + 0.02, BEAKER.h, 64, 1, true]} />
          {glassMaterial()}
        </mesh>
        <mesh ref={bar} position={[0, 0.03, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
          <capsuleGeometry args={[0.025, 0.2, 6, 12]} />
          <meshStandardMaterial color="#f4f4f2" roughness={0.3} />
        </mesh>
        <VortexLiquid radius={BEAKER.r} levelRef={levelState} stirring={stirring} blue={p.blue} yellow={p.yellow} />
        {/* 倾倒的液流：从 B 杯口落到液面 */}
        <mesh ref={stream} position={[0.34, 0.78, 0]} visible={false}>
          <cylinderGeometry args={[0.018, 0.012, 0.56, 10]} />
          <meshPhysicalMaterial color={CLEAR} transparent opacity={0.6} roughness={0.05} />
        </mesh>
      </group>
      <group ref={bGroup} position={B_REST.toArray()}>
        {/* 枢轴在杯口左缘：倾倒时绕杯口转 */}
        <group position={[0.2, -0.5, 0]}>
          <mesh position={[0, 0.25, 0]} renderOrder={3}>
            <cylinderGeometry args={[0.2, 0.2, 0.5, 40, 1, true]} />
            {glassMaterial()}
          </mesh>
          <mesh ref={bLiquid} position={[0, 0.02, 0]}>
            <cylinderGeometry args={[0.19, 0.19, 0.3, 40]} />
            <meshStandardMaterial color="#e4eef3" transparent opacity={0.45} depthWrite={false} />
          </mesh>
          <Html position={[0, 0.62, 0]} center zIndexRange={[5, 0]} style={{ pointerEvents: "none" }}>
            <span className="whitespace-nowrap rounded bg-black/55 px-1 font-mono text-[10px] text-white">B · H₂O₂</span>
          </Html>
        </group>
      </group>
    </group>
  );
}

function smooth(x: number) { return x * x * (3 - 2 * x); }
function clamp01(x: number) { return Math.min(1, Math.max(0, x)); }

/** 恒温磁力搅拌器：铝合金顶板 + 白色机身 + 前面板数显（温度、计时）+ 两个旋钮 */
function Stirrer({ tempC, elapsed, running }: { tempC: number; elapsed: number; running: boolean }) {
  return (
    <group>
      <mesh position={[0, 0.15, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.1, 0.3, 1.0]} />
        <meshPhysicalMaterial color="#eceff1" roughness={0.35} clearcoat={0.4} />
      </mesh>
      <mesh position={[0, PLATE_Y - 0.03, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.5, 0.5, 0.06, 64]} />
        <meshStandardMaterial color="#b9c0c6" metalness={0.75} roughness={0.35} />
      </mesh>
      {/* 前面板 */}
      <mesh position={[0, 0.15, 0.501]}>
        <planeGeometry args={[1.04, 0.24]} />
        <meshStandardMaterial color="#22282d" roughness={0.6} />
      </mesh>
      {[-0.46, 0.46].map((x, i) => (
        <mesh key={x} position={[x, 0.15, 0.53]} rotation={[Math.PI / 2, 0, 0]} castShadow>
          <cylinderGeometry args={[0.04, 0.045, 0.05, 24]} />
          <meshStandardMaterial color={i ? "#d24b3c" : "#3c6fd2"} roughness={0.4} />
        </mesh>
      ))}
      <Html position={[0, 0.15, 0.51]} transform scale={0.095} zIndexRange={[5, 0]} style={{ pointerEvents: "none" }}>
        <div className="flex items-center gap-6 font-mono tabular-nums" style={{ color: "#7dffb0", textShadow: "0 0 6px #2bff7a" }}>
          <span className="text-[22px]">{tempC.toFixed(1)}℃</span>
          <span className="text-[22px]" data-testid="clock-display">{fmt(elapsed)}</span>
          <span className="text-[14px]" style={{ opacity: running ? 1 : 0.25 }}>⟳ 600 rpm</span>
        </div>
      </Html>
    </group>
  );
}

function fmt(s: number) {
  const m = Math.floor(s / 60);
  return `${String(m).padStart(2, "0")}:${(s % 60).toFixed(1).padStart(4, "0")}`;
}
