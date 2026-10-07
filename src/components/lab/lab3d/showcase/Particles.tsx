"use client";

// 通用粒子池：固定容量环形缓冲，CPU 更新、一次 draw call 画完。
// 发射点可以每帧移动（游动的钠球、移动的铂丝），这是现有 Sparks/Smoke 组件
// （起点固定、数量固定）做不到的。软边圆点着色器 + 按寿命淡出 + 可选尺寸增长。
import { forwardRef, useImperativeHandle, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

export interface Emit {
  x: number; y: number; z: number;
  vx?: number; vy?: number; vz?: number;
  life: number;
  size: number;
  /** 每秒尺寸增长倍率（雾气扩散用），默认 0 */
  grow?: number;
  color: THREE.Color | string;
  alpha?: number;
  gravity?: number;
  drag?: number;
}

export interface ParticleApi {
  emit: (e: Emit) => void;
}

const VERT = /* glsl */ `
  attribute float aSize; attribute float aAlpha; attribute vec3 aColor;
  varying float vAlpha; varying vec3 vColor;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aSize * 300.0 / -mv.z;
    gl_Position = projectionMatrix * mv;
    vAlpha = aAlpha; vColor = aColor;
  }`;
const FRAG = /* glsl */ `
  varying float vAlpha; varying vec3 vColor;
  void main() {
    float d = length(gl_PointCoord - 0.5) * 2.0;
    float a = smoothstep(1.0, 0.0, d) * vAlpha;
    if (a < 0.01) discard;
    gl_FragColor = vec4(vColor, a);
  }`;

export const Particles = forwardRef<ParticleApi, { max?: number; additive?: boolean }>(function Particles(
  { max = 512, additive = false },
  ref,
) {
  const geom = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(max * 3), 3));
    g.setAttribute("aSize", new THREE.BufferAttribute(new Float32Array(max), 1));
    g.setAttribute("aAlpha", new THREE.BufferAttribute(new Float32Array(max), 1));
    g.setAttribute("aColor", new THREE.BufferAttribute(new Float32Array(max * 3), 3));
    return g;
  }, [max]);
  // 每个粒子的运动参数：vx vy vz age life size grow alpha gravity drag
  const sim = useMemo(() => new Float32Array(max * 10), [max]);
  const cursor = useRef(0);
  const tmp = useMemo(() => new THREE.Color(), []);

  useImperativeHandle(ref, () => ({
    emit(e) {
      const i = cursor.current;
      cursor.current = (i + 1) % max;
      const pos = geom.attributes.position.array as Float32Array;
      pos.set([e.x, e.y, e.z], i * 3);
      const c = typeof e.color === "string" ? tmp.set(e.color) : e.color;
      (geom.attributes.aColor.array as Float32Array).set([c.r, c.g, c.b], i * 3);
      sim.set([e.vx ?? 0, e.vy ?? 0, e.vz ?? 0, 0, e.life, e.size, e.grow ?? 0, e.alpha ?? 1, e.gravity ?? 0, e.drag ?? 0], i * 10);
    },
  }));

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    const pos = geom.attributes.position.array as Float32Array;
    const size = geom.attributes.aSize.array as Float32Array;
    const alpha = geom.attributes.aAlpha.array as Float32Array;
    for (let i = 0; i < max; i++) {
      const s = i * 10;
      const life = sim[s + 4];
      if (life <= 0) { alpha[i] = 0; continue; }
      const age = (sim[s + 3] += dt);
      if (age >= life) { sim[s + 4] = 0; alpha[i] = 0; continue; }
      const k = Math.exp(-sim[s + 9] * dt);
      sim[s] *= k; sim[s + 2] *= k;
      sim[s + 1] = sim[s + 1] * k - sim[s + 8] * dt;
      pos[i * 3] += sim[s] * dt;
      pos[i * 3 + 1] += sim[s + 1] * dt;
      pos[i * 3 + 2] += sim[s + 2] * dt;
      const u = age / life;
      size[i] = sim[s + 5] * (1 + sim[s + 6] * age);
      // 先快速淡入再缓慢淡出，避免粒子"凭空出现"
      alpha[i] = sim[s + 7] * Math.min(1, u * 8) * (1 - u) ** 1.5;
    }
    geom.attributes.position.needsUpdate = true;
    geom.attributes.aSize.needsUpdate = true;
    geom.attributes.aAlpha.needsUpdate = true;
    geom.attributes.aColor.needsUpdate = true;
  });

  return (
    <points geometry={geom} frustumCulled={false} renderOrder={5}>
      <shaderMaterial
        vertexShader={VERT}
        fragmentShader={FRAG}
        transparent
        depthWrite={false}
        blending={additive ? THREE.AdditiveBlending : THREE.NormalBlending}
      />
    </points>
  );
});
