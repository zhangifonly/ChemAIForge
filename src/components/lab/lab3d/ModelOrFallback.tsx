"use client";

// 模型加载容错包装：优先加载专业 glTF 模型，文件缺失/加载失败时回退到
// 程序化几何（fallback），保证未放模型前应用照常可用、不崩溃。
import { Component, Suspense, type ReactNode } from "react";
import { GltfModel } from "./GltfModel";

class ModelErrorBoundary extends Component<
  { fallback: ReactNode; children: ReactNode },
  { failed: boolean }
> {
  constructor(props: { fallback: ReactNode; children: ReactNode }) {
    super(props);
    this.state = { failed: false };
  }
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

// url：模型路径；fallback：模型不可用时的程序化几何
export function ModelOrFallback({
  url,
  scale,
  position,
  fallback,
}: {
  url: string;
  scale?: number;
  position?: [number, number, number];
  fallback: ReactNode;
}) {
  return (
    <ModelErrorBoundary fallback={fallback}>
      <Suspense fallback={null}>
        <GltfModel url={url} scale={scale} position={position} />
      </Suspense>
    </ModelErrorBoundary>
  );
}
