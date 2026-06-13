// 讲解生成器：从实验数据（描述 / 试剂 / 探针 / 目标）自动派生分步讲解，
// 无需为 102 个实验逐个编写脚本。纯函数，便于测试。
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

// 由探针预期现象生成「现象」步骤的口播
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

export function buildLesson(exp: ExperimentSeed): LessonStep[] {
  // 电化学实验：生成模式对应的讲解（通电 / 接通电路 + 真实两极现象）
  const electro =
    electrolysisLesson(exp) ?? galvanicLesson(exp) ?? conductivityLesson(exp);
  if (electro) return electro;

  const steps: LessonStep[] = [];
  const reagents = pickReagents(exp);

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
      narration: `取用${r}，加入烧杯中。`,
      action: { kind: "add", reagent: r },
    });
  });

  // 操作：混合
  steps.push({
    id: "mix",
    phase: "操作",
    title: "混合反应",
    narration: "将烧杯中的试剂充分混合，反应随即开始。",
    action: { kind: "mix" },
  });

  // 现象：由探针描述
  steps.push({
    id: "observe",
    phase: "现象",
    title: "观察现象",
    narration: describePhenomena(exp.probe?.expect),
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
