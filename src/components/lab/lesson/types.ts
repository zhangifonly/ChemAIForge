// 实验分步讲解（借鉴 mathviz 的场景化口播）：每一步对应一句讲解 + 一个驱动
// 实验台的动作。播放器按步执行动作，让立体烧杯随讲解自动演示。

// 步骤所属阶段。
// 取值用英文键而非中文：它既是类型标识又要显示给用户，写成中文就等于
// 把显示文案钉死在类型里 —— 日语界面下无从翻译。显示文案走 lesson.phase* 词条。
export type LessonPhase = "theory" | "prep" | "operate" | "observe" | "conclude";

// 驱动实验台的动作：清空 / 取用试剂 / 加热 / 混合 / 通电；现象与结论步骤无动作
export type LessonAction =
  | { kind: "reset" }
  | { kind: "add"; reagent: string } // 试剂中文名，经 resolveSubstance 解析
  | { kind: "heat" } // 点燃酒精灯：酯化、银镜、燃烧等反应不加热不进行
  | { kind: "mix" }
  | { kind: "energize" }; // 电化学：接通电源 / 电路

// 一步讲解
export interface LessonStep {
  id: string;
  phase: LessonPhase;
  title: string; // 步骤短标题
  narration: string; // 口播 / 字幕文字
  action?: LessonAction;
}
