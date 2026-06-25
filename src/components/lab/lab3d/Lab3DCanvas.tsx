"use client";

// 3D 实验台画布：R3F Canvas + 灯光 + 轨道控制器，按 slug 选择 3D 场景。
// 复用 labStore 状态与现有交互逻辑（加试剂/混合/清空），让 3D 与 2D 共享同一实验进程。
import { Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { useLabStore } from "../labStore";
import { resolveSubstance } from "../reagents";
import { IronCopperScene } from "./IronCopperScene";

// 场景渲染器：接收派生状态 props（在 Canvas 外计算，规避 R3F 跨 reconciler 订阅失效）
interface SceneProps {
  hasFe: boolean;
  hasLiquid: boolean;
  reacted: boolean;
}
const SCENES: Record<string, (p: SceneProps) => JSX.Element> = {
  "iron-copper-sulfate": IronCopperScene,
};

export default function Lab3DCanvas({
  slug,
  reagents,
}: {
  slug: string;
  reagents: string[];
}) {
  const { contents, result, addReagent, mix, reset } = useLabStore();
  const Scene = SCENES[slug];
  // 在 Canvas 外计算派生状态，传入场景
  const hasFe = contents.some((c) => c.formula === "Fe");
  const hasCuSO4 = contents.some((c) => c.formula === "CuSO4");
  const reacted = Boolean(result?.reacted && hasFe && hasCuSO4);
  const hasLiquid = hasCuSO4 || contents.length > 0;

  return (
    <div className="grid gap-4 md:grid-cols-[180px_1fr]">
      {/* 试剂 + 操作 */}
      <aside className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold text-foreground/70">试剂</h3>
        {reagents.map((label) => {
          const inUse = contents.some(
            (c) => c.formula === resolveSubstance(label).formula,
          );
          return (
            <button
              key={label}
              type="button"
              onClick={() => addReagent(resolveSubstance(label))}
              className={`rounded-xl border px-3 py-2 text-left text-sm transition-all active:scale-[0.98] ${
                inUse
                  ? "border-brand-400/50 bg-brand-500/8"
                  : "border-foreground/15 bg-surface/70 hover:border-brand-400/50"
              }`}
            >
              {label}
              {inUse ? " ✓" : ""}
            </button>
          );
        })}
        <div className="mt-2 flex flex-col gap-2">
          <button
            type="button"
            onClick={mix}
            disabled={contents.length < 2}
            className="rounded-xl bg-gradient-to-r from-brand-500 to-brand-600 px-3 py-2 text-sm font-medium text-white shadow-soft transition-all hover:shadow-glow disabled:opacity-40"
          >
            混合反应
          </button>
          <button
            type="button"
            onClick={reset}
            className="rounded-xl border border-foreground/20 px-3 py-2 text-sm transition-colors hover:border-brand-400/50"
          >
            清空
          </button>
        </div>
        {result?.reacted && (
          <p className="mt-1 rounded-lg bg-emerald-500/10 px-3 py-2 text-xs text-emerald-700 dark:text-emerald-300">
            {result.description}
          </p>
        )}
      </aside>

      {/* 3D 画布 */}
      <div className="h-[440px] overflow-hidden rounded-2xl bg-gradient-to-b from-[#243a4a] to-[#3a5566]">
        <Canvas camera={{ position: [2.4, 1.6, 3.2], fov: 42 }} dpr={[1, 2]}>
          <ambientLight intensity={1.0} />
          <hemisphereLight args={["#ffffff", "#444a55", 0.6]} />
          <directionalLight position={[3, 5, 2]} intensity={1.4} castShadow />
          <directionalLight position={[-3, 2, -2]} intensity={0.6} />
          <Suspense fallback={null}>
            {Scene ? (
              <Scene hasFe={hasFe} hasLiquid={hasLiquid} reacted={reacted} />
            ) : null}
          </Suspense>
          <OrbitControls
            enablePan={false}
            minDistance={2.2}
            maxDistance={6}
            minPolarAngle={Math.PI / 6}
            maxPolarAngle={Math.PI / 1.8}
          />
        </Canvas>
      </div>
    </div>
  );
}
