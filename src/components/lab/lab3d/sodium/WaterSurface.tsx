"use client";

// 结晶皿水面：顶点着色器以钠球为中心发出同心涟漪，片元着色器按导数法线做菲涅尔反光。
// 生成的 NaOH 记在一张 256² 的"浓度画布"上：钠球经过处涂白、整体缓慢模糊扩散，
// 着色器把它乘以酚酞显色得到粉红拖尾 —— 所以先投钠后滴酚酞，拖尾也会"补显"出来，
// 与真实情况一致（碱已经在水里，指示剂只是让它看得见）。
import { useEffect, useMemo, useRef, type MutableRefObject } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { DISH, type BallMotion } from "./shared";
import { WATER_VERT, WATER_FRAG } from "./waterShader";

const N = 256;

export function WaterSurface({
  motion,
  pinkAll,
  phenol,
}: {
  motion: MutableRefObject<BallMotion>;
  /** 整杯溶液的酚酞显色 0..1（由整体 pH 算出） */
  pinkAll: number;
  phenol: boolean;
}) {
  const { canvas, ctx, tex } = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = N;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, N, N);
    const tex = new THREE.CanvasTexture(canvas);
    return { canvas, ctx, tex };
  }, []);
  useEffect(() => () => tex.dispose(), [tex]);

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uBall: { value: new THREE.Vector2() },
      uBallR: { value: 0.05 },
      uAmp: { value: 0 },
      uSplash: { value: 0 },
      uDye: { value: tex },
      uPinkAll: { value: 0 },
      uPhenol: { value: 0 },
    }),
    [tex],
  );

  const frame = useRef(0);
  useFrame((state, dt) => {
    const m = motion.current;
    uniforms.uTime.value = state.clock.elapsedTime;
    // 局部坐标：水面网格绕 X 轴转了 −90°，局部 y = −世界 z
    uniforms.uBall.value.set(m.x, -m.z);
    uniforms.uBallR.value = m.r;
    uniforms.uAmp.value = THREE.MathUtils.lerp(uniforms.uAmp.value, m.active ? m.intensity : 0, 0.1);
    uniforms.uSplash.value = m.splash;
    // 整体显色按扩散时间常数 ~10 s 跟上，早期以钠球身后的局部红迹为主
    uniforms.uPinkAll.value += (pinkAll - uniforms.uPinkAll.value) * (1 - Math.exp(-Math.min(dt, 0.1) / 10));
    uniforms.uPhenol.value = THREE.MathUtils.lerp(uniforms.uPhenol.value, phenol ? 1 : 0, 0.04);

    // —— NaOH 浓度画布：涂、扩散、缓慢均化 ——
    frame.current++;
    if (m.active && m.intensity > 0.01) {
      const px = ((m.x / DISH.r + 1) / 2) * N;
      const py = ((m.z / DISH.r + 1) / 2) * N;
      const rad = 6 + m.r * 60;
      const g = ctx.createRadialGradient(px, py, 0, px, py, rad);
      g.addColorStop(0, `rgba(255,255,255,${Math.min(0.5, 0.12 + m.intensity * 0.35) * Math.min(1, dt * 60)})`);
      g.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(px, py, rad, 0, Math.PI * 2);
      ctx.fill();
    }
    if (frame.current % 3 === 0) {
      // 扩散：自身模糊重绘；Safari 不支持 ctx.filter 时退化为只淡出，不影响正确性
      ctx.filter = "blur(1.4px)";
      ctx.drawImage(canvas, 0, 0);
      ctx.filter = "none";
      ctx.fillStyle = "rgba(0,0,0,0.012)";
      ctx.fillRect(0, 0, N, N);
    }
    tex.needsUpdate = true;
  });

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, DISH.water, 0]} renderOrder={2}>
      <ringGeometry args={[0.0005, DISH.r - 0.004, 160, 64]} />
      <shaderMaterial
        vertexShader={WATER_VERT}
        fragmentShader={WATER_FRAG}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}
