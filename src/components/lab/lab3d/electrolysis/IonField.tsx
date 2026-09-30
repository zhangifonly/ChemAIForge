"use client";

// 微观视角：电解液里的离子在电场下定向迁移。
//
// 每种离子一个 InstancedMesh（一次 draw call 画几百个），逐帧只改实例矩阵 ——
// 若每个离子一个 mesh，三百个离子就是三百次 draw call，手机上直接掉帧。
//
// 运动模型：热运动（随机游走）+ 电场漂移。漂移速度 ∝ 电流，方向由电荷决定：
// Cu²⁺ 向阴极（左）、SO₄²⁻ 向阳极（右）。到达电极后：
//   - Cu²⁺ 在阴极"放电"消失（化作铜层），再从溶液另一侧补入 —— 维持画面密度，
//     同时粒子数按真实浓度缩放，所以石墨阳极下蓝点会越来越稀；
//   - SO₄²⁻ 不放电，只是在阳极附近聚集后被热运动带回。
import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

export interface IonFieldProps {
  /** 液体空间的半宽（x）、高（y）、半深（z），单位与场景一致 */
  halfWidth: number;
  height: number;
  halfDepth: number;
  /** 液面底部 y */
  bottomY: number;
  /** 阴极、阳极所在 x（离子漂移的目标） */
  cathodeX: number;
  anodeX: number;
  /** 当前电流 A；0 表示断电，只剩热运动 */
  current: number;
  /** Cu²⁺ 浓度相对初始值的比例 0–1，决定蓝点数量 */
  cuFraction: number;
  /** 时间倍率：动画节奏随之加快，但封顶，避免离子"瞬移" */
  timeScale: number;
}

const MAX_CU = 220;
const MAX_SO4 = 220;

export function IonField(props: IonFieldProps) {
  const { halfWidth, height, halfDepth, bottomY, cathodeX, anodeX, current, cuFraction, timeScale } = props;
  const cuRef = useRef<THREE.InstancedMesh>(null);
  const so4Ref = useRef<THREE.InstancedMesh>(null);

  // 粒子状态放在 ref 里逐帧原地修改，不走 React state（每帧 setState 会让整棵树重渲染）
  const state = useMemo(() => {
    const rand = (a: number, b: number) => a + Math.random() * (b - a);
    const spawn = () =>
      new THREE.Vector3(rand(-halfWidth, halfWidth), rand(bottomY, bottomY + height), rand(-halfDepth, halfDepth));
    return {
      cu: Array.from({ length: MAX_CU }, spawn),
      so4: Array.from({ length: MAX_SO4 }, spawn),
      spawn,
    };
  }, [halfWidth, height, halfDepth, bottomY]);

  const dummy = useMemo(() => new THREE.Object3D(), []);

  // 几何与材质只建一次；发光材质让离子在深蓝溶液里也看得清
  const cuGeo = useMemo(() => new THREE.SphereGeometry(0.028, 10, 8), []);
  const so4Geo = useMemo(() => new THREE.SphereGeometry(0.036, 10, 8), []);
  const cuMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: "#5aa9ff", emissive: "#1f6fe0", emissiveIntensity: 0.9, roughness: 0.3 }),
    [],
  );
  const so4Mat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: "#ffd24a", emissive: "#c98a00", emissiveIntensity: 0.7, roughness: 0.35 }),
    [],
  );
  useEffect(
    () => () => {
      cuGeo.dispose();
      so4Geo.dispose();
      cuMat.dispose();
      so4Mat.dispose();
    },
    [cuGeo, so4Geo, cuMat, so4Mat],
  );

  useFrame((_, rawDt) => {
    // 切后台再回来时 dt 可能是好几秒，不夹住的话离子会一帧飞出液体
    const dt = Math.min(rawDt, 1 / 20);
    // 漂移速度：电流越大越快；时间倍率加快节奏但封顶在 6 倍，保持可看清
    const pace = Math.min(timeScale, 6);
    // 漂移与热运动同量级：漂移太快离子一秒就冲过整个槽、在两极间挤成一团，
    // 看不出"在溶液里定向迁移"；太慢又看不出方向。真实离子的漂移速度本就远小于热运动
    const drift = current * 0.06 * pace;
    const jitter = 0.35;

    const liveCu = Math.round(MAX_CU * Math.max(0, Math.min(1, cuFraction)));

    const step = (list: THREE.Vector3[], targetX: number, n: number, onArrive: (p: THREE.Vector3) => void) => {
      for (let i = 0; i < n; i++) {
        const p = list[i];
        p.x += (Math.random() - 0.5) * jitter * dt * 2;
        p.y += (Math.random() - 0.5) * jitter * dt * 2;
        p.z += (Math.random() - 0.5) * jitter * dt * 2;
        if (drift > 0) p.x += Math.sign(targetX - p.x) * drift * dt;
        // 边界：保持在液体内
        p.y = THREE.MathUtils.clamp(p.y, bottomY, bottomY + height);
        p.z = THREE.MathUtils.clamp(p.z, -halfDepth, halfDepth);
        p.x = THREE.MathUtils.clamp(p.x, -halfWidth, halfWidth);
        if (drift > 0 && Math.abs(p.x - targetX) < 0.06) onArrive(p);
      }
    };

    // Cu²⁺ 到达阴极即"放电"：重新从阳极一侧补入，形成持续的蓝色洪流
    step(state.cu, cathodeX, liveCu, (p) => {
      // 在溶液随机位置补入：代表溶液别处的 Cu²⁺。只从阳极补会让蓝点在阳极一侧堆积，
      // 读起来像 Cu²⁺ 从阳极产生 —— 石墨阳极下这是错的（铜阳极才溶出 Cu²⁺）
      p.copy(state.spawn());
    });
    // SO₄²⁻ 不放电：抵达阳极后被弹回溶液中部
    step(state.so4, anodeX, MAX_SO4, (p) => {
      // 弹回到整个溶液的随机位置：只弹回中部会让 SO₄²⁻ 全堆在两极之间
      p.x = THREE.MathUtils.lerp(anodeX, cathodeX, Math.random());
    });

    const write = (mesh: THREE.InstancedMesh | null, list: THREE.Vector3[], n: number) => {
      if (!mesh) return;
      for (let i = 0; i < n; i++) {
        dummy.position.copy(list[i]);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
      }
      mesh.count = n;
      mesh.instanceMatrix.needsUpdate = true;
    };
    write(cuRef.current, state.cu, liveCu);
    write(so4Ref.current, state.so4, MAX_SO4);
  });

  return (
    <group>
      <instancedMesh ref={cuRef} args={[cuGeo, cuMat, MAX_CU]} frustumCulled={false} />
      <instancedMesh ref={so4Ref} args={[so4Geo, so4Mat, MAX_SO4]} frustumCulled={false} />
    </group>
  );
}
