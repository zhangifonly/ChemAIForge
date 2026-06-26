"use client";

// 通用 glTF 模型加载组件：加载 public/models/lab 下的专业器材模型，
// 自动增强玻璃材质（材质名含 glass/玻璃 时提高透明与折射感）。
// 模型缺失时由上层 ErrorBoundary 回退到程序化几何，保证不崩。
import { useEffect, useMemo } from "react";
import { useGLTF } from "@react-three/drei";
import { MeshPhysicalMaterial, Mesh, type Group } from "three";

export function GltfModel({
  url,
  scale = 1,
  position = [0, 0, 0],
}: {
  url: string;
  scale?: number;
  position?: [number, number, number];
}) {
  const { scene } = useGLTF(url);
  // 克隆避免多实例共享同一材质引用
  const cloned = useMemo(() => scene.clone(true), [scene]);

  useEffect(() => {
    cloned.traverse((o) => {
      if (!(o instanceof Mesh)) return;
      o.castShadow = true;
      o.receiveShadow = true;
      const mat = o.material;
      const name = (Array.isArray(mat) ? mat[0]?.name : mat?.name) ?? "";
      // 玻璃材质增强：透明 + 物理折射
      if (/glass|玻璃|transparent/i.test(name) || /glass|玻璃/i.test(o.name)) {
        const glass = new MeshPhysicalMaterial({
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
        o.material = glass;
      }
    });
  }, [cloned]);

  return <primitive object={cloned as Group} scale={scale} position={position} />;
}

// 预加载（可选，调用方决定）
export function preloadModel(url: string) {
  useGLTF.preload(url);
}
