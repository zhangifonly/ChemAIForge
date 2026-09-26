// 讲解生成器：从实验数据（描述 / 试剂 / 探针 / 目标）自动派生分步讲解，
// 无需为五百多个实验逐个编写脚本。纯函数，便于测试。
import type { ExperimentSeed } from "@/data/experiments";
import type { ReactionExpectation } from "@/data/experiments/types";
import type { LessonStep } from "./types";
import { resolveSubstance } from "../reagents";
import {
  isElectrolysisSetup,
  isGalvanicSetup,
  isInertAnode,
  usesConductivity,
} from "../vesselGeom";
import { electrolyze, isElectrolyte } from "@/lib/chem/electrolysis";
import { galvanicCell, isGalvanicMetal } from "@/lib/chem/galvanic";
import { conductivity } from "@/lib/chem/conductivity";
import { react } from "@/lib/chem/engine";
import { chooseVessel, planRig } from "@/lib/chem/scenePlan";

/**
 * 讲解文案的取词函数。
 *
 * buildLesson 保持纯函数、由调用方注入取词函数，而不是自己去读词条：
 * 它有三个调用方 —— 服务端的详情页、客户端的播放器、Node 里的 TTS 生成脚本，
 * 三者取词条的方式各不相同（getTranslations / useTranslations / 直接读 JSON）。
 * 让它只依赖一个 (key, vars) => string，三方都能满足，也仍然可测。
 */
export type LessonT = (key: string, vars?: Record<string, string | number>) => string;

/**
 * 该实验的本地化内容与术语译名。
 *
 * 口播里有三处直接取自实验数据，词条翻译覆盖不到它们：
 *   - description 与 objectives —— 译文在 content/<locale>.json；
 *   - reagents 的中文名 —— 它是引擎匹配键不能改，展示时换成术语表里的译名。
 * 不传则一律用中文原文，与改造前行为一致。
 */
export interface LessonContent {
  description?: string;
  objectives?: string[];
  /** 中文试剂名 → 该语种译名 */
  terms?: Record<string, string>;
  /**
   * 引擎现象文本 → 该语种译文（电解两极观察、原电池电子流向、导电性说明）。
   * 这些句子由引擎运行时产出，词条覆盖不到；不传则按中文原样拼进口播。
   */
  phrases?: Record<string, string>;
}

/** 按 content.phrases 翻译一句引擎输出，查不到原样返回 */
function ph(content: LessonContent, text: string): string {
  return content.phrases?.[text] ?? text;
}

/** 3D 选型给出的器皿种类（与 scenePlan.chooseVessel 的取值一致） */
type VesselKind = "beaker" | "tube" | "flask";

/**
 * 讲解里提到的容器必须与 3D 里真正画出来的那个一致。
 *
 * 原先三处口播把容器名写死（"加入烧杯中"/"给试管加热"/"将烧杯中的试剂充分混合"），
 * 而 3D 按 chooseVessel 选型 —— 501 个实验里 313 个说着烧杯、画的却是试管或锥形瓶，
 * 其中 54 个更在同一段讲解里先说烧杯、再说试管、又说烧杯，自相矛盾。
 * 这里复用 3D 完全相同的推导（planRig + chooseVessel），两边不可能再对不上。
 */
function vesselKind(exp: ExperimentSeed): VesselKind {
  const apparatus = exp.apparatus ?? [];
  const kind = chooseVessel(apparatus, planRig(apparatus).kind);
  return kind === "tube" || kind === "flask" ? kind : "beaker";
}

/**
 * 取「带器皿的整句」而不是拿器皿名去填占位符。
 *
 * 句子与器皿名分开翻译再拼接，在有格变化或后置词的语言里会出错：亚美尼亚语拼成
 * 「Բաժակ-ի」（大写名词 + 连字符硬接格尾），德语缺冠词，英语是 "add it to Erlenmeyer Flask"。
 * 器皿只有 3 种、涉及的句子只有 3 句，故每种组合都整句翻译（词条键 narrTake_flask 等，
 * 由 scripts/i18n-inline-vessel.mjs 生成），让译者一次处理好变格与冠词。
 */
function vesselSentence(
  t: LessonT,
  sentence: "narrTake" | "narrHeat" | "narrMix",
  kind: VesselKind,
  vars?: Record<string, string>,
): string {
  return t(`${sentence}_${kind}`, vars);
}

/**
 * 由引擎实际结果得出现象，而不是照搬测试探针的声明。
 *
 * probe.expect 是给回归测试用的断言，只声明关键字段即可 —— 实测 472 个带
 * 探针的实验里有 87 个漏声明了放热 / 变色 / 产气。拿它生成口播，学生就会
 * 听着"可以看到有气泡逸出"、而 3D 里同时还在升温变色，或者反过来
 * 明明在冒泡却只字未提。讲解要描述的是真实会发生什么。
 */
