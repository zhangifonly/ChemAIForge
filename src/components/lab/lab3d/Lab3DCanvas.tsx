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
import { GenericScene, VESSEL_VIEW } from "./GenericScene";
import { planScene } from "@/lib/chem/scenePlan";
import { has3D } from "./registry";

/** 视为"正在加热"的温度阈值（酒精灯点燃） */
const HEAT_ON_TEMP = 60;

export default function Lab3DCanvas({
  slug,
  reagents,
  apparatus = [],
}: {
  slug: string;
  reagents: string[];
  apparatus?: string[];
}) {
  // 酸碱中和滴定有独立的定量交互（旋塞开度/滴数/终点判定），单独成台
  if (slug === "acid-base-titration") return <TitrationLab />;
  return <Lab3DGeneric slug={slug} reagents={reagents} apparatus={apparatus} />;
}

function Lab3DGeneric({
  slug,
  reagents,
  apparatus,
}: {
  slug: string;
  reagents: string[];
  apparatus: string[];
}) {
  const {
    contents,
    result,
    energized,
    readings,
    addReagent,
    mix,
    setEnergized,
    setTemperature,
    reset,
  } = useLabStore();
  const has = (f: string) => contents.some((c) => c.formula === f);
  const reactedNow = Boolean(result?.reacted);
  // 电化学实验（电解 / 原电池）：靠"接通电源"而非"混合反应"驱动现象
  const ELECTRO = new Set(["electrolysis-water", "copper-zinc-cell"]);
  const isElectro = ELECTRO.has(slug);
  const heating = readings.temperature >= HEAT_ON_TEMP;
  // 有专用手写场景的实验沿用其自带取景；其余走通用场景，按器皿造型取景
  const refined = has3D(slug);
  const plan = planScene({
    contents,
    result,
    apparatus,
    heated: heating,
    // 装置类实验（电解 / 蒸馏 / 过滤 / 焰色）复用 energized 当作"装置启动"开关
    rigActive: energized,
    temperature: readings.temperature,
  });
  // 需要电源 / 电压表开关的装置：手写电化学场景 + 通用场景里的电解与原电池
  const rigKind = plan.rig.kind;
  const needsSwitch = isElectro || rigKind !== "none";
  // 各装置的开关文案：让按钮说清"这一下会发生什么"
  const SWITCH_LABEL: Record<string, [string, string]> = {
    electrolysis: ["接通电源", "断开电源"],
    cell: ["接通电路", "断开电路"],
    "flame-test": ["点燃酒精灯", "熄灭酒精灯"],
    "water-bath": ["开始水浴加热", "停止水浴加热"],
    distillation: ["开始蒸馏", "停止蒸馏"],
    filtration: ["开始过滤", "停止过滤"],
    calorimeter: ["开始搅拌测温", "停止搅拌"],
    "gas-collect": ["开始收集气体", "停止收集"],
    titration: ["打开旋塞滴加", "关闭旋塞"],
    syringe: ["压缩活塞加压", "拉回活塞减压"],
    "ph-meter": ["打开 pH 计", "关闭 pH 计"],
    evaporation: ["点燃酒精灯蒸发", "熄灭酒精灯"],
    "pressure-drop": ["拧紧瓶盖振荡", "松开瓶盖"],
  };
  const [onLabel, offLabel] = SWITCH_LABEL[rigKind] ?? ["接通电源", "断开电源"];

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
        // 未手写专用场景的实验走数据驱动通用场景：按引擎结果自动组装
        // 器皿 / 液色 / 气泡 / 沉淀 / 火焰 / 加热，使 3D 覆盖全部实验。
        return <GenericScene plan={plan} />;
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
          {/* 装置开关：电解 / 原电池 / 焰色 / 水浴 / 蒸馏 / 过滤 都靠"启动装置"驱动现象 */}
          {needsSwitch && (
            <button
              type="button"
              onClick={() => setEnergized(!energized)}
              disabled={contents.length < 1}
              className="rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 px-3 py-2 text-sm font-medium text-white shadow-soft transition-all hover:shadow-glow disabled:opacity-40"
            >
              {energized ? offLabel : onLabel}
            </button>
          )}
          {!isElectro && (
            <button
              type="button"
              onClick={mix}
              disabled={contents.length < 2}
              className="rounded-xl bg-gradient-to-r from-brand-500 to-brand-600 px-3 py-2 text-sm font-medium text-white shadow-soft transition-all hover:shadow-glow disabled:opacity-40"
            >
              混合反应
            </button>
          )}
          {/* 加热：通用场景在器皿下点燃酒精灯；水浴装置自带热源，无需这个按钮 */}
          {!isElectro && rigKind !== "water-bath" && rigKind !== "flame-test" && (
            <button
              type="button"
              onClick={() => setTemperature(heating ? 25 : 80)}
              disabled={contents.length < 1}
              className={`rounded-xl border px-3 py-2 text-sm transition-all disabled:cursor-not-allowed disabled:opacity-40 ${
                heating
                  ? "border-amber-500/60 bg-amber-500/12 text-amber-700 dark:text-amber-300"
                  : "border-foreground/20 hover:border-amber-400/60"
              }`}
            >
              {heating ? "🔥 停止加热" : "点燃酒精灯加热"}
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
      {/* 通用场景按器皿造型取景（试管细高需拉远抬高），专用场景沿用各自默认 */}
      <SceneShell {...(refined ? {} : VESSEL_VIEW[plan.vessel])} autoRotate={false}>
        {renderScene()}
      </SceneShell>
    </div>
  );
}
