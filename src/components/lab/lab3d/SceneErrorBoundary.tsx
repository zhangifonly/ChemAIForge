"use client";

// 3D 画布的错误边界：浏览器建不起 WebGL（关了硬件加速、老旧显卡、部分远程桌面与
// 无头浏览器）时，R3F 会把 "Error creating WebGL context" 抛到 React 树上。
// 没有边界时这个错误一路冒到根，整页变成 Next 的 "Application error"，
// 连画布外面的参数面板、读数、称量都一起没了 —— 而它们本来不依赖 WebGL。
// 这里只把画布这一块替换成说明，其余界面照常可用。
import { Component, type ReactNode } from "react";

interface Props {
  fallback: ReactNode;
  children: ReactNode;
}

export class SceneErrorBoundary extends Component<Props, { failed: boolean }> {
  constructor(props: Props) {
    super(props);
    this.state = { failed: false };
  }

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    // 保留一条控制台记录，便于用户反馈时定位是 WebGL 还是场景代码本身的错
    console.error("[SceneShell] 3D 场景渲染失败", error);
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}
