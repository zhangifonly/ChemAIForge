// 实验画布状态管理（zustand）：管理容器内试剂、最近一次反应结果与读数。
// 反应计算委托给 src/lib/chem/engine，本 store 不含任何反应规则。
import { create } from "zustand";
import { react, type ReactionResult, type Substance } from "@/lib/chem/engine";
import {
  appendMeasurementRemote,
  appendStepRemote,
  completeSessionRemote,
  createSessionRemote,
} from "./sessionClient";

// 容器内一种试剂的条目
export interface ContainerItem extends Substance {
  // 同名试剂去重用的稳定 key
  key: string;
}

// 画布读数：随操作变化的实时 pH 与温度
export interface LabReadings {
  ph: number;
  temperature: number;
}

interface LabState {
  // 当前容器内的试剂
  contents: ContainerItem[];
  // 最近一次混合的反应结果（未混合则为 null）
  result: ReactionResult | null;
  // 实时读数
  readings: LabReadings;
  // 当前实验会话 id（未建立 / 未登录则为 null，记录为旁路增强不阻塞交互）
  sessionId: string | null;
  // 会话是否已标记完成
  completed: boolean;
  // 电化学装置是否通电 / 接通电路（电解、原电池实验用；讲解亦可驱动）
  energized: boolean;
  // 绑定实验并创建会话（画布挂载时调用，幂等：已有会话则跳过）
  initSession: (experimentId: string) => void;
  // 拖入一种试剂
  addReagent: (s: Substance) => void;
  // 从容器移除一种试剂（按化学式）
  removeReagent: (formula: string) => void;
  // 调节体系温度（加热 / 冷却）：直接设定温度读数，作为下次反应的基准
  setTemperature: (t: number) => void;
  // 设置电化学装置通电状态（手动按钮 / 讲解共用）
  setEnergized: (on: boolean) => void;
  // 触发混合：调用引擎计算并更新结果与读数
  mix: () => void;
  // 清空容器，恢复初始读数
  reset: () => void;
  // 标记当前实验会话完成
  complete: () => void;
}

// 初始读数：中性 pH、室温
const INITIAL_READINGS: LabReadings = { ph: 7, temperature: 25 };

// 根据引擎结果推导读数变化（趋势映射为具体数值，便于可视化）
function deriveReadings(
  prev: LabReadings,
  result: ReactionResult,
): LabReadings {
  let ph = prev.ph;
  if (result.phTrend === "increase") ph = Math.min(14, prev.ph + 3);
  else if (result.phTrend === "decrease") ph = Math.max(0, prev.ph - 3);
  else if (result.phTrend === "neutral") ph = 7;

  let temperature = prev.temperature;
  if (result.thermal === "exothermic") temperature = prev.temperature + 15;
  else if (result.thermal === "endothermic") temperature = prev.temperature - 8;

  return { ph: Math.round(ph * 10) / 10, temperature };
}

export const useLabStore = create<LabState>((set, get) => ({
  contents: [],
  result: null,
  readings: INITIAL_READINGS,
  sessionId: null,
  completed: false,
  energized: false,

  setEnergized: (on) => set({ energized: on }),

  initSession: (experimentId) => {
    // 已绑定会话则不重复创建
    if (get().sessionId) return;
    void createSessionRemote(experimentId).then((id) => {
      if (id) set({ sessionId: id, completed: false });
    });
  },

  addReagent: (s) =>
    set((state) => {
      // 同化学式只保留一条，避免重复拖入堆叠
      if (state.contents.some((c) => c.formula === s.formula)) return state;
      const item: ContainerItem = { ...s, key: `${s.formula}-${Date.now()}` };
      // 旁路记录拖入步骤（失败静默忽略）
      if (state.sessionId) {
        appendStepRemote(state.sessionId, {
          action: "add",
          detail: { formula: s.formula, name: s.name },
          at: new Date().toISOString(),
        });
      }
      // 拖入新试剂后清空旧结果，等待重新混合
      return { contents: [...state.contents, item], result: null };
    }),

  removeReagent: (formula) =>
    set((state) => ({
      contents: state.contents.filter((c) => c.formula !== formula),
      // 容器变化后清空旧结果，等待重新混合
      result: null,
    })),

  setTemperature: (t) =>
    set((state) => ({
      readings: {
        ...state.readings,
        temperature: Math.max(0, Math.min(100, Math.round(t))),
      },
    })),

  mix: () => {
    const { contents, readings, sessionId } = get();
    const result = react(contents);
    const nextReadings = result.reacted
      ? deriveReadings(readings, result)
      : readings;
    set({ result, readings: nextReadings });
    // 旁路记录混合步骤与读数快照
    if (sessionId) {
      const at = new Date().toISOString();
      appendStepRemote(sessionId, {
        action: "mix",
        detail: {
          reacted: result.reacted,
          equation: result.equation,
          description: result.description,
        },
        at,
      });
      appendMeasurementRemote(sessionId, {
        ph: nextReadings.ph,
        temperature: nextReadings.temperature,
        at,
      });
    }
  },

  reset: () => {
    const { sessionId } = get();
    if (sessionId) {
      appendStepRemote(sessionId, {
        action: "reset",
        at: new Date().toISOString(),
      });
    }
    set({ contents: [], result: null, readings: INITIAL_READINGS, energized: false });
  },

  complete: () => {
    const { sessionId, completed } = get();
    if (!sessionId || completed) return;
    completeSessionRemote(sessionId);
    set({ completed: true });
  },
}));