function actualPhenomena(exp: ExperimentSeed, reagents: string[]): ReactionExpectation {
  const r = react(
    reagents.map(resolveSubstance),
    exp.probe?.heated ? { heated: true } : {},
  );
  return {
    reacted: r.reacted,
    gas: r.producesGas,
    precipitate: r.producesPrecipitate,
    colorChange: r.colorChange,
    thermal: r.thermal,
  };
}

// 把现象四元组铺成一句口播。
// 分隔符走词条而非写死"，"：各语言的列举标点不同（英语用逗号加 and、
// 日语用读点），把中文顿号硬编码进来，译文读起来就是中文腔的外语。
function describePhenomena(e: ReactionExpectation | undefined, t: LessonT): string {
  if (!e || !e.reacted) return t("observeGeneric");
  const parts: string[] = [];
  if (e.gas) parts.push(t("partGas"));
  if (e.precipitate) parts.push(t("partPrecipitate"));
  if (e.colorChange) parts.push(t("partColor"));
  if (e.thermal === "exothermic") parts.push(t("partExo"));
  else if (e.thermal === "endothermic") parts.push(t("partEndo"));
  if (parts.length === 0) return t("observeReacting");
  return t("phenomenaList", { parts: parts.join(t("joinComma")) });
}

// 选定参与演示的试剂：优先用探针试剂（保证能反应），否则取前若干种
function pickReagents(exp: ExperimentSeed): string[] {
  if (exp.probe?.reagentKeys?.length) return exp.probe.reagentKeys;
  return exp.reagents.slice(0, Math.min(3, exp.reagents.length));
}

// 结论步骤（实验目标），电化学与混合讲解共用
function summaryStep(exp: ExperimentSeed, t: LessonT, content: LessonContent): LessonStep | null {
  if (!exp.objectives.length) return null;
  return {
    id: "summary",
    phase: "conclude",
    title: t("titleSummary"),
    narration: t("summary", {
      objectives: (content.objectives ?? exp.objectives).join(t("joinSemicolon")),
    }),
  };
}

// 电解实验讲解：依放电顺序描述两极现象
function electrolysisLesson(exp: ExperimentSeed, t: LessonT, content: LessonContent): LessonStep[] | null {
  if (!isElectrolysisSetup(exp.apparatus)) return null;
  const electrolyte = exp.reagents
    .map((r) => resolveSubstance(r).formula)
    .find(isElectrolyte);
  if (!electrolyte) return null;
  const er = electrolyze(electrolyte, { inertAnode: isInertAnode(exp.apparatus) });
  if (!er) return null;
  const steps: LessonStep[] = [
    { id: "intro", phase: "theory", title: t("titlePrinciple"), narration: content.description ?? exp.description, action: { kind: "reset" } },
    { id: "setup", phase: "prep", title: t("titleConnect"), narration: t("narrSetupElectrode") },
    { id: "power", phase: "operate", title: t("titlePowerOn"), narration: t("narrPowerOn"), action: { kind: "energize" } },
    {
      id: "observe",
      phase: "observe",
      title: t("titleElectrodes"),
      narration: `${ph(content, er.cathode.observation)}${t("joinSemicolon")}${ph(content, er.anode.observation)}${er.colorFades ? t("electrodesFading") : ""}${t("sentenceEnd")}`,
    },
  ];
  const s = summaryStep(exp, t, content);
  if (s) steps.push(s);
  return steps;
}

// 原电池 / 腐蚀讲解：依金属活动性描述正负极
function galvanicLesson(exp: ExperimentSeed, t: LessonT, content: LessonContent): LessonStep[] | null {
  if (!isGalvanicSetup(exp.apparatus)) return null;
  const metals = exp.reagents
    .map((r) => resolveSubstance(r))
    .filter((s) => isGalvanicMetal(s.formula));
  if (metals.length === 0) return null;
  const acid = exp.reagents.map((r) => resolveSubstance(r)).find((s) => s.category === "acid");
  const electrolyte = acid ?? { formula: "NaCl", name: t("brine") };
  const gr = galvanicCell(metals.map((m) => m.formula), electrolyte);
  if (!gr) return null;
  const steps: LessonStep[] = [
    { id: "intro", phase: "theory", title: t("titlePrinciple"), narration: content.description ?? exp.description, action: { kind: "reset" } },
    { id: "setup", phase: "prep", title: t("titleConnectCircuit"), narration: t("narrSetupCircuit") },
    { id: "connect", phase: "operate", title: t("titleConnectOn"), narration: t("narrConnectOn"), action: { kind: "energize" } },
    {
      id: "observe",
      phase: "observe",
      title: t("titleElectrodes"),
      narration:
        [gr.negative.observation, gr.positive.observation, gr.electronFlow]
          .map((x) => ph(content, x))
          .join(t("joinSemicolon")) + t("sentenceEnd"),
    },
  ];
  const s = summaryStep(exp, t, content);
  if (s) steps.push(s);
  return steps;
}

