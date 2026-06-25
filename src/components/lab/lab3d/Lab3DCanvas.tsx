"use client";

// 3D 实验台画布：R3F Canvas + 灯光 + 轨道控制器，按 slug 选择 3D 场景。
// 复用 labStore 状态与现有交互逻辑（加试剂/混合/清空），让 3D 与 2D 共享同一实验进程。
import { Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Environment, Lightformer, ContactShadows } from "@react-three/drei";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
import { useLabStore } from "../labStore";
import { resolveSubstance } from "../reagents";
import { IronCopperScene } from "./IronCopperScene";
import { ZincAcidScene } from "./ZincAcidScene";

export default function Lab3DCanvas({
  slug,
  reagents,
}: {
  slug: string;
  reagents: string[];
}) {
  const { contents, result, addReagent, mix, reset } = useLabStore();
  const has = (f: string) => contents.some((c) => c.formula === f);
  const reactedNow = Boolean(result?.reacted);

  // 各实验在 Canvas 外计算派生状态后构造场景（规避 R3F 跨 reconciler 订阅失效）
  function renderScene() {
    switch (slug) {
      case "iron-copper-sulfate":
        return (
          <IronCopperScene
            hasFe={has("Fe")}
            hasLiquid={has("CuSO4") || contents.length > 0}
            reacted={reactedNow && has("Fe") && has("CuSO4")}
          />
        );
      case "h2-from-zinc":
        return (
          <ZincAcidScene
            hasMetal={has("Zn")}
            hasLiquid={has("H2SO4") || contents.length > 0}
            reacted={reactedNow && has("Zn") && has("H2SO4")}
          />
        );
      default:
        return null;
    }
  }

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
      <div className="relative h-[520px] overflow-hidden rounded-2xl bg-gradient-to-b from-[#dfe7ee] to-[#c2cdd6]">
        <Canvas
          shadows
          camera={{ position: [2.8, 2.0, 4.4], fov: 40 }}
          dpr={[1, 2]}
          gl={{ antialias: true, alpha: false }}
        >
          <color attach="background" args={["#d3dce4"]} />
          <ambientLight intensity={0.85} />
          <directionalLight
            position={[4, 7, 4]}
            intensity={2}
            castShadow
            shadow-mapSize={[2048, 2048]}
            shadow-camera-near={0.5}
            shadow-camera-far={20}
          />
          <Suspense fallback={null}>
            {renderScene()}
            {/* 程序化环境光：自发光面光源构成反射环境，无需外网 HDR */}
            <Environment resolution={256}>
              <Lightformer intensity={2} position={[0, 3, 2]} scale={[4, 4, 1]} color="#ffffff" />
              <Lightformer intensity={1.2} position={[-3, 1, 1]} scale={[3, 3, 1]} color="#bcd8ff" />
              <Lightformer intensity={1} position={[3, 1, -1]} scale={[3, 3, 1]} color="#ffe6c4" />
            </Environment>
            <ContactShadows position={[0, -0.94, 0]} opacity={0.35} scale={10} blur={2.6} far={4} />
            <EffectComposer>
              <Bloom luminanceThreshold={0.8} intensity={0.35} mipmapBlur radius={0.5} />
            </EffectComposer>
          </Suspense>
          <OrbitControls
            enablePan={false}
            autoRotate
            autoRotateSpeed={0.5}
            target={[0, 0.2, 0]}
            minDistance={3.5}
            maxDistance={9}
            minPolarAngle={Math.PI / 6}
            maxPolarAngle={Math.PI / 2.2}
          />
        </Canvas>
        <span className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-black/30 px-3 py-1 text-xs text-white/70 backdrop-blur">
          拖拽旋转 · 滚轮缩放
        </span>
      </div>
    </div>
  );
}
