// 实验画布状态管理（zustand）：管理容器内试剂、最近一次反应结果与读数。
// 反应计算委托给 src/lib/chem/engine，本 store 不含任何反应规则。
import { create } from "zustand";
import {
  HEAT_THRESHOLD,
  react,
  type ReactionResult,
  type Substance,
} from "@/lib/chem/engine";
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
  // 会话绑定的实验 id：本 store 是模块级单例，切换实验时靠它识别"换了一个实验"
  experimentId: string | null;
  // 会话是否已标记完成
  completed: boolean;
  // 电化学装置是否通电 / 接通电路（电解、原电池实验用；讲解亦可驱动）
  energized: boolean;
  // 静默模式：期间的动作不产生用户级副作用（讲解重放专用，见 setSilent）
  silent: boolean;
  /**
   * 开关静默。分步讲解每前进一步都要"从头重放到当前步"来保证画面与讲解一致，
   * 这些是演示动作而非学生操作，不该留下任何痕迹：
   *  · 不记会话 —— 否则一次播放就灌进几十条 reset/add/mix，AI 报告里全是
   *    机械重复，学生真正做了什么反而被淹没，500 条上限也会被刷爆；
   *  · 不触发 AI 自动提问 —— TutorChat 订阅 result 变化会自动发问，
   *    而重放每步都 mix() 一次，一趟讲解能连着打出十几次真实 AI 请求。
   * 新增依赖 store 的副作用时，记得一并判断本标志。
   */
  setSilent: (on: boolean) => void;
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
  // 记录一条自定义操作 + 读数（供滴定等专用实验台使用：它们不走"加试剂→混合"的
  // 通用流程，若不给这个入口，其会话里 steps/measurements 会全空，AI 报告无从下笔）
  record: (
    action: string,
    detail?: Record<string, unknown>,
    readings?: LabReadings,
  ) => void;
  // 标记当前实验会话完成
  complete: () => void;
}

// 初始读数：中性 pH、室温
const INITIAL_READINGS: LabReadings = { ph: 7, temperature: 25 };

/**
 * 取可上报的会话 id：没有会话、或正处于讲解重放的静默期，都返回 null。
 * 所有旁路记录都经这一道，避免逐处遗漏 silent 判断。
 */
function reportTo(s: { sessionId: string | null; silent: boolean }): string | null {
  return s.sessionId && !s.silent ? s.sessionId : null;
}

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
  // 必须夹到 0~100：混合按钮可反复点击，每次都在上一次读数上叠加，
  // 放热反应连点几下就能冲到一百多度，温度计液柱直接画到玻璃管外面去。
  // 与 setTemperature 用同一区间，两条改温度的路径口径才一致。
  temperature = Math.max(0, Math.min(100, temperature));

  return { ph: Math.round(ph * 10) / 10, temperature };
}

