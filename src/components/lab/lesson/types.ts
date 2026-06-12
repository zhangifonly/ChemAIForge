// 实验分步讲解（借鉴 mathviz 的场景化口播）：每一步对应一句讲解 + 一个驱动
// 实验台的动作。播放器按步执行动作，让立体烧杯随讲解自动演示。

// 步骤所属阶段（用于显示阶段标签）
export type LessonPhase = "原理" | "准备" | "操作" | "现象" | "结论";

// 驱动实验台的动作：清空 / 取用试剂 / 混合；现象与结论步骤无动作
export type LessonAction =
  | { kind: "reset" }
  | { kind: "add"; reagent: string } // 试剂中文名，经 resolveSubstance 解析
  | { kind: "mix" };

// 一步讲解
export interface LessonStep {
  id: string;
  phase: LessonPhase;
  title: string; // 步骤短标题
  narration: string; // 口播 / 字幕文字
  action?: LessonAction;
}
