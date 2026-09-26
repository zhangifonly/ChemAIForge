// 实验画布状态管理（zustand）：管理容器内试剂、最近一次反应结果与读数。
// 反应计算委托给 src/lib/chem/engine，本 store 不含任何反应规则。
import { create } from "zustand";
import {
  HEAT_THRESHOLD,
  react,
  type ReactionResult,
  type Substance,
} from "@/lib/chem/engine";
import { estimatePh } from "@/lib/chem/phasePlan";
import { amountOf, reagentSpec, type ReagentSpec } from "@/lib/chem/reagentSpec";
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
  // 累计取用量（溶液/液体 mL，固体 g）；同一试剂多次取用累加
  dose: number;
  // 取用规格（浓度/密度/摩尔质量），供面板显示与定量计算
  spec: ReagentSpec;
}

/** 容器内液体总体积（mL）：溶液与纯液体计体积，固体不计 */
export function totalVolume(contents: ContainerItem[]): number {
  return contents.reduce(
    (v, c) =>
      c.spec.phase === "solution" || c.spec.phase === "liquid" ? v + c.dose : v,
    0,
  );
}

// 画布读数：随操作变化的实时 pH 与温度
export interface LabReadings {
  ph: number;
  temperature: number;
}

/**
 * 过程记录的一个采样点。
 *
 * 为什么单独加一条序列而不是扩 LabReadings：readings 是"当前值"，被 2D/3D 面板、
 * AI 上下文、会话上报共同消费，扩字段会牵动全部调用点。而专业实验缺的是"过程" ——
 * 中和热要看温度-时间曲线找最高点，气体制备要看体积-时间判反应速率，
 * 单个瞬时值再多几个通道也画不出曲线。两者是不同的东西，分开存。
 */
export interface TracePoint {
  /** 相对实验开始的秒数 */
  t: number;
  ph: number;
  temperature: number;
  /** 容器内液体总体积（mL），随取用增加 */
  volume: number;
  /** 该点对应的操作标签，用于在曲线上标注关键节点 */
  mark?: string;
}

