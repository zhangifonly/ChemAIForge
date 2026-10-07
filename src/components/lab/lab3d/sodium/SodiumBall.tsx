"use client";

// 水面上的钠球：熔成小球 → 被不对称喷出的氢气推着乱游 → 越缩越小直至消失。
// 运动是简单的受力积分：推力方向随机游走、推力大小正比反应速率、水的阻尼、撞壁反弹。
// 同时从球的位置发射三种粒子：白雾（水蒸气）、溅起的小水珠、大块钠的黄色钠焰。
import { useRef, type MutableRefObject } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { Particles, type ParticleApi } from "../showcase/Particles";
import { DISH, CM, MAG, type BallMotion } from "./shared";
import type { SodiumReadings } from "./model";

const FLAME_COLORS = ["#ffd447", "#ffb52e", "#ff9a1f"].map((c) => new THREE.Color(c));
const MIST = new THREE.Color("#f4f7fa");

export function SodiumBall({
  motion,
  r,
  meltT,
}: {
  motion: MutableRefObject<BallMotion>;
  r: SodiumReadings;
  /** 入水后经过的秒数，用于"熔成小球"的形变过渡 */
  meltT: number;
}) {
  const ball = useRef<THREE.Mesh>(null);
  const light = useRef<THREE.PointLight>(null);
  const mist = useRef<ParticleApi>(null);
  const fire = useRef<ParticleApi>(null);
  const wasBurning = useRef(false);
  const acc = useRef({ mist: 0, drop: 0, fire: 0 });

  // 0.05 g ~ 0.011 g/s，0.4 g ~ 0.042 g/s；开方压缩一下，让小块也有明显动作
  const intensity = Math.min(1, Math.sqrt(r.rateGps / 0.045));
  const radius = r.radiusCm * CM * MAG;

  useFrame((state, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    const m = motion.current;
    m.r = radius;
    m.intensity = intensity;
    m.active = !r.done && radius > 0;
    m.splash = Math.max(0, m.splash - dt * 0.9);

    if (m.active) {
      m.heading += (Math.random() - 0.5) * 7 * dt;
      const thrust = 0.35 + 1.6 * intensity;
      m.vx += Math.cos(m.heading) * thrust * dt;
      m.vz += Math.sin(m.heading) * thrust * dt;
      const k = Math.exp(-2.2 * dt);
      m.vx *= k;
      m.vz *= k;
      m.x += m.vx * dt;
      m.z += m.vz * dt;
      // 撞壁：沿法向反弹并把推力方向也掰回来，否则会贴着杯壁绕圈
      const lim = DISH.r - DISH.wall - radius - 0.02;
      const d = Math.hypot(m.x, m.z);
      if (d > lim) {
        const nx = m.x / d, nz = m.z / d;
        const vn = m.vx * nx + m.vz * nz;
        if (vn > 0) { m.vx -= 1.6 * vn * nx; m.vz -= 1.6 * vn * nz; }
        m.x = nx * lim; m.z = nz * lim;
        m.heading = Math.atan2(-nz, -nx) + (Math.random() - 0.5) * 1.6;
      }
    }

    const y = DISH.water + radius * 0.35;
    if (ball.current) {
      const melt = Math.min(1, meltT / 0.8);
      const wob = 1 + Math.sin(state.clock.elapsedTime * 23) * 0.05 * intensity;
      ball.current.visible = radius > 0.002;
      ball.current.position.set(m.x, y, m.z);
      ball.current.scale.set(radius * wob, radius * (0.82 / wob) * (0.6 + 0.4 * melt), radius * wob);
      ball.current.rotation.y += dt * 4 * intensity;
    }

    // —— 粒子发射：按速率换算成每秒个数，累加器保证低帧率下数量也对 ——
    const a = acc.current;
    if (m.active) {
      a.mist += dt * (8 + 40 * intensity);
      a.drop += dt * (4 + 30 * intensity);
      for (; a.mist >= 1; a.mist--) {
        mist.current?.emit({ x: m.x + (Math.random() - 0.5) * radius, y: y + radius * 0.4, z: m.z + (Math.random() - 0.5) * radius,
          vx: (Math.random() - 0.5) * 0.05, vy: 0.18 + Math.random() * 0.15, vz: (Math.random() - 0.5) * 0.05,
          life: 1.6 + Math.random(), size: 0.05 + radius * 0.6, grow: 1.4, color: MIST, alpha: 0.28, drag: 0.6 });
      }
      for (; a.drop >= 1; a.drop--) {
        const ang = Math.random() * Math.PI * 2, sp = 0.25 + Math.random() * 0.5 * (0.4 + intensity);
        mist.current?.emit({ x: m.x, y, z: m.z, vx: Math.cos(ang) * sp, vy: 0.4 + Math.random() * 0.7, vz: Math.sin(ang) * sp,
          life: 0.35 + Math.random() * 0.25, size: 0.014, color: "#ffffff", alpha: 0.9, gravity: 4.5 });
      }
    }
    if (r.ignites) {
      a.fire += dt * 90;
      for (; a.fire >= 1; a.fire--) {
        fire.current?.emit({ x: m.x + (Math.random() - 0.5) * radius * 0.8, y: y + radius * 0.5, z: m.z + (Math.random() - 0.5) * radius * 0.8,
          vx: (Math.random() - 0.5) * 0.1, vy: 0.5 + Math.random() * 0.5, vz: (Math.random() - 0.5) * 0.1,
          life: 0.25 + Math.random() * 0.25, size: 0.09 + radius * 0.5, grow: -1.2,
          color: FLAME_COLORS[(Math.random() * 3) | 0], alpha: 0.75 });
      }
    }
    // 大块钠反应到最后常"啪"地爆一下：燃烧结束的那一帧放一团火星
    if (wasBurning.current && !r.ignites && r.done) {
      for (let i = 0; i < 60; i++) {
        const ang = Math.random() * Math.PI * 2, sp = 0.4 + Math.random() * 1.2;
        fire.current?.emit({ x: m.x, y, z: m.z, vx: Math.cos(ang) * sp, vy: 0.5 + Math.random() * 1.4, vz: Math.sin(ang) * sp,
          life: 0.4 + Math.random() * 0.4, size: 0.05, color: FLAME_COLORS[i % 3], alpha: 0.9, gravity: 3 });
      }
      if (light.current) light.current.intensity = 14;
    }
    wasBurning.current = r.ignites;
    if (light.current) {
      const target = r.ignites ? 3 + Math.random() * 1.5 : 0;
      light.current.intensity = THREE.MathUtils.lerp(light.current.intensity, target, 0.25);
      light.current.position.set(m.x, y + 0.25, m.z);
    }
  });

  return (
    <>
      <mesh ref={ball} castShadow>
        <sphereGeometry args={[1, 48, 32]} />
        {/* 熔融钠：近乎镜面的银白，略带暖色，靠环境反射显出"液态金属"感 */}
        <meshPhysicalMaterial color="#e7e9ec" metalness={1} roughness={0.08} clearcoat={1} envMapIntensity={1.4} />
      </mesh>
      <pointLight ref={light} color="#ffb340" intensity={0} distance={3} decay={2} />
      <Particles ref={mist} max={700} />
      <Particles ref={fire} max={500} additive />
    </>
  );
}
