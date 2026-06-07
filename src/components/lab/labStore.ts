// 实验画布状态管理（zustand）：管理容器内试剂、最近一次反应结果与读数。
// 反应计算委托给 src/lib/chem/engine，本 store 不含任何反应规则。
import { create } from "zustand";
import { react, type ReactionResult, type Substance } from "@/lib/chem/engine";

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
  // 拖入一种试剂
  addReagent: (s: Substance) => void;
  // 触发混合：调用引擎计算并更新结果与读数
  mix: () => void;
  // 清空容器，恢复初始读数
  reset: () => void;
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

  addReagent: (s) =>
    set((state) => {
      // 同化学式只保留一条，避免重复拖入堆叠
      if (state.contents.some((c) => c.formula === s.formula)) return state;
      const item: ContainerItem = { ...s, key: `${s.formula}-${Date.now()}` };
      // 拖入新试剂后清空旧结果，等待重新混合
      return { contents: [...state.contents, item], result: null };
    }),

  mix: () => {
    const { contents, readings } = get();
    const result = react(contents);
    set({
      result,
      readings: result.reacted ? deriveReadings(readings, result) : readings,
    });
  },

  reset: () =>
    set({ contents: [], result: null, readings: INITIAL_READINGS }),
}));