interface LabState {
  // 当前容器内的试剂
  contents: ContainerItem[];
  // 最近一次混合的反应结果（未混合则为 null）
  result: ReactionResult | null;
  // 实时读数
  readings: LabReadings;
  // 过程曲线的采样点序列（按时间递增）
  trace: TracePoint[];
  // 实验开始时刻（首次采样时确定），用于算相对秒数
  startedAt: number | null;
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
  /**
   * 取用一种试剂。dose 省略时按规格默认量（溶液 10 mL / 固体 2 g）——
   * 讲解重放与专用实验台的既有调用点不必关心用量，新面板则传精确值。
   * 同一试剂重复取用是累加，不是忽略：真实实验里"再加 5 mL"是常规操作。
   */
  addReagent: (s: Substance, dose?: number) => void;
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
 * 曲线采样点上限。
 * 加热是连续滑杆、滴加可以点上百次，不设上限会让数组无限增长并把 SVG 折线
 * 画成上千个点（渲染卡顿且看不出形状）。超限时丢最旧的点，保留近期过程。
 */
const TRACE_LIMIT = 240;

/**
 * 追加一个采样点。纯函数，返回新序列。
 * 相同时刻（同一秒内的连续操作）不合并 —— 中和热测定里"混合瞬间"前后两点
 * 的温差正是要测的东西，合并会把它抹掉。
 */
function sample(
  prev: TracePoint[],
  startedAt: number,
  readings: LabReadings,
  contents: ContainerItem[],
  mark?: string,
): TracePoint[] {
  const point: TracePoint = {
    t: Math.round(((Date.now() - startedAt) / 1000) * 10) / 10,
    ph: readings.ph,
    temperature: readings.temperature,
    volume: Math.round(totalVolume(contents) * 100) / 100,
    mark,
  };
  const next = [...prev, point];
  return next.length > TRACE_LIMIT ? next.slice(next.length - TRACE_LIMIT) : next;
}

/**
 * 取可上报的会话 id：没有会话、或正处于讲解重放的静默期，都返回 null。
 * 所有旁路记录都经这一道，避免逐处遗漏 silent 判断。
 */
function reportTo(s: { sessionId: string | null; silent: boolean }): string | null {
  return s.sessionId && !s.silent ? s.sessionId : null;
}

/**
 * 容器当前内容对应的 pH 基准。
 *
 * 必须按内容物估算，不能拿 7 当起点：原先 readings.ph 是常量 7，加什么试剂都不动，
 * 于是往烧杯里倒稀盐酸、读数面板照样显示 7.0 —— 501 个实验里 257 个混合前就偏离
 * 中性 2 个 pH 以上（盐酸 1.2、氨水 11.1、碳酸钠 9.2）。3D 的 pH 计走的是
 * estimatePh(contents)，同一个实验切个视图读数就换一套，学生无从判断哪个是真的。
 * 这两个视图共用 estimatePh，口径才统一。
 */
function basePh(contents: Substance[]): number {
  return Math.round(estimatePh(contents) * 10) / 10;
}

// 根据引擎结果推导读数变化（趋势映射为具体数值，便于可视化）
function deriveReadings(
  prev: LabReadings,
  result: ReactionResult,
  contents: Substance[],
): LabReadings {
  // 反应后的 pH 以「反应前内容物的估算值」为基准做趋势偏移，而不是以 7 为基准。
  // 稀盐酸(1.2)加锌粒产氢、酸被消耗 → phTrend=increase，应该是 1.2 往上走到 4.2，
  // 而不是从 7 跳到 10 —— 后者把一杯酸液报成强碱，与右侧「石蕊变红」自相矛盾。
  const start = basePh(contents);
  let ph = start;
  if (result.phTrend === "increase") ph = Math.min(14, start + 3);
  else if (result.phTrend === "decrease") ph = Math.max(0, start - 3);
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
  trace: [],
  startedAt: null,
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
      // 曲线必须随实验清空：不清的话新实验一打开就带着上个实验的温度曲线
      trace: [],
      startedAt: null,
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

  addReagent: (s, dose) =>
    set((state) => {
      const spec = reagentSpec(s.formula, s.category);
      const add = dose ?? spec.defaultDose;
      const existing = state.contents.find((c) => c.formula === s.formula);
      // 同化学式累加用量而非新增一条：容器里"盐酸"只该有一项，但可以有 15 mL
      const nextDose = (existing?.dose ?? 0) + add;
      // amount 传给引擎判断过量/不足；bulk 与指示剂无物质的量，保持 undefined
      const amount = amountOf(spec, nextDose) ?? undefined;
      const item: ContainerItem = {
        ...s,
        amount,
        key: existing?.key ?? `${s.formula}-${Date.now()}`,
        dose: nextDose,
        spec,
      };
      // 旁路记录取用步骤（失败静默忽略）。用量必须进 detail：
      // 报告里"加入盐酸"与"加入 25.00 mL 0.1 mol/L 盐酸"是两种档次的实验记录。
      const sid = reportTo(state);
      if (sid) {
        appendStepRemote(sid, {
          action: "add",
          detail: {
            formula: s.formula,
            name: s.name,
            用量: `${add} ${spec.unit}`,
            规格: spec.label,
            ...(amount !== undefined
              ? { 物质的量: `${amount.toFixed(4)} mol` }
              : {}),
          },
          at: new Date().toISOString(),
        });
      }
      // 取用后清空旧结果，等待重新混合
      const next = existing
        ? state.contents.map((c) => (c.formula === s.formula ? item : c))
        : [...state.contents, item];
      // pH 读数随内容物即时更新：混合前就该看到「倒进去的是酸」
      const readings = { ...state.readings, ph: basePh(next) };
      // 讲解重放期间不采样：一趟播放会把曲线灌成几十个假点，学生自己做的过程被淹没
      const startedAt = state.startedAt ?? Date.now();
      return {
        contents: next,
        result: null,
        readings,
        startedAt: state.silent ? state.startedAt : startedAt,
        trace: state.silent
          ? state.trace
          : sample(state.trace, startedAt, readings, next, `加${s.name}`),
      };
    }),

  removeReagent: (formula) =>
    set((state) => {
      const target = state.contents.find((c) => c.formula === formula);
      // 容器里没这一项就什么都不做，避免点击竞态记出一条不存在的移除
      if (!target) return state;
      // 移除必须和 add 一样上报：只记加不记减，会话里就是一份只增不减的流水，
      // 学生把 A 拿出来再混合，报告仍按 A+B 去分析，误差分析对着一个
      // 根本没发生的反应写。detail 与 add 对齐，便于报告按化学式配对。
      const sid = reportTo(state);
      if (sid) {
        appendStepRemote(sid, {
          action: "remove",
          detail: { formula: target.formula, name: target.name },
          at: new Date().toISOString(),
        });
      }
      const rest = state.contents.filter((c) => c.formula !== formula);
      const readings = { ...state.readings, ph: basePh(rest) };
      const startedAt = state.startedAt ?? Date.now();
      return {
        contents: rest,
        // 容器变化后清空旧结果，等待重新混合
        result: null,
        // 把试剂拿出来，pH 也要跟着退回去，否则移除强酸后读数还停在 1.2
        readings,
        startedAt: state.silent ? state.startedAt : startedAt,
        trace: state.silent
          ? state.trace
          : sample(state.trace, startedAt, readings, rest, `移除${target.name}`),
      };
    }),

  setTemperature: (t) => {
    const next = Math.max(0, Math.min(100, Math.round(t)));
    const { readings, result, contents, silent, trace } = get();
    const sessionId = reportTo(get());
    if (next === readings.temperature) return; // 值未变不采样，避免滑杆同格重复触发
    const nextReadings = { ...readings, temperature: next };
    const startedAt = get().startedAt ?? Date.now();
    // 温度是唯一会连续变化的读数，曲线主要靠它成形（中和热的温度-时间曲线即此）
    set({
      readings: nextReadings,
      ...(silent
        ? {}
        : { startedAt, trace: sample(trace, startedAt, nextReadings, contents) }),
    });
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
    // 没反应也要按内容物给读数：反应不发生 ≠ 杯里是中性水
    const nextReadings = result.reacted
      ? deriveReadings(readings, result, contents)
      : { ...readings, ph: basePh(contents) };
    const { silent, trace } = get();
    const startedAt = get().startedAt ?? Date.now();
    set({
      result,
      readings: nextReadings,
      // 混合点必须标注：中和热测定看的就是混合前后那一段陡升，
      // 曲线上没有标记，学生分不清哪个峰是反应造成的
      ...(silent
        ? {}
        : {
            startedAt,
            trace: sample(trace, startedAt, nextReadings, contents, "混合"),
          }),
    });
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
        volume: Math.round(totalVolume(contents) * 100) / 100,
        // 与 trace 上的标记同名：混合是体系改动点，它前后的读数不构成平行测定
        mark: "混合",
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
    set({
      contents: [],
      result: null,
      readings: INITIAL_READINGS,
      // 清空重做时曲线也要归零：留着上一轮的曲线，"多次测量"就分不清哪条是这一轮的
      trace: [],
      startedAt: null,
      energized: false,
    });
  },

  record: (action, detail, readings) => {
    // 采样与会话上报解耦：没登录（sessionId 为空）时曲线仍要能画出来，
    // 否则未登录用户的专用实验台读数面板永远是空的。
    const state = get();
    if (readings && !state.silent) {
      const startedAt = state.startedAt ?? Date.now();
      set({
        startedAt,
        trace: sample(state.trace, startedAt, readings, state.contents, action),
      });
    }
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
        // 带上体积与动作标记，AI 报告才能复现实验台数据表的那套统计：
        // 靠 mark 分出哪些是「读数」、体系在何处被改动，靠 volume 参与定量算式。
        volume: Math.round(totalVolume(state.contents) * 100) / 100,
        mark: action,
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
