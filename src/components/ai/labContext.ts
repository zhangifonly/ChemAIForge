// AI 导师与实验画布之间的桥接：把 labStore 状态折叠为可随请求发送的
// labState 快照，并根据反应结果生成画布关键事件的"情境提示"问题。
import type { ReactionResult } from "@/lib/chem/engine";

// labStore 暴露给本模块使用的最小字段（避免直接耦合整个 store 接口）
interface LabSnapshot {
  contents: { name: string; formula: string }[];
  result: ReactionResult | null;
  readings: { ph: number; temperature: number };
}

// 把画布状态折叠为随请求发送的纯数据快照（labState）
export function buildLabState(s: LabSnapshot): Record<string, unknown> {
  return {
    容器内试剂: s.contents.map((c) => `${c.name}(${c.formula})`),
    pH: s.readings.ph,
    温度: s.readings.temperature,
    最近反应: s.result
      ? {
          发生反应: s.result.reacted,
          方程式: s.result.equation,
          现象: s.result.description,
          // 试剂对了只缺加热，与"试剂根本不匹配"必须让导师分得清：
          // 学生此刻最常问"为什么没反应"，只给 发生反应:false 会被答成"换试剂"，
          // 而正确的指引是点燃酒精灯。
          ...(s.result.pendingCondition === "heat"
            ? { 未反应原因: "试剂搭配正确，但尚未加热（该反应需加热才能进行）" }
            : {}),
        }
      : null,
  };
}

// 根据反应结果判断是否为关键事件，若是则返回一条自动询问的情境提示。
//
// 这句话会作为"学生的消息"显示在对话框里，故必须是当前界面语言 ——
// 否则日语用户会看到自己"说"了一句中文。取词函数由调用方注入（本文件是纯 .ts）。
type T = (key: string, vars?: Record<string, string | number>) => string;

export function contextualPrompt(
  result: ReactionResult,
  t: T,
  // 含汉字的方程式（「--点燃-->」「→ 盐 + …」）要换成当前语言；纯化学式原样
  phrase: (text: string) => string = (x) => x,
): string | null {
  // 缺加热是个明确的教学节点：试剂配对成功、只差条件，此时主动讲清"为什么必须加热"
  // 比等学生自己困惑更有价值，故不与"试剂不匹配"一起被静默掉。
  if (result.pendingCondition === "heat") return t("askHeat");
  if (!result.reacted) return null;
  const phenomena: string[] = [];
  if (result.producesPrecipitate) phenomena.push(t("phPrecipitate"));
  if (result.producesGas) phenomena.push(t("phGas"));
  if (result.colorChange) phenomena.push(t("phColor"));
  if (phenomena.length === 0) return null;
  // 方程式是国际通用记法，不译，只换外面的括号
  const equation = result.equation ? t("eqWrap", { equation: phrase(result.equation) }) : "";
  return t("askObserved", { equation, phenomena: phenomena.join(t("listJoin")) });
}
