"use client";

// 竖屏画布（手机上画布高大于宽）时放大视场角：相机按横屏构图摆好，竖屏下左右两侧的
// 器材会被裁掉（钠与水的结晶皿只剩半个）。视场角按宽高比补偿，横屏不受影响。
import { useEffect } from "react";
import { useThree } from "@react-three/fiber";
import type { PerspectiveCamera } from "three";

export function FitPortrait({ baseFov = 40, wide = 1.2 }: { baseFov?: number; wide?: number }) {
  const camera = useThree((s) => s.camera) as PerspectiveCamera;
  const aspect = useThree((s) => s.size.width / Math.max(1, s.size.height));
  useEffect(() => {
    if (!("fov" in camera)) return;
    // 保持水平视角不小于"宽高比 = wide"时的水平视角
    const fov = aspect >= wide
      ? baseFov
      : (2 * Math.atan(Math.tan((baseFov * Math.PI) / 360) * (wide / aspect)) * 180) / Math.PI;
    camera.fov = Math.min(fov, 75);
    camera.updateProjectionMatrix();
  }, [camera, aspect, baseFov, wide]);
  return null;
}