export const useLabStore = create<LabState>((set, get) => ({
  contents: [],
  result: null,
  readings: INITIAL_READINGS,
  sessionId: null,
  experimentId: null,
  completed: false,
  energized: false,
  silent: false,

  setSilent: (on) => set({ silent: on }),

  setEnergized: (on) => {
    const { energized } = get();
    if (energized === on) return; // 状态未变不记录，避免重复点击刷步骤
    set({ energized: on });
    const sessionId = reportTo(get());
    // 电化学与装置类实验靠"接通电源/启动装置"驱动现象，这是它们唯一的关键操作。
    // 原先不记录，电解水这类会话里只有 add 步骤，AI 报告完全看不出学生通过电，
    // 误差分析会写成"未进行任何操作"。
    if (sessionId) {
      appendStepRemote(sessionId, {
        action: on ? "energize" : "de-energize",
        at: new Date().toISOString(),
      });
    }
  },

  initSession: (experimentId) => {
    const state = get();
    // 同一个实验重复挂载（StrictMode 双调用、2D/3D 切换）不重复建会话
    if (state.experimentId === experimentId) return;
    // 换了实验：本 store 是单例，不清空的话上一个实验的残留试剂、读数会跟着过来，
    // completed=true 更会让新实验的「完成实验」按钮一上来就是禁用的；
    // sessionId 若沿用，新实验的所有操作还会被记进上一个实验的会话里。
    set({
      experimentId,
      sessionId: null,
      completed: false,
      contents: [],
      result: null,
      readings: INITIAL_READINGS,
      energized: false,
      // 静默标志必须复位：讲解重放到一半切走实验，标志会卡在 true，
      // 新实验里学生自己的操作从此一条都记不上
      silent: false,
    });
    void createSessionRemote(experimentId).then((id) => {
      // 期间用户可能又切走了，迟到的响应不能盖掉新实验的会话
      if (id && get().experimentId === experimentId) {
        set({ sessionId: id, completed: false });
      }
    });
  },

  addReagent: (s) =>
    set((state) => {
      // 同化学式只保留一条，避免重复拖入堆叠
      if (state.contents.some((c) => c.formula === s.formula)) return state;
      const item: ContainerItem = { ...s, key: `${s.formula}-${Date.now()}` };
      // 旁路记录拖入步骤（失败静默忽略）
      const sid = reportTo(state);
      if (sid) {
        appendStepRemote(sid, {
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

  setTemperature: (t) => {
    const next = Math.max(0, Math.min(100, Math.round(t)));
    const { readings, result, contents } = get();
    const sessionId = reportTo(get());
    set({ readings: { ...readings, temperature: next } });
    // 只在跨越加热阈值时记一步，不记每一次滑动：2D 是连续滑杆，
    // 逐格上报能刷出上百条"调温"把有意义的步骤挤出 500 条上限。
    // 加热与否是化学上唯一有判据意义的分界，报告要的正是这个。
    if (sessionId && next >= HEAT_THRESHOLD !== readings.temperature >= HEAT_THRESHOLD) {
      appendStepRemote(sessionId, {
        action: next >= HEAT_THRESHOLD ? "heat" : "cool",
        detail: { 温度: `${next} ℃` },
        at: new Date().toISOString(),
      });
    }
    // 已经混合过、且跨越了加热阈值 —— 重算一次反应。
    // 否则用户点了"点燃酒精灯"要再点一次"混合反应"才见变化，而杯里试剂并没动，
    // 「加热就反应」这个因果关系在操作上就断开了。
    const crossed =
      next >= HEAT_THRESHOLD !== readings.temperature >= HEAT_THRESHOLD;
    if (result && crossed && contents.length >= 2) get().mix();
  },

  mix: () => {
    const { contents, readings } = get();
    const sessionId = reportTo(get());
    // 必须把当前温度传给引擎：需要加热的反应（酯化、银镜、铝热等）常温下不发生。
    // 原先只传 contents，界面上的"点燃酒精灯"按钮对反应结果毫无影响 ——
    // 提示语写着"调高温度（部分反应需加热）"，实际调了也一样，是句空话。
    const result = react(contents, { temperature: readings.temperature });
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
    const sessionId = reportTo(get());
    if (sessionId) {
      appendStepRemote(sessionId, {
        action: "reset",
        at: new Date().toISOString(),
      });
    }
    set({ contents: [], result: null, readings: INITIAL_READINGS, energized: false });
  },

  record: (action, detail, readings) => {
    const sessionId = reportTo(get());
    if (!sessionId) return;
    const at = new Date().toISOString();
    appendStepRemote(sessionId, { action, detail, at });
    // 给了读数才记测量点：滴定这类实验每滴都有 pH，但只在关键节点（终点）留档，
    // 否则一次滴定能刷出上千条测量记录，把会话上限（500）冲掉有意义的步骤。
    if (readings) {
      appendMeasurementRemote(sessionId, {
        ph: readings.ph,
        temperature: readings.temperature,
        at,
      });
    }
  },

  complete: () => {
    const { sessionId, completed } = get();
    if (!sessionId || completed) return;
    completeSessionRemote(sessionId);
    set({ completed: true });
  },
}));
