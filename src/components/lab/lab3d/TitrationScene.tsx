"use client";

// 酸碱中和滴定 3D 场景（精细标杆）：铁架台夹持酸式滴定管，下方锥形瓶盛待测氢氧化钠 + 酚酞。
// 交互核心：拖拽旋塞控制滴速 → 液滴逐滴落下 → pH 下降 → 酚酞粉红渐褪 → 终点判定。
// 现象化学依据全部来自 titration/model.ts（已单测），本组件只负责呈现。
import { useState, useRef, useCallback, useMemo, useEffect } from "react";
import { Html } from "@react-three/drei";
import { useThree, type ThreeEvent } from "@react-three/fiber";
import { LabBench } from "./LabPrimitives";
import { Stand } from "./titration/Stand";
import { Burette, BURETTE_TIP_Y } from "./titration/Burette";
import { Flask, flaskLevelY } from "./titration/Flask";
import { Drops, DiffusionRing } from "./titration/Drops";
import { DROP_ML, phAt, phenolphthaleinPink } from "./titration/model";

export interface TitrationProps {
  /** 待测液与指示剂是否已就位（未就位则瓶内为空） */
  ready: boolean;
  /** 已放出的盐酸体积（mL），由父组件持有以便面板显示 */
  deliveredMl: number;
  /** 旋塞开度 0~1 */
  openness: number;
  /** 是否正在摇瓶 */
  swirl: boolean;
  /** 每落下一滴时回调 */
  onDrop: () => void;
  /** 旋塞被拖拽时回调（传入新开度） */
  onOpennessChange: (v: number) => void;
}

// 滴定管基座高度：使尖嘴(BURETTE_TIP_Y=-0.62)落在锥形瓶口(1.28)上方约 0.35，
// 既不插进瓶口造成穿模，也符合"尖嘴伸入瓶口下 1~2 cm"的操作规范留白。
const BURETTE_BASE_Y = 2.25;
const TIP_WORLD_Y = BURETTE_BASE_Y + BURETTE_TIP_Y; // ≈1.63