// 导电性对比讲解：强 / 弱电解质灯泡亮度对比
function conductivityLesson(exp: ExperimentSeed, t: LessonT, content: LessonContent): LessonStep[] | null {
  if (!usesConductivity(exp.apparatus)) return null;
  const solutions = exp.reagents
    .map((r) => resolveSubstance(r))
    .filter((s) => s.category !== "metal" && s.category !== "other");
  if (solutions.length === 0) return null;
  const steps: LessonStep[] = [
    { id: "intro", phase: "theory", title: t("titlePrinciple"), narration: content.description ?? exp.description, action: { kind: "reset" } },
    { id: "setup", phase: "prep", title: t("titleConnect"), narration: t("narrSetupConduct") },
    { id: "power", phase: "operate", title: t("titleConductTest"), narration: t("narrConductTest"), action: { kind: "energize" } },
    {
      id: "observe",
      phase: "observe",
      title: t("titleConductCompare"),
      narration: solutions.map((s) => ph(content, conductivity(s).note)).join(t("sentenceJoin")),
    },
  ];
  const s = summaryStep(exp, t, content);
  if (s) steps.push(s);
  return steps;
}

// 通用电化学兜底：装置判定为电解 / 原电池 / 导电，但无法被精细引擎建模
// （如熔盐电解、燃料电池、外加电流保护）。仍属电化学，须走通电讲解而非混合，
// 否则会错误地生成「混合反应」步骤。
function genericElectrochemLesson(exp: ExperimentSeed, t: LessonT, content: LessonContent): LessonStep[] | null {
  const isElectrolysis = isElectrolysisSetup(exp.apparatus);
  const isGalvanic = isGalvanicSetup(exp.apparatus);
  if (!isElectrolysis && !isGalvanic && !usesConductivity(exp.apparatus)) return null;
  const verb = isElectrolysis ? t("verbElectrolysis") : t("verbCircuit");
  const steps: LessonStep[] = [
    { id: "intro", phase: "theory", title: t("titlePrinciple"), narration: content.description ?? exp.description, action: { kind: "reset" } },
    { id: "setup", phase: "prep", title: t("titleConnect"), narration: t("narrSetupGeneric") },
    { id: "power", phase: "operate", title: verb, narration: t("narrRigOn", { verb }), action: { kind: "energize" } },
    { id: "observe", phase: "observe", title: t("titleElectrodes"), narration: describePhenomena(exp.probe?.expect, t) },
  ];
  const s = summaryStep(exp, t, content);
  if (s) steps.push(s);
  return steps;
}

export function buildLesson(
  exp: ExperimentSeed,
  t: LessonT,
  content: LessonContent = {},
): LessonStep[] {
  // 电化学实验：生成模式对应的讲解（通电 / 接通电路 + 真实两极现象）
  const electro =
    electrolysisLesson(exp, t, content) ??
    galvanicLesson(exp, t, content) ??
    conductivityLesson(exp, t, content) ??
    genericElectrochemLesson(exp, t, content);
  if (electro) return electro;

  const steps: LessonStep[] = [];
  const reagents = pickReagents(exp);
  const vessel = vesselKind(exp);

  // 原理：实验描述
  steps.push({
    id: "intro",
    phase: "theory",
    title: t("titlePrinciple"),
    narration: content.description ?? exp.description,
    action: { kind: "reset" },
  });

  // 准备：逐一取用试剂
  reagents.forEach((r, i) => {
    steps.push({
      id: `add-${i}`,
      phase: "prep",
      // 试剂名取术语表译名：r 本身是引擎匹配键（中文），不能改，
      // 但口播里该说学生看得懂的名字
      title: t("titleTake", { reagent: content.terms?.[r] ?? r }),
      narration: vesselSentence(t, "narrTake", vessel, { reagent: content.terms?.[r] ?? r }),
      action: { kind: "add", reagent: r },
    });
  });

  // 操作：需要加热的反应先点燃酒精灯 —— 引擎在常温下不给结果，
  // 少了这一步讲解播到"观察现象"时烧杯里其实什么也没发生
  const needHeat = Boolean(exp.probe?.heated);
  if (needHeat) {
    steps.push({
      id: "heat",
      phase: "operate",
      title: t("titleHeat"),
      narration: vesselSentence(t, "narrHeat", vessel),
      action: { kind: "heat" },
    });
  }

  // 操作：混合
  steps.push({
    id: "mix",
    phase: "operate",
    title: t("titleMix"),
    narration: needHeat
      ? t("narrMixHeated")
      : vesselSentence(t, "narrMix", vessel),
    action: { kind: "mix" },
  });

  // 现象：由探针描述
  steps.push({
    id: "observe",
    phase: "observe",
    title: t("titleObserve"),
    narration: describePhenomena(actualPhenomena(exp, reagents), t),
  });

  // 结论：实验目标（与电化学讲解共用 summaryStep）
  const summary = summaryStep(exp, t, content);
  if (summary) steps.push(summary);

  return steps;
}
