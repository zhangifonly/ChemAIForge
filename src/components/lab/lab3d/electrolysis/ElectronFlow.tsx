"use client";

// 导线上的电子流：沿一条折线路径移动的亮点。
//
// 方向是教学重点：电子从电源负极流出 → 进入阴极（在阴极被 Cu²⁺ 夺走）；
// 另一路从阳极流出（阳极失电子）→ 回到电源正极。与"电流从正极流出"方向相反，
// 学生最常在这里搞混，所以画面必须严格按电子方向走。
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

export interface ElectronFlowProps {
  /** 路径点（按电子流动方向排列） */
  points: [number, number, number][];
  /** 电流 A，决定速度；0 时不显示 */
  current: number;
  timeScale: number;
  count?: number;
}

export function ElectronFlow({ points, current, timeScale, count = 14 }: ElectronFlowProps) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const curve = useMemo(
    () => new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)), false, "catmullrom", 0.05),
    [points],
  );
  const offset = useRef(0);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const geo = useMemo(() => new THREE.SphereGeometry(0.022, 8, 6), []);
  const mat = useMemo(
    () => new THREE.MeshBasicMaterial({ color: "#9ff3ff", toneMapped: false }),
    [],
  );

  useFrame((_, rawDt) => {
    const mesh = ref.current;
    if (!mesh) return;
    const dt = Math.min(rawDt, 1 / 20);
    // 速度 ∝ 电流，时间倍率封顶避免看不清
    offset.current = (offset.current + dt * current * 0.18 * Math.min(timeScale, 6)) % 1;
    for (let i = 0; i < count; i++) {
      const u = (i / count + offset.current) % 1;
      dummy.position.copy(curve.getPointAt(u));
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  });

  if (current <= 0) return null;
  return <instancedMesh ref={ref} args={[geo, mat, count]} frustumCulled={false} />;
}
