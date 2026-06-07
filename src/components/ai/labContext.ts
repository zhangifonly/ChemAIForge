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
        }
      : null,
  };
}

// 根据反应结果判断是否为关键事件，若是则返回一条自动询问的情境提示
export function contextualPrompt(result: ReactionResult): string | null {
  if (!result.reacted) return null;
  const phenomena: string[] = [];
  if (result.producesPrecipitate) phenomena.push("生成沉淀");
  if (result.producesGas) phenomena.push("产生气体");
  if (result.colorChange) phenomena.push("发生颜色变化");
  if (phenomena.length === 0) return null;
  const eq = result.equation ? `（${result.equation}）` : "";
  return `我刚刚观察到反应${eq}${phenomena.join("、")}，请帮我解释发生了什么、原理是什么？`;
}
