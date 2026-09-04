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

/** 容器的中文称呼，用于口播 */
const VESSEL_NAME: Record<string, string> = {
  beaker: "烧杯",
  tube: "试管",
  flask: "锥形瓶",
};

/**
 * 讲解里提到的容器必须与 3D 里真正画出来的那个一致。
 *
 * 原先三处口播把容器名写死（"加入烧杯中"/"给试管加热"/"将烧杯中的试剂充分混合"），
 * 而 3D 按 chooseVessel 选型 —— 501 个实验里 313 个说着烧杯、画的却是试管或锥形瓶，
 * 其中 54 个更在同一段讲解里先说烧杯、再说试管、又说烧杯，自相矛盾。
 * 这里复用 3D 完全相同的推导（planRig + chooseVessel），两边不可能再对不上。
 */
function vesselName(exp: ExperimentSeed): string {
  const apparatus = exp.apparatus ?? [];
  return VESSEL_NAME[chooseVessel(apparatus, planRig(apparatus).kind)] ?? "烧杯";
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

// 把现象四元组铺成一句口播
function describePhenomena(e?: ReactionExpectation): string {
  if (!e || !e.reacted)
    return "仔细观察体系，留意是否出现颜色、气泡或温度的变化。";
  const parts: string[] = [];
  if (e.gas) parts.push("有气泡不断逸出");
  if (e.precipitate) parts.push("溶液变浑浊并生成沉淀");
  if (e.colorChange) parts.push("溶液颜色发生明显变化");
  if (e.thermal === "exothermic") parts.push("同时放出热量、温度升高");
  else if (e.thermal === "endothermic") parts.push("同时吸收热量、温度下降");
  if (parts.length === 0)
    return "反应正在发生，注意观察 pH 与温度读数的变化。";
  return `可以看到${parts.join("，")}。`;
}

// 选定参与演示的试剂：优先用探针试剂（保证能反应），否则取前若干种
function pickReagents(exp: ExperimentSeed): string[] {
  if (exp.probe?.reagentKeys?.length) return exp.probe.reagentKeys;
  return exp.reagents.slice(0, Math.min(3, exp.reagents.length));
}

// 结论步骤（实验目标），电化学与混合讲解共用
function summaryStep(exp: ExperimentSeed): LessonStep | null {
  if (!exp.objectives.length) return null;
  return {
    id: "summary",
    phase: "结论",
    title: "实验小结",
    narration: `通过本实验，你将${exp.objectives.join("；")}。`,
  };
}

// 电解实验讲解：依放电顺序描述两极现象
function electrolysisLesson(exp: ExperimentSeed): LessonStep[] | null {
  if (!isElectrolysisSetup(exp.apparatus)) return null;
  const electrolyte = exp.reagents
    .map((r) => resolveSubstance(r).formula)
    .find(isElectrolyte);
  if (!electrolyte) return null;
  const er = electrolyze(electrolyte, { inertAnode: isInertAnode(exp.apparatus) });
  if (!er) return null;
  const steps: LessonStep[] = [
    { id: "intro", phase: "原理", title: "实验原理", narration: exp.description, action: { kind: "reset" } },
    { id: "setup", phase: "准备", title: "连接装置", narration: "将电极插入电解液，分别与直流电源的正、负极相连。" },
    { id: "power", phase: "操作", title: "接通电源", narration: "接通直流电源，开始电解，注意观察两极变化。", action: { kind: "energize" } },
    {
      id: "observe",
      phase: "现象",
      title: "两极现象",
      narration: `${er.cathode.observation}；${er.anode.observation}${er.colorFades ? "；溶液蓝色逐渐变浅" : ""}。`,
    },
  ];
  const s = summaryStep(exp);
  if (s) steps.push(s);
  return steps;
}

// 原电池 / 腐蚀讲解：依金属活动性描述正负极
function galvanicLesson(exp: ExperimentSeed): LessonStep[] | null {
  if (!isGalvanicSetup(exp.apparatus)) return null;
  const metals = exp.reagents
    .map((r) => resolveSubstance(r))
    .filter((s) => isGalvanicMetal(s.formula));
  if (metals.length === 0) return null;
  const acid = exp.reagents.map((r) => resolveSubstance(r)).find((s) => s.category === "acid");
  const electrolyte = acid ?? { formula: "NaCl", name: "食盐水" };
  const gr = galvanicCell(metals.map((m) => m.formula), electrolyte);
  if (!gr) return null;
  const steps: LessonStep[] = [
    { id: "intro", phase: "原理", title: "实验原理", narration: exp.description, action: { kind: "reset" } },
    { id: "setup", phase: "准备", title: "连接电路", narration: "用导线将两电极经电流计相连，插入电解质溶液。" },
    { id: "connect", phase: "操作", title: "接通电路", narration: "接通电路，观察电流计指针是否偏转。", action: { kind: "energize" } },
    {
      id: "observe",
      phase: "现象",
      title: "两极现象",
      narration: `${gr.negative.observation}；${gr.positive.observation}；${gr.electronFlow}。`,
    },
  ];
  const s = summaryStep(exp);
  if (s) steps.push(s);
  return steps;
}

// 导电性对比讲解：强 / 弱电解质灯泡亮度对比
function conductivityLesson(exp: ExperimentSeed): LessonStep[] | null {
  if (!usesConductivity(exp.apparatus)) return null;
  const solutions = exp.reagents
    .map((r) => resolveSubstance(r))
    .filter((s) => s.category !== "metal" && s.category !== "other");
  if (solutions.length === 0) return null;
  const steps: LessonStep[] = [
    { id: "intro", phase: "原理", title: "实验原理", narration: exp.description, action: { kind: "reset" } },
    { id: "setup", phase: "准备", title: "连接装置", narration: "将相同浓度的溶液分别接入带灯泡的电极电路。" },
    { id: "power", phase: "操作", title: "通电检测", narration: "接通电路，比较各溶液中灯泡的明暗。", action: { kind: "energize" } },
    {
      id: "observe",
      phase: "现象",
      title: "导电性对比",
      narration: solutions.map((s) => conductivity(s).note).join(""),
    },
  ];
  const s = summaryStep(exp);
  if (s) steps.push(s);
  return steps;
}

// 通用电化学兜底：装置判定为电解 / 原电池 / 导电，但无法被精细引擎建模
// （如熔盐电解、燃料电池、外加电流保护）。仍属电化学，须走通电讲解而非混合，
// 否则会错误地生成「混合反应」步骤。
function genericElectrochemLesson(exp: ExperimentSeed): LessonStep[] | null {
  const isElectrolysis = isElectrolysisSetup(exp.apparatus);
  const isGalvanic = isGalvanicSetup(exp.apparatus);
  if (!isElectrolysis && !isGalvanic && !usesConductivity(exp.apparatus)) return null;
  const verb = isElectrolysis ? "接通直流电源，开始电解" : "接通电路";
  const steps: LessonStep[] = [
    { id: "intro", phase: "原理", title: "实验原理", narration: exp.description, action: { kind: "reset" } },
    { id: "setup", phase: "准备", title: "连接装置", narration: "按电路图连接电极与电源／测量仪表，插入电解质。" },
    { id: "power", phase: "操作", title: verb, narration: `${verb}，注意观察两极及仪表的变化。`, action: { kind: "energize" } },
    { id: "observe", phase: "现象", title: "两极现象", narration: describePhenomena(exp.probe?.expect) },
  ];
  const s = summaryStep(exp);
  if (s) steps.push(s);
  return steps;
}

export function buildLesson(exp: ExperimentSeed): LessonStep[] {
  // 电化学实验：生成模式对应的讲解（通电 / 接通电路 + 真实两极现象）
  const electro =
    electrolysisLesson(exp) ??
    galvanicLesson(exp) ??
    conductivityLesson(exp) ??
    genericElectrochemLesson(exp);
  if (electro) return electro;

  const steps: LessonStep[] = [];
  const reagents = pickReagents(exp);
  const vessel = vesselName(exp);

  // 原理：实验描述
  steps.push({
    id: "intro",
    phase: "原理",
    title: "实验原理",
    narration: exp.description,
    action: { kind: "reset" },
  });

  // 准备：逐一取用试剂
  reagents.forEach((r, i) => {
    steps.push({
      id: `add-${i}`,
      phase: "准备",
      title: `取用${r}`,
      narration: `取用${r}，加入${vessel}中。`,
      action: { kind: "add", reagent: r },
    });
  });

  // 操作：需要加热的反应先点燃酒精灯 —— 引擎在常温下不给结果，
  // 少了这一步讲解播到"观察现象"时烧杯里其实什么也没发生
  const needHeat = Boolean(exp.probe?.heated);
  if (needHeat) {
    steps.push({
      id: "heat",
      phase: "操作",
      title: "点燃酒精灯",
      narration: `点燃酒精灯给${vessel}加热 —— 这个反应必须在受热条件下才能进行。`,
      action: { kind: "heat" },
    });
  }

  // 操作：混合
  steps.push({
    id: "mix",
    phase: "操作",
    title: "混合反应",
    narration: needHeat
      ? "受热后将试剂充分混合，反应随即开始。"
      : `将${vessel}中的试剂充分混合，反应随即开始。`,
    action: { kind: "mix" },
  });

  // 现象：由探针描述
  steps.push({
    id: "observe",
    phase: "现象",
    title: "观察现象",
    narration: describePhenomena(actualPhenomena(exp, reagents)),
  });

  // 结论：实验目标
  if (exp.objectives.length) {
    steps.push({
      id: "summary",
      phase: "结论",
      title: "实验小结",
      narration: `通过本实验，你将${exp.objectives.join("；")}。`,
    });
  }

  return steps;
}
