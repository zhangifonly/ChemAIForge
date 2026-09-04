"use client";

// 金属固体：按化学式呈现真实金属外观与常见形态（片 / 粒 / 丝 / 条）。
// 通用场景据此把"投入的金属"立体地摆在器皿底，而不是只画一块灰方块。
// 用 solidLook 而非 metalLook：氧化物 / 碳酸盐等非金属固体也走这个组件，
// 它们的颜色（黑色 CuO、红棕 Fe2O3）才是辨识特征，兜底成灰颗粒会认不出物质
import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { MathUtils, type Group } from "three";
import { METAL_LOOK, solidLook } from "./metalLook";

export function MetalSolid({
  formula,
  y = 0.1,
  dissolving = false,
}: {
  formula: string;
  y?: number;
  /** 固体正被反应消耗：逐渐缩小并淡出，演出「沉淀溶解至澄清」 */
  dissolving?: boolean;
}) {
  const look = solidLook(formula);
  const mat = (
    <meshStandardMaterial
      color={look.color}
      roughness={look.roughness}
      metalness={look.metalness}
      transparent
    />
  );

  const body =
    look.shape === "strip" ? (
      // 条状（镁条 / 锌条）：斜靠在器皿内
      <mesh position={[0, y + 0.16, 0]} rotation={[0, 0.4, 0.32]} castShadow>
        <boxGeometry args={[0.05, 0.62, 0.012]} />
        {mat}
      </mesh>
    ) : look.shape === "wire" ? (
      // 丝状（铁丝）：螺旋状盘绕
      <mesh position={[0, y + 0.1, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <torusGeometry args={[0.1, 0.011, 10, 40]} />
        {mat}
      </mesh>
    ) : look.shape === "sheet" ? (
      // 片状（铜片 / 锌片）：竖插入液
      <mesh position={[0, y + 0.28, 0]} rotation={[0, 0.25, 0]} castShadow>
        <boxGeometry args={[0.17, 0.68, 0.014]} />
        {mat}
      </mesh>
    ) : (
      // 粒状（锌粒 / 铁屑）：底部散落几颗
      <group position={[0, y, 0]}>
        {GRAIN_POS.map(([x, z, s], i) => (
          <mesh key={i} position={[x, s * 0.5, z]} castShadow>
            <dodecahedronGeometry args={[s, 0]} />
            {mat}
          </mesh>
        ))}
      </group>
    );

  return <Dissolve active={dissolving}>{body}</Dissolve>;
}

/**
 * 溶解动画：固体逐渐缩小并透明化，最终消失。
 *
 * 缩放与透明度同时收：只缩小会留下一个"迷你固体"停在杯底，只淡出则形状不变，
 * 都不像溶解。缩到 0.06 后隐藏整个 group，免得留一层看不见但仍参与深度排序的面。
 */
function Dissolve({ active, children }: { active: boolean; children: React.ReactNode }) {
  const ref = useRef<Group>(null);
  useFrame((_, dt) => {
    const g = ref.current;
    if (!g) return;
    const target = active ? 0 : 1;
    // dt * 0.5 → 约 2 秒完成，与其它场景的渐变速率一致，看得清过程又不拖沓
    const k = Math.min(1, dt * 0.5);
    const s = MathUtils.lerp(g.scale.x, target, k);
    g.scale.setScalar(s);
    g.visible = s > 0.06;
    g.traverse((o) => {
      const m = (o as { material?: { opacity: number; transparent: boolean } }).material;
      if (m && m.transparent) m.opacity = Math.min(1, s * 1.4);
    });
  });
  return <group ref={ref}>{children}</group>;
}

/** 固定的颗粒散落位置：避免每帧随机导致颗粒抖动 */
const GRAIN_POS: [number, number, number][] = [
  [0.0, 0.02, 0.055],
  [0.075, -0.05, 0.042],
  [-0.07, 0.045, 0.048],
  [0.04, 0.09, 0.036],
  [-0.05, -0.08, 0.04],
];

export { METAL_LOOK };
