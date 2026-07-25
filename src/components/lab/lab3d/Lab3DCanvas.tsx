"use client";

// 3D 实验台画布：R3F Canvas + 灯光 + 轨道控制器，按 slug 选择 3D 场景。
// 复用 labStore 状态与现有交互逻辑（加试剂/混合/清空），让 3D 与 2D 共享同一实验进程。
import { SceneShell } from "./SceneShell";
import { useLabStore } from "../labStore";
import { resolveSubstance } from "../reagents";
import { IronCopperScene } from "./IronCopperScene";
import { ZincAcidScene } from "./ZincAcidScene";
import { PrecipitationScene } from "./PrecipitationScene";
import { Co2PreparationScene } from "./Co2PreparationScene";
import { ColorChangeScene } from "./ColorChangeScene";
import { CopperAmmoniaScene } from "./CopperAmmoniaScene";
import { MagnesiumBurningScene } from "./MagnesiumBurningScene";
import { IronCombustionScene } from "./IronCombustionScene";
import { ElectrolysisWaterScene } from "./ElectrolysisWaterScene";
import { CopperZincCellScene } from "./CopperZincCellScene";
import { TitrationLab } from "./TitrationLab";

export default function Lab3DCanvas({
  slug,
  reagents,
}: {
  slug: string;
  reagents: string[];
}) {
  // 酸碱中和滴定有独立的定量交互（旋塞开度/滴数/终点判定），单独成台
  if (slug === "acid-base-titration") return <TitrationLab />;
  return <Lab3DGeneric slug={slug} reagents={reagents} />;
}

function Lab3DGeneric({ slug, reagents }: { slug: string; reagents: string[] }) {
  const { contents, result, energized, addReagent, mix, setEnergized, reset } = useLabStore();
  const has = (f: string) => contents.some((c) => c.formula === f);
  const reactedNow = Boolean(result?.reacted);
  // 电化学实验（电解 / 原电池）：靠"接通电源"而非"混合反应"驱动现象
  const ELECTRO = new Set(["electrolysis-water", "copper-zinc-cell"]);
  const isElectro = ELECTRO.has(slug);

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
      case "feoh3-precipitation":
        return (
          <PrecipitationScene
            hasSalt={has("FeCl3") || contents.length > 0}
            reacted={reactedNow && has("FeCl3") && has("NaOH")}
            saltColor="#e0b34a"
            precipColor="#b04a24"
          />
        );
      case "cuoh2-precipitation":
        return (
          <PrecipitationScene
            hasSalt={has("CuSO4") || contents.length > 0}
            reacted={reactedNow && has("CuSO4") && has("NaOH")}
            saltColor="#5bb6e6"
            precipColor="#2f7fd0"
          />
        );
      case "co2-preparation":
        return (
          <Co2PreparationScene
            hasAcid={has("HCl") || contents.length > 0}
            reacted={reactedNow && has("CaCO3") && has("HCl")}
          />
        );
      case "fe3-scn-coloring":
        return (
          <ColorChangeScene
            hasLiquid={contents.length > 0}
            reacted={reactedNow && has("FeCl3") && has("KSCN")}
            fromColor="#ecc86a"
            toColor="#a11020"
            dropperColor="#e8e0c8"
          />
        );
      case "kmno4-oxalic-acid":
        return (
          <ColorChangeScene
            hasLiquid={has("KMnO4") || contents.length > 0}
            reacted={reactedNow && has("KMnO4") && has("H2C2O4")}
            fromColor="#8b1f8f"
            toColor="#eef1f4"
            dropperColor="#e6e6ea"
          />
        );
      case "copper-ammonia-complex":
        return (
          <CopperAmmoniaScene
            hasCu={has("CuSO4") || contents.length > 0}
            reacted={reactedNow && has("CuSO4") && has("NH3·H2O")}
          />
        );
      case "magnesium-burning":
        // 燃烧不走 react()：镁与氧气都在且已点击混合(result 非空)即点燃
        return (
          <MagnesiumBurningScene
            hasMg={has("Mg")}
            reacted={has("Mg") && has("O2") && result !== null}
          />
        );
      case "o2-iron-combustion":
        // 过氧化氢+二氧化锰产氧，铁丝在氧气中燃烧
        return (
          <IronCombustionScene
            hasFe={has("Fe")}
            reacted={reactedNow && has("Fe") && has("H2O2")}
          />
        );
      case "electrolysis-water":
        return (
          <ElectrolysisWaterScene
            hasLiquid={contents.length > 0}
            energized={energized}
          />
        );
      case "copper-zinc-cell":
        return (
          <CopperZincCellScene
            hasMetals={has("Zn") && has("Cu")}
            energized={energized}
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
          {isElectro ? (
            <button
              type="button"
              onClick={() => setEnergized(!energized)}
              disabled={contents.length < 1}
              className="rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 px-3 py-2 text-sm font-medium text-white shadow-soft transition-all hover:shadow-glow disabled:opacity-40"
            >
              {energized ? "断开电源" : "接通电源"}
            </button>
          ) : (
            <button
              type="button"
              onClick={mix}
              disabled={contents.length < 2}
              className="rounded-xl bg-gradient-to-r from-brand-500 to-brand-600 px-3 py-2 text-sm font-medium text-white shadow-soft transition-all hover:shadow-glow disabled:opacity-40"
            >
              混合反应
            </button>
          )}
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

      {/* 3D 画布（灯光/环境/后处理统一由 SceneShell 提供） */}
      <SceneShell>{renderScene()}</SceneShell>
    </div>
  );
}
