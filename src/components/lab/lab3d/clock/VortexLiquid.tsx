"use client";

// 搅拌中的溶液：液面按兰金涡（中心下陷 ∝ e^(−r²/σ²)）凹下并旋转，
// 着色器在旋转坐标里画几道随液流转动的细纹，搅拌看得出来。
// 变色那一刻颜色不是一下子整杯换掉，而是从涡心沿螺旋带"卷"出去 —— 真实情况就是这样：
// 局部最先过阈值的地方先蓝，再被搅匀。uBlue/uYellow 来自 model.mixture()。
import { useMemo, useRef, type MutableRefObject } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

const VERT = /* glsl */ `
  uniform float uDepth, uSigma, uSpin;
  varying vec2 vP; varying float vR;
  void main() {
    vec3 p = position;
    float r2 = dot(p.xy, p.xy);
    p.z -= uDepth * exp(-r2 / (uSigma * uSigma));
    vP = p.xy; vR = sqrt(r2);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }`;

const FRAG = /* glsl */ `
  uniform float uTime, uSpin, uBlue, uYellow, uRadius;
  uniform vec3 uClear, uBlueCol, uYellowCol;
  varying vec2 vP; varying float vR;
  void main() {
    float a = atan(vP.y, vP.x);
    float rn = vR / uRadius;
    // 螺旋相位：整体转动 + 固定的径向扭角。不能让角速度随半径变，否则相位差随时间无限累积成密集同心环
    float ph = a - uTime * uSpin + rn * 5.0;
    float streak = 0.5 + 0.5 * sin(ph * 3.0);
    // 变色前沿：涡心先到，螺旋带领先
    float front = clamp(uBlue * 1.6 - rn * 0.6 + (streak - 0.5) * 0.35, 0.0, 1.0);
    float frontY = clamp(uYellow * 1.6 - rn * 0.6 + (streak - 0.5) * 0.35, 0.0, 1.0);
    vec3 col = mix(uClear, uYellowCol, frontY);
    col = mix(col, uBlueCol, front);
    col *= 0.94 + 0.06 * streak * step(0.01, uSpin);
    // 液面高光：涡壁倾斜处更亮
    float rim = smoothstep(0.85, 1.0, rn) * 0.15;
    float alpha = 0.45 + 0.5 * max(front, frontY);
    gl_FragColor = vec4(col + rim, alpha);
  }`;

export const CLEAR = new THREE.Color("#dfeaf0");
export const BLUE = new THREE.Color("#141a52");
export const YELLOW = new THREE.Color("#c4851c");

export function VortexLiquid({
  radius,
  levelRef,
  stirring,
  blue,
  yellow,
}: {
  radius: number;
  /** 液面高度（相对杯底）；倾倒时每帧变化，用 ref 传以免整树重渲染 */
  levelRef: MutableRefObject<number>;
  stirring: boolean;
  blue: number;
  yellow: number;
}) {
  const body = useRef<THREE.MeshPhysicalMaterial>(null);
  const top = useRef<THREE.Mesh>(null);
  const side = useRef<THREE.Mesh>(null);
  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 }, uSpin: { value: 0 }, uDepth: { value: 0 }, uSigma: { value: radius * 0.45 },
      uBlue: { value: 0 }, uYellow: { value: 0 }, uRadius: { value: radius },
      uClear: { value: CLEAR }, uBlueCol: { value: BLUE }, uYellowCol: { value: YELLOW },
    }),
    [radius],
  );
  const col = useMemo(() => new THREE.Color(), []);

  useFrame((state, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    const u = uniforms;
    u.uTime.value = state.clock.elapsedTime;
    const ease = 1 - Math.exp(-dt * 2);
    u.uSpin.value += ((stirring ? 3 : 0) - u.uSpin.value) * ease;
    u.uDepth.value = u.uSpin.value * 0.03;
    // 颜色有半秒量级的"卷开"过程
    u.uBlue.value += (blue - u.uBlue.value) * (1 - Math.exp(-dt * 3));
    u.uYellow.value += (yellow - u.uYellow.value) * (1 - Math.exp(-dt * 3));
    const level = levelRef.current;
    top.current?.position.setY(level);
    side.current?.scale.set(1, level, 1);
    side.current?.position.setY(level / 2);
    if (body.current) {
      col.copy(CLEAR).lerp(YELLOW, Math.min(1, u.uYellow.value * 1.2)).lerp(BLUE, Math.min(1, u.uBlue.value * 1.15));
      body.current.color.copy(col);
      body.current.opacity = 0.3 + 0.6 * Math.max(u.uBlue.value, u.uYellow.value * 0.7);
    }
  });

  return (
    <group>
      <mesh ref={side} position={[0, 0, 0]} renderOrder={1}>
        <cylinderGeometry args={[radius, radius, 1, 64, 1, true]} />
        <meshPhysicalMaterial ref={body} transparent opacity={0.3} roughness={0.15} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      <mesh ref={top} rotation={[-Math.PI / 2, 0, 0]} renderOrder={2}>
        {/* 环形网格带径向细分，液面才能凹成涡 */}
        <ringGeometry args={[0.0005, radius, 96, 32]} />
        <shaderMaterial vertexShader={VERT} fragmentShader={FRAG} uniforms={uniforms} transparent depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}
