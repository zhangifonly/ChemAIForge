"use client";

// 通用 glTF 模型加载组件：加载 public/models/lab 下的专业器材模型。
// 关键能力：自动归一化（auto-fit）——运行时读包围盒，自动居中、缩放到目标真实
// 高度、可选 Z-up→Y-up 直立、底部对齐 y=0。这样不同来源/尺度/朝向的模型都能
// 正确稳定地摆放，无需手工逐个试参数。
// 同时自动增强玻璃材质（材质名含 glass/玻璃 时提高透明与折射感）。
import { useLayoutEffect, useMemo, useRef } from "react";
import { useGLTF } from "@react-three/drei";
import { MeshPhysicalMaterial, Mesh, Box3, Vector3, Group } from "three";

export interface FitOptions {
  height?: number; // 缩放后整体高度（米）
  upright?: boolean; // true: 绕 X 轴 -90°，把 Z-up 模型立起来
  anchorBottom?: boolean; // true: 底面贴 y=0；否则几何中心居中
}

export function GltfModel({
  url,
  scale,
  position = [0, 0, 0],
  fit,
}: {
  url: string;
  scale?: number;
  position?: [number, number, number];
  fit?: FitOptions;
}) {
  const { scene } = useGLTF(url);
  const cloned = useMemo(() => scene.clone(true), [scene]);
  const inner = useRef<Group>(null);

  // 材质增强（玻璃）
  useLayoutEffect(() => {
    cloned.traverse((o) => {
      if (!(o instanceof Mesh)) return;
      o.castShadow = true;
      o.receiveShadow = true;
      const mat = o.material;
      const name = (Array.isArray(mat) ? mat[0]?.name : mat?.name) ?? "";
      if (/glass|玻璃|transparent/i.test(name) || /glass|玻璃/i.test(o.name)) {
        o.material = new MeshPhysicalMaterial({
          color: "#eef7ff",
          transparent: true,
          opacity: 0.3,
          roughness: 0.06,
          metalness: 0,
          transmission: 0.7,
          ior: 1.45,
          thickness: 0.3,
          depthWrite: false,
        });
      }
    });
  }, [cloned]);

  // 自动归一化：旋转 → 量包围盒 → 缩放 → 居中/落底
  useLayoutEffect(() => {
    const g = inner.current;
    if (!g) return;
    g.rotation.set(fit?.upright ? -Math.PI / 2 : 0, 0, 0);
    g.scale.setScalar(1);
    g.position.set(0, 0, 0);
    g.updateWorldMatrix(true, true);
    // 第一次量包围盒（缩放=1），决定缩放系数
    const box1 = new Box3().setFromObject(g);
    const size = box1.getSize(new Vector3());
    let s = scale ?? 1;
    if (fit?.height && size.y > 1e-6) s = fit.height / size.y;
    g.scale.setScalar(s);
    g.updateWorldMatrix(true, true);
    // 缩放后重新量包围盒，据此平移：XZ 居中，Y 落底或居中
    const box2 = new Box3().setFromObject(g);
    const c2 = box2.getCenter(new Vector3());
    g.position.set(
      -c2.x,
      fit?.anchorBottom ? -box2.min.y : -c2.y,
      -c2.z,
    );
  }, [cloned, scale, fit?.height, fit?.upright, fit?.anchorBottom]);

  return (
    <group position={position}>
      <primitive ref={inner} object={cloned} />
    </group>
  );
}

export function preloadModel(url: string) {
  useGLTF.preload(url);
}
