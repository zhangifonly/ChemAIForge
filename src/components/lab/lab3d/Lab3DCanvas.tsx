"use client";

// 3D 实验台画布：R3F Canvas + 灯光 + 轨道控制器，按 slug 选择 3D 场景。
// 复用 labStore 状态与现有交互逻辑（加试剂/混合/清空），让 3D 与 2D 共享同一实验进程。
import { Link } from "@/lib/i18n/navigation";
import { useTranslations } from "next-intl";
import { SceneShell } from "./SceneShell";
import { useLabStore } from "../labStore";
import { resolveSubstance } from "../reagents";
import { ReagentShelf } from "../ReagentShelf";
import { shelfEntries } from "../shelfEntries";
import { InstrumentDeck, ReadingHud } from "../InstrumentDeck";
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
import { ElectrolysisLab } from "./electrolysis/ElectrolysisLab";
import { GenericScene, VESSEL_VIEW } from "./GenericScene";
import { planScene } from "@/lib/chem/scenePlan";
import { HEAT_THRESHOLD } from "@/lib/chem/engine";
import { has3D } from "./registry";
import { BenchLabelsContext, BenchTermsContext } from "./LabRoom";
import { usePhrase, useTerms } from "@/lib/i18n/PhenomenaProvider";

// 加热阈值直接用引擎的 HEAT_THRESHOLD：3D 上"火焰亮起"与化学上"反应发生"
// 必须是同一个门槛，各写一份迟早会漂移成"看着在烧但不反应"。

