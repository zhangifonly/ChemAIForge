"use client";

// 体积火焰网格：包围圆柱 + 光线步进着色器。相机位置换算到网格局部坐标传给着色器，
// 所以绕着火焰转动视角时，火焰始终是一个立体的锥而不是一张贴片。
// 另带一盏随焰色变化、随火焰跳动的点光源，把颜色投到铂丝、灯管和台面上。
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { FLAME_FRAG, FLAME_VERT } from "./flameShader";

export interface FlameLook {
  tint: THREE.Color;
  /** 0..1 被样品染色的程度 */
  amount: number;
}

export function BunsenFlame({
  look,
  wireLocal,
  lit,
  height = 0.9,
}: {
  look: React.MutableRefObject<FlameLook>;
  /** 铂丝环在火焰局部坐标中的位置（以火焰高度为 1 归一） */
  wireLocal: React.MutableRefObject<THREE.Vector3>;
  lit: boolean;
  height?: number;
}) {
  const mesh = useRef<THREE.Mesh>(null);
  const light = useRef<THREE.PointLight>(null);
  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uTint: { value: new THREE.Color("#4f7bff") },
      uTintAmt: { value: 0 },
      uPower: { value: 0 },
      uFlicker: { value: 1 },
      uWire: { value: new THREE.Vector3(9, 9, 9) },
      uCam: { value: new THREE.Vector3() },
    }),
    [],
  );
  const tmp = useMemo(() => new THREE.Vector3(), []);
  const lightCol = useMemo(() => new THREE.Color(), []);

  useFrame((state, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    const m = mesh.current;
    if (!m) return;
    const u = uniforms;
    u.uTime.value = state.clock.elapsedTime;
    u.uPower.value += ((lit ? 1 : 0) - u.uPower.value) * (1 - Math.exp(-dt * 6));
    // 焰色变化要有过渡：样品蒸气进入火焰需要零点几秒
    u.uTint.value.lerp(look.current.tint, 1 - Math.exp(-dt * 8));
    u.uTintAmt.value += (look.current.amount - u.uTintAmt.value) * (1 - Math.exp(-dt * 8));
    u.uWire.value.copy(wireLocal.current);
    m.updateWorldMatrix(true, false);
    u.uCam.value.copy(m.worldToLocal(tmp.copy(state.camera.position)));
    if (light.current) {
      const flick = 1 + Math.sin(u.uTime.value * 17) * 0.06 + Math.sin(u.uTime.value * 29) * 0.04;
      lightCol.set("#5f86ff").lerp(u.uTint.value, Math.min(1, u.uTintAmt.value * 1.3));
      light.current.color.copy(lightCol);
      light.current.intensity = u.uPower.value * (0.6 + 3.2 * u.uTintAmt.value) * flick;
    }
  });

  return (
    <group scale={height}>
      {/* 包围体：半径 0.2、高 1，底面在 y=0。BackSide 让相机贴近甚至进入时也能渲染 */}
      <mesh ref={mesh} position={[0, 0.5, 0]} renderOrder={10}>
        <cylinderGeometry args={[0.2, 0.2, 1, 24, 1]} />
        <shaderMaterial
          vertexShader={FLAME_VERT.replace("vLocal = position;", "vLocal = position + vec3(0.0, 0.5, 0.0);")}
          fragmentShader={FLAME_FRAG.replace("vec3 ro = uCam;", "vec3 ro = uCam + vec3(0.0, 0.5, 0.0);")}
          uniforms={uniforms}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          side={THREE.BackSide}
        />
      </mesh>
      <pointLight ref={light} position={[0, 0.45, 0]} distance={4} decay={2} intensity={0} />
    </group>
  );
}
