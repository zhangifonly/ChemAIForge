// 讲解生成器：从实验数据（描述 / 试剂 / 探针 / 目标）自动派生分步讲解，
// 无需为 102 个实验逐个编写脚本。纯函数，便于测试。
import type { ExperimentSeed } from "@/data/experiments";
import type { ReactionExpectation } from "@/data/experiments/types";
import type { LessonStep } from "./types";

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

export function buildLesson(exp: ExperimentSeed): LessonStep[] {
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