/** 自带热源的装置：启动开关即等于加热，故隐藏独立的酒精灯按钮 */
const HEATING_RIGS = new Set(["water-bath", "flame-test", "evaporation", "distillation"]);

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
  if (slug === "acid-base-titration") return <TitrationLab reagents={reagents} />;
  // 电解硫酸铜：定量电解台（电流 / 时间 / 阳极材料可调，法拉第定律实时计算），
  // 同一套装置换铜阳极即电解精炼，故两个实验共用
  if (slug === "copper-electrolysis" || slug === "copper-refining-electrolysis") {
    return <ElectrolysisLab initialAnode={slug === "copper-refining-electrolysis" ? "copper" : "graphite"} />;
  }
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
  const t = useTranslations("lab");
  const tRig = useTranslations("rig");
  const phrase = usePhrase();
  const terms = useTerms();
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
    complete,
    completed,
    sessionId,
  } = useLabStore();
  const has = (f: string) => contents.some((c) => c.formula === f);
  const reactedNow = Boolean(result?.reacted);
  // 电化学实验（电解 / 原电池）：靠"接通电源"而非"混合反应"驱动现象
  const ELECTRO = new Set(["electrolysis-water", "copper-zinc-cell"]);
  const isElectro = ELECTRO.has(slug);
  const heating = readings.temperature >= HEAT_THRESHOLD;
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
  // 各装置的开关文案：让按钮说清"这一下会发生什么"。
  // rig kind 是连字符命名（water-bath），词条键用驼峰（waterBath），此处做映射；
  // 未登记的装置退回"接通电源"这对通用文案。
  const RIG_KEY: Record<string, string> = {
    electrolysis: "electrolysis",
    cell: "cell",
    "flame-test": "flameTest",
    "water-bath": "waterBath",
    distillation: "distillation",
    filtration: "filtration",
    calorimeter: "calorimeter",
    "gas-collect": "gasCollect",
    titration: "titration",
    syringe: "syringe",
    "ph-meter": "phMeter",
    evaporation: "evaporation",
    "pressure-drop": "pressureDrop",
  };
  const rigKey = RIG_KEY[rigKind] ?? "electrolysis";
  const onLabel = tRig(`${rigKey}.on`);
  const offLabel = tRig(`${rigKey}.off`);

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
        // 镁在氧气中燃烧需点燃：引擎已把这条规则标为 requiresHeat，
        // 原先用 result !== null 兜底会让镁在常温下自己烧起来 —— 直接采信引擎判定
        return (
          <MagnesiumBurningScene hasMg={has("Mg")} reacted={reactedNow && has("Mg") && has("O2")} />
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
    <div className="grid gap-6 lg:grid-cols-[248px_minmax(0,1fr)]">
      {/* 试剂架 + 装置操作。试剂架与 2D 共用：原先这里是一排纯文字按钮，
          点一下按默认量整瓶倒入，切到 3D 就没了取用量与瓶签规格 */}
      <aside className="flex min-w-0 flex-col gap-2">
        <ReagentShelf
          entries={shelfEntries(reagents, terms)}
          contents={contents}
          onTake={(e, dose) => addReagent(resolveSubstance(e.label), dose)}
        />
        {/* 手机上两列网格：竖排 5 个整宽按钮会再把 3D 画布往下推 300px；
            宽屏侧栏只有 248px，仍单列 */}
        <div className="mt-2 grid grid-cols-2 gap-2 lg:flex lg:flex-col">
          {/* 装置开关：电解 / 原电池 / 焰色 / 水浴 / 蒸馏 / 过滤 都靠"启动装置"驱动现象 */}
          {needsSwitch && (
            <button
              type="button"
              onClick={() => {
                const on = !energized;
                setEnergized(on);
                // 带热源的装置（水浴 / 焰色 / 蒸发）启动时同步把体系温度带到加热档：
                // 这几种 rig 会隐藏「点燃酒精灯」按钮，若开关只改 3D 不改温度，
                // 银镜、酯的水解等 11 个水浴实验在界面上就没有任何办法让反应发生。
                if (HEATING_RIGS.has(rigKind)) setTemperature(on ? HEAT_THRESHOLD + 20 : 25);
              }}
              disabled={contents.length < 1}
              className="col-span-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 px-3 py-2.5 text-sm font-medium text-white shadow-soft transition-all hover:shadow-glow disabled:opacity-40 lg:py-2"
            >
              {energized ? offLabel : onLabel}
            </button>
          )}
          {!isElectro && (
            <button
              type="button"
              onClick={mix}
              disabled={contents.length < 2}
              className="col-span-2 rounded-xl bg-gradient-to-r from-brand-500 to-brand-600 px-3 py-2.5 text-sm font-medium text-white shadow-soft transition-all hover:shadow-glow disabled:opacity-40 lg:py-2"
            >
              {t("mix")}
            </button>
          )}
          {/* 加热：通用场景在器皿下点燃酒精灯。自带热源的装置由上面的装置开关
              一并管温度，这里就不再出第二个加热入口，免得两个按钮互相打架 */}
          {/* 量热计装置不给加热入口：中和热、溶解热测定要求绝热，外部加热会
              直接破坏测量原理（2D 那边同理不画酒精灯，见 vesselGeom.hasHeatSource）。
              这里不能改用 hasHeatSource 一刀切 —— 制氯气、点燃氢气等 5 个实验
              需要加热 / 点燃，但仪器清单没写热源，隐藏后它们在 3D 里就无法反应。 */}
          {!isElectro && !HEATING_RIGS.has(rigKind) && rigKind !== "calorimeter" && (
            <button
              type="button"
              onClick={() => setTemperature(heating ? 25 : HEAT_THRESHOLD + 20)}
              disabled={contents.length < 1}
              className={`rounded-xl border px-3 py-2 text-sm transition-all disabled:cursor-not-allowed disabled:opacity-40 ${
                heating
                  ? "border-amber-500/60 bg-amber-500/12 text-amber-700 dark:text-amber-300"
                  : "border-foreground/20 hover:border-amber-400/60"
              }`}
            >
              {heating ? `🔥 ${tRig("heat.off")}` : tRig("heat.on")}
            </button>
          )}
          <button
            type="button"
            onClick={reset}
            className="rounded-xl border border-foreground/20 px-3 py-2 text-sm transition-colors hover:border-brand-400/50"
          >
            {t("clear")}
          </button>
          {/* 完成实验 + 报告出口：原先只有 2D 画布有，在 3D 下做完实验没法结束会话，
              会话状态永远停在"进行中"，AI 报告也无从生成。
              电化学实验靠通电产生现象、result 为空，故其判据用 energized。 */}
          <button
            type="button"
            onClick={complete}
            disabled={completed || !(isElectro ? energized : result)}
            className="rounded-xl border border-emerald-500/40 px-3 py-2 text-sm text-emerald-700 transition-colors hover:bg-emerald-500/10 disabled:cursor-not-allowed disabled:opacity-40 dark:text-emerald-300"
          >
            {completed ? t("completed") : t("complete")}
          </button>
          {completed && sessionId ? (
            <Link
              href={`/sessions/${sessionId}/report`}
              className="col-span-2 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 px-3 py-2.5 text-center text-sm font-medium text-white shadow-soft transition-all hover:shadow-glow lg:py-2"
            >
              {t("viewReport")}
            </Link>
          ) : null}
        </div>
        {result?.reacted && (
          <p className="mt-1 rounded-lg bg-emerald-500/10 px-3 py-2 text-xs text-emerald-700 dark:text-emerald-300">
            {phrase(result.description)}
          </p>
        )}
      </aside>

      <section className="flex min-w-0 flex-col gap-4">
        {/* 3D 画布（灯光/环境/后处理统一由 SceneShell 提供） */}
        {/* 通用场景按器皿造型取景（试管细高需拉远抬高），专用场景沿用各自默认 */}
        <div className="relative">
          <SceneShell {...(refined ? {} : VESSEL_VIEW[plan.vessel])} autoRotate={false}>
            {/* Provider 必须放在 Canvas 内部：Context 不跨 React 与 R3F 两个 reconciler */}
            <BenchLabelsContext.Provider value={reagents}>
              <BenchTermsContext.Provider value={terms}>
              {renderScene()}
            </BenchTermsContext.Provider>
            </BenchLabelsContext.Provider>
          </SceneShell>
          {/* 仪表叠在场景一角，与 2D 台面同一套读数 */}
          <ReadingHud className="absolute start-4 top-4 z-10" />
        </div>
        {/* 读数、曲线与数据表与 2D 共用同一份实验过程：切视图不丢记录 */}
        <InstrumentDeck apparatus={apparatus} />
      </section>
    </div>
  );
}