export function TitrationScene({
  ready,
  deliveredMl,
  openness,
  swirl,
  onDrop,
  onOpennessChange,
}: TitrationProps) {
  // 滴速：开度映射到 0~6 滴/秒，微开时可做到"半滴"精细控制
  const rate = ready ? openness * 6 : 0;
  const ph = phAt(deliveredMl);
  const pink = ready ? phenolphthaleinPink(ph) : 0;

  // 每滴落入时播一次扩散环（用滴数做 key 重挂载）
  const dropCount = useMemo(() => Math.round(deliveredMl / DROP_ML), [deliveredMl]);
  // 瓶内液面高度：随放出体积上升
  const levelY = flaskLevelY(deliveredMl);

  return (
    <group position={[0, -1.6, 0]}>
      <LabBench />
      {/* 夹持点取在滴定管刻度段的下三分与上三分处 */}
      <Stand clampYs={[BURETTE_BASE_Y + 0.9, BURETTE_BASE_Y + 2.6]} />
      {/* 滴定管：夹在铁架台上，尖嘴对准锥形瓶口 */}
      <group position={[0, BURETTE_BASE_Y, 0]}>
        <Burette deliveredMl={deliveredMl} openness={openness} />
        <StopcockHandle openness={openness} onChange={onOpennessChange} ready={ready} />
      </group>
      {/* 液滴：从尖嘴落到瓶内液面（液面随体积上升，落点同步跟随） */}
      {ready && <Drops rate={rate} fromY={TIP_WORLD_Y} landY={levelY} onLand={onDrop} />}
      {/* 锥形瓶：未取待测液前瓶内为空 */}
      <Flask pink={pink} swirl={swirl} levelY={levelY} hasLiquid={ready} />
      {/* 滴入点局部扩散（未摇匀时的视觉线索） */}
      {ready && pink > 0.02 && dropCount > 0 && (
        <DiffusionRing key={dropCount} y={levelY} maxR={0.3} />
      )}
      {/* 白瓷板：衬在瓶下便于观察浅粉色（真实操作要点）。
          色值压到 0.82 灰阶并提高粗糙度，避免纯白在 Bloom 下过曝成一片。 */}
      <mesh position={[0, 0.012, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[1.5, 1.2]} />
        <meshStandardMaterial color="#d2d0c8" roughness={0.95} metalness={0} />
      </mesh>
    </group>
  );
}

/**
 * 旋塞的可拖拽热区：透明球体覆盖手柄，横向拖拽改变开度。
 * 用 Html 叠一个提示标签，让"这里可以拖"一眼可见。
 */
function StopcockHandle({
  openness,
  onChange,
  ready,
}: {
  openness: number;
  onChange: (v: number) => void;
  /** 待测液是否已就位；未就位时开旋塞无意义，需明确告知而非静默无反应 */
  ready: boolean;
}) {
  const dragging = useRef(false);
  const startX = useRef(0);
  const startVal = useRef(0);
  const [hover, setHover] = useState(false);

  // 拖拽期间必须禁用 OrbitControls：否则相机跟着转，旋塞从指针下移开，拖拽中断
  const controls = useThree((s) => s.controls) as { enabled: boolean } | null;
  const gl = useThree((s) => s.gl);

  // 按下时抓取指针：否则鼠标一移出旋塞球体，onPointerMove 就断了，拖不动
  const onDown = useCallback(
    (e: ThreeEvent<PointerEvent>) => {
      e.stopPropagation();
      dragging.current = true;
      startX.current = e.clientX;
      startVal.current = openness;
      if (controls) controls.enabled = false;
      (e.target as Element | null)?.setPointerCapture?.(e.pointerId);
    },
    [openness, controls],
  );

  const onMove = useCallback(
    (e: ThreeEvent<PointerEvent>) => {
      if (!dragging.current) return;
      e.stopPropagation();
      // 未取待测液时旋塞开了也不该出液（标签已提示"先取待测液"），锁住避免假状态
      if (!ready) return;
      const dx = e.clientX - startX.current;
      // 拖 200px 对应全开，便于精细控制半滴
      onChange(Math.min(1, Math.max(0, startVal.current + dx / 200)));
    },
    [onChange, ready],
  );

  const onUp = useCallback(
    (e: ThreeEvent<PointerEvent>) => {
      dragging.current = false;
      if (controls) controls.enabled = true;
      (e.target as Element | null)?.releasePointerCapture?.(e.pointerId);
    },
    [controls],
  );

  // 悬停时把光标改成左右拖动样式：3D 里没有这个反馈，用户不知道此处可拖
  useEffect(() => {
    if (!hover && !dragging.current) return;
    const el = gl.domElement;
    const prev = el.style.cursor;
    el.style.cursor = "ew-resize";
    return () => {
      el.style.cursor = prev;
    };
  }, [hover, gl]);

  return (
    <group position={[0, -0.24, 0.24]} scale={[1.15, 0.85, 1]}>
      <mesh
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerOver={() => setHover(true)}
        onPointerLeave={() => setHover(false)}
      >
        {/* 热区半径 0.24 时屏幕上只有约 40px，太难瞄；放大到 0.42（约 70px）
            并做成横向扁球，契合"左右拖动"的操作方向 */}
        <sphereGeometry args={[0.42, 20, 14]} />
        <meshBasicMaterial transparent opacity={hover ? 0.16 : 0.05} color="#38bdf8" />
      </mesh>
      {/* 提示标签必须整体穿透指针：drei Html 的外层包裹 div 默认 pointer-events:auto，
          会盖在旋塞热区上方把 pointerdown 吃掉，导致旋塞根本拖不动。
          仅给内层文字加 pointer-events-none 不够，须用 style 关掉外层容器。 */}
      <Html
        center
        distanceFactor={7}
        position={[0.62, 0.34, 0]}
        style={{ pointerEvents: "none" }}
        zIndexRange={[10, 0]}
      >
        <div className="pointer-events-none select-none whitespace-nowrap rounded-full bg-black/55 px-2 py-0.5 text-[11px] text-white backdrop-blur">
          {!ready
            ? "先取待测液 →"
            : hover || openness > 0.001
              ? `开度 ${Math.round(openness * 100)}% · 按住左右拖动`
              : "← 拖动旋塞开始滴定"}
        </div>
      </Html>
    </group>
  );
}
