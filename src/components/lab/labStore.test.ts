// 实验台 store 的行为约束：单例状态在实验间的隔离、温度夹取、加热重算。
// 会话记录是旁路增强，这里把 sessionClient 整体 mock 掉，只验状态机。
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./sessionClient", () => ({
  createSessionRemote: vi.fn(async () => "sess-1"),
  appendStepRemote: vi.fn(),
  appendMeasurementRemote: vi.fn(),
  completeSessionRemote: vi.fn(),
}));

import { totalVolume, useLabStore } from "./labStore";
import { resolveSubstance } from "./reagents";
import { HEAT_THRESHOLD } from "@/lib/chem/engine";
import { appendMeasurementRemote, appendStepRemote } from "./sessionClient";

const S = (name: string) => resolveSubstance(name);

beforeEach(() => {
  useLabStore.setState({
    contents: [],
    result: null,
    readings: { ph: 7, temperature: 25 },
    trace: [],
    startedAt: null,
    sessionId: null,
    experimentId: null,
    completed: false,
    energized: false,
    silent: false,
  });
  vi.mocked(appendStepRemote).mockClear();
  vi.mocked(appendMeasurementRemote).mockClear();
});

describe("实验切换时的状态隔离", () => {
  // store 是模块级单例，切换实验时若不清空，上一个实验的试剂、读数会跟着过来，
  // completed=true 还会让新实验的「完成实验」按钮一上来就禁用。
  it("换实验时清空试剂、结果、读数与完成标记", async () => {
    const s = useLabStore.getState();
    s.initSession("exp-a");
    await Promise.resolve();
    useLabStore.getState().addReagent(S("盐酸"));
    useLabStore.getState().addReagent(S("氢氧化钠"));
    useLabStore.getState().mix();
    useLabStore.getState().complete();
    expect(useLabStore.getState().completed).toBe(true);
    expect(useLabStore.getState().contents.length).toBe(2);

    useLabStore.getState().initSession("exp-b");
    const next = useLabStore.getState();
    expect(next.experimentId).toBe("exp-b");
    expect(next.contents).toEqual([]);
    expect(next.result).toBeNull();
    expect(next.completed).toBe(false);
    expect(next.readings).toEqual({ ph: 7, temperature: 25 });
  });

  it("同一实验重复挂载不重置已有操作", async () => {
    useLabStore.getState().initSession("exp-a");
    await Promise.resolve();
    useLabStore.getState().addReagent(S("盐酸"));
    useLabStore.getState().initSession("exp-a");
    expect(useLabStore.getState().contents.length).toBe(1);
  });
});

describe("读数", () => {
  it("反复混合放热反应的温度不越过 100 ℃", () => {
    useLabStore.getState().addReagent(S("盐酸"));
    useLabStore.getState().addReagent(S("氢氧化钠"));
    for (let i = 0; i < 20; i++) useLabStore.getState().mix();
    expect(useLabStore.getState().readings.temperature).toBeLessThanOrEqual(100);
  });

  it("setTemperature 夹在 0~100", () => {
    useLabStore.getState().setTemperature(999);
    expect(useLabStore.getState().readings.temperature).toBe(100);
    useLabStore.getState().setTemperature(-50);
    expect(useLabStore.getState().readings.temperature).toBe(0);
  });
});

describe("加热与反应联动", () => {
  // 需加热的反应在常温下引擎给 pendingCondition，点燃酒精灯后应自动重算，
  // 否则用户还要再点一次「混合反应」才见变化，而杯里试剂并没动过。
  it("混合后升温跨过阈值自动重算反应", () => {
    const s = useLabStore.getState();
    s.addReagent(S("乙酸"));
    s.addReagent(S("乙醇"));
    s.addReagent(S("硫酸"));
    useLabStore.getState().mix();
    expect(useLabStore.getState().result?.reacted).toBe(false);
    expect(useLabStore.getState().result?.pendingCondition).toBe("heat");

    useLabStore.getState().setTemperature(HEAT_THRESHOLD + 20);
    expect(useLabStore.getState().result?.reacted).toBe(true);
    expect(useLabStore.getState().result?.pendingCondition).toBeUndefined();
  });

  it("未混合过时升温不擅自触发反应", () => {
    const s = useLabStore.getState();
    s.addReagent(S("乙酸"));
    s.addReagent(S("乙醇"));
    useLabStore.getState().setTemperature(HEAT_THRESHOLD + 20);
    expect(useLabStore.getState().result).toBeNull();
  });
});

describe("专用实验台的自定义记录（record）", () => {
  // 滴定这类实验台不走"加试剂→混合"的通用流程，靠 record 把关键节点写进会话，
  // 否则其会话里 steps/measurements 全空，报告页一片空白。
  it("有会话时上报步骤，带读数时同时上报测量点", () => {
    useLabStore.setState({ sessionId: "sess-1" });
    useLabStore.getState().record(
      "titration-endpoint",
      { 终点体积: "20.86 mL" },
      { ph: 7.2, temperature: 25 },
    );
    expect(appendStepRemote).toHaveBeenCalledTimes(1);
    const [sid, step] = vi.mocked(appendStepRemote).mock.calls[0];
    expect(sid).toBe("sess-1");
    expect(step.action).toBe("titration-endpoint");
    expect(step.detail).toEqual({ 终点体积: "20.86 mL" });
    expect(appendMeasurementRemote).toHaveBeenCalledTimes(1);
    expect(vi.mocked(appendMeasurementRemote).mock.calls[0][1].ph).toBe(7.2);
  });

  // 滴定每滴都有 pH，若无条件记测量点，一次实验能刷出上千条把会话上限冲爆
  it("不给读数时只记步骤，不记测量点", () => {
    useLabStore.setState({ sessionId: "sess-1" });
    useLabStore.getState().record("titration-prepare");
    expect(appendStepRemote).toHaveBeenCalledTimes(1);
    expect(appendMeasurementRemote).not.toHaveBeenCalled();
  });

  // 会话建立失败是常态（记录为旁路增强），此时不能抛错阻塞交互
  it("无会话时静默跳过", () => {
    useLabStore.setState({ sessionId: null });
    expect(() => useLabStore.getState().record("titration-reset")).not.toThrow();
    expect(appendStepRemote).not.toHaveBeenCalled();
  });
});

describe("关键条件的会话记录（通电 / 加热）", () => {
  // 电解水这类实验唯一的操作就是通电，不记录则会话里只有 add，
  // AI 报告会写成"未进行任何操作"。
  it("通电与断电各记一步", () => {
    useLabStore.setState({ sessionId: "sess-1" });
    useLabStore.getState().setEnergized(true);
    useLabStore.getState().setEnergized(false);
    const actions = vi.mocked(appendStepRemote).mock.calls.map((c) => c[1].action);
    expect(actions).toEqual(["energize", "de-energize"]);
  });

  it("重复设为同一状态不刷步骤", () => {
    useLabStore.setState({ sessionId: "sess-1" });
    useLabStore.getState().setEnergized(true);
    useLabStore.getState().setEnergized(true);
    expect(appendStepRemote).toHaveBeenCalledTimes(1);
  });

  // 2D 是连续滑杆，逐格上报能刷出上百条调温把有意义的步骤挤出 500 条上限
  it("温度只在跨越加热阈值时记一步", () => {
    useLabStore.setState({ sessionId: "sess-1" });
    useLabStore.getState().setTemperature(30);
    useLabStore.getState().setTemperature(40);
    expect(appendStepRemote).not.toHaveBeenCalled();
    useLabStore.getState().setTemperature(HEAT_THRESHOLD + 20);
    expect(vi.mocked(appendStepRemote).mock.calls[0][1].action).toBe("heat");
    useLabStore.getState().setTemperature(25);
    expect(vi.mocked(appendStepRemote).mock.calls[1][1].action).toBe("cool");
  });
});

// 分步讲解每前进一步都要"从头重放到当前步"来保证画面与讲解一致，
// 这些是演示动作而非学生操作。不静默的话一次完整播放就往会话灌几十条
// reset/add/mix（实测平均 27 条、最多 74 条），AI 报告里全是机械重复，
// 学生真正做了什么反而被淹没，500 条上限也会被刷爆。
describe("讲解重放的静默模式", () => {
  beforeEach(async () => {
    useLabStore.getState().initSession("exp-lesson");
    await Promise.resolve();
    vi.mocked(appendStepRemote).mockClear();
    vi.mocked(appendMeasurementRemote).mockClear();
  });

  it("静默期内的加试剂 / 混合 / 通电 / 加热 / 清空一律不记入会话", () => {
    const s = useLabStore.getState();
    s.setSilent(true);
    s.reset();
    s.addReagent(S("盐酸"));
    s.addReagent(S("氢氧化钠"));
    useLabStore.getState().mix();
    useLabStore.getState().setEnergized(true);
    useLabStore.getState().setTemperature(HEAT_THRESHOLD + 20);
    useLabStore.getState().record("titrate", { 体积: "1 mL" }, { ph: 7, temperature: 25 });
    expect(appendStepRemote).not.toHaveBeenCalled();
    expect(appendMeasurementRemote).not.toHaveBeenCalled();
  });

  it("退出静默后学生自己的操作照常记录", () => {
    const s = useLabStore.getState();
    s.setSilent(true);
    s.addReagent(S("盐酸"));
    useLabStore.getState().setSilent(false);
    useLabStore.getState().addReagent(S("氢氧化钠"));
    expect(appendStepRemote).toHaveBeenCalledTimes(1);
  });

  it("切换实验会复位静默标志，避免重放中途切走后永久不记录", () => {
    useLabStore.getState().setSilent(true);
    useLabStore.getState().initSession("exp-other");
    expect(useLabStore.getState().silent).toBe(false);
  });
});

// TutorChat 订阅 result 变化会自动向 AI 发问。讲解重放每前进一步都 mix() 一次，
// 而 react() 每次返回新对象、躲得过引用去重 —— 不判静默就会连着打出十几次
// 真实 AI 请求。这里锁住"静默期 mix 仍产出结果但被标记为演示"这一前提。
describe("静默期的反应结果可被订阅方识别为演示", () => {
  it("mix 在静默期照常算出结果，同时 silent 为真", () => {
    useLabStore.getState().setSilent(true);
    useLabStore.getState().addReagent(S("盐酸"));
    useLabStore.getState().addReagent(S("氢氧化钠"));
    useLabStore.getState().mix();
    const st = useLabStore.getState();
    expect(st.result?.reacted).toBe(true); // 画面照常演示
    expect(st.silent).toBe(true); // 但订阅方据此跳过自动提问
  });
});

// 只记「加」不记「减」，会话就是一份只增不减的流水：学生把试剂拿出来再混合，
// AI 报告仍按原来的组合去分析，误差分析对着一个没发生过的反应写。
describe("移除试剂同样计入会话记录", () => {
  it("移除会上报一条 remove，detail 与 add 对齐", async () => {
    useLabStore.getState().initSession("exp-remove");
    await Promise.resolve();
    useLabStore.getState().addReagent(S("盐酸"));
    vi.mocked(appendStepRemote).mockClear();

    useLabStore.getState().removeReagent("HCl");

    expect(appendStepRemote).toHaveBeenCalledTimes(1);
    const [, step] = vi.mocked(appendStepRemote).mock.calls[0];
    expect(step.action).toBe("remove");
    expect(step.detail).toMatchObject({ formula: "HCl" });
    expect(typeof step.detail?.name).toBe("string");
    expect(useLabStore.getState().contents).toEqual([]);
  });

  it("移除容器里不存在的试剂不上报、不改状态", async () => {
    useLabStore.getState().initSession("exp-remove-noop");
    await Promise.resolve();
    useLabStore.getState().addReagent(S("盐酸"));
    useLabStore.getState().mix();
    const before = useLabStore.getState();
    vi.mocked(appendStepRemote).mockClear();

    useLabStore.getState().removeReagent("NaOH");

    expect(appendStepRemote).not.toHaveBeenCalled();
    // 未命中时连 result 都不该被清掉（清了等于凭空丢掉已算出的现象）
    expect(useLabStore.getState().result).toBe(before.result);
    expect(useLabStore.getState().contents).toEqual(before.contents);
  });

  it("讲解重放静默期的移除不写进会话", async () => {
    useLabStore.getState().initSession("exp-remove-silent");
    await Promise.resolve();
    useLabStore.getState().addReagent(S("盐酸"));
    useLabStore.getState().setSilent(true);
    vi.mocked(appendStepRemote).mockClear();

    useLabStore.getState().removeReagent("HCl");

    expect(appendStepRemote).not.toHaveBeenCalled();
    expect(useLabStore.getState().contents).toEqual([]);
  });
});

describe("pH 读数按容器内容物估算", () => {
  // 原先 readings.ph 是常量 7，加什么试剂都不动：往烧杯倒稀盐酸，面板照样 7.0。
  // 501 个实验里 257 个混合前就偏离中性 2 个 pH 以上。3D 的 pH 计走 estimatePh，
  // 两个视图口径不一致，学生无从判断哪个是真的。
  it("加入强酸后读数立刻显酸性，不再停在 7.0", () => {
    useLabStore.getState().addReagent(S("盐酸"));
    expect(useLabStore.getState().readings.ph).toBeLessThan(3);
  });

  it("加入强碱后读数立刻显碱性", () => {
    useLabStore.getState().addReagent(S("氢氧化钠"));
    expect(useLabStore.getState().readings.ph).toBeGreaterThan(11);
  });
  it("移除试剂后 pH 退回，不停在移除前的读数", () => {
    useLabStore.getState().addReagent(S("盐酸"));
    expect(useLabStore.getState().readings.ph).toBeLessThan(3);
    useLabStore.getState().removeReagent("HCl");
    expect(useLabStore.getState().readings.ph).toBeCloseTo(7, 1);
  });

  it("反应后的趋势偏移以反应前的估算值为基准，不是以 7 为基准", () => {
    // 稀盐酸(约1.2) + 锌粒：酸被消耗 phTrend=increase。
    // 以 7 为基准会跳到 10 —— 把一杯酸液报成强碱，与「石蕊变红」自相矛盾。
    useLabStore.getState().addReagent(S("盐酸"));
    useLabStore.getState().addReagent(S("锌"));
    useLabStore.getState().mix();
    const ph = useLabStore.getState().readings.ph;
    expect(ph).toBeGreaterThan(1.2); // 确实往上走了
    expect(ph).toBeLessThan(7); // 但没越过中性变成碱
  });

  it("混合未发生反应时读数仍按内容物给，而不是保持中性", () => {
    // 反应不发生 ≠ 杯里是中性水
    useLabStore.getState().addReagent(S("盐酸"));
    useLabStore.getState().addReagent(S("氯化钠"));
    useLabStore.getState().mix();
    expect(useLabStore.getState().readings.ph).toBeLessThan(3);
  });

  it("上报的测量点用的是同一个 pH，不会与面板显示脱节", async () => {
    useLabStore.getState().initSession("exp-ph-report");
    await Promise.resolve();
    useLabStore.getState().addReagent(S("盐酸"));
    useLabStore.getState().addReagent(S("锌"));
    vi.mocked(appendMeasurementRemote).mockClear();
    useLabStore.getState().mix();
    const reported = vi.mocked(appendMeasurementRemote).mock.calls.at(-1)?.[1].ph;
    expect(reported).toBe(useLabStore.getState().readings.ph);
  });
});

describe("定量取用", () => {
  it("不传用量时按规格默认值（溶液 10 mL / 固体 2 g）", () => {
    useLabStore.getState().addReagent(S("盐酸"));
    useLabStore.getState().addReagent(S("锌粒"));
    const [hcl, zn] = useLabStore.getState().contents;
    expect({ dose: hcl.dose, unit: hcl.spec.unit }).toEqual({ dose: 10, unit: "mL" });
    expect({ dose: zn.dose, unit: zn.spec.unit }).toEqual({ dose: 2, unit: "g" });
  });

  it("同一试剂重复取用是累加，不是被忽略", () => {
    // 真实实验里"再加 5 mL"是常规操作；原先第二次调用整个被丢掉，
    // 容器里永远只有第一次那份量，定量实验无从进行。
    useLabStore.getState().addReagent(S("盐酸"), 20);
    useLabStore.getState().addReagent(S("盐酸"), 5);
    const c = useLabStore.getState().contents;
    expect(c).toHaveLength(1);
    expect(c[0].dose).toBe(25);
  });

  it("物质的量按浓度与体积算出，并传给引擎判断过量", () => {
    // 25 mL × 1.0 mol/L = 0.025 mol
    useLabStore.getState().addReagent(S("盐酸"), 25);
    expect(useLabStore.getState().contents[0].amount).toBeCloseTo(0.025, 6);
  });

  it("指示剂没有物质的量，amount 保持未定义而不是 0", () => {
    // 0 会被引擎当成"加了但一点没有"，报告里也会出现"酚酞 0 mol"这种数据
    useLabStore.getState().addReagent(S("酚酞"));
    expect(useLabStore.getState().contents[0].amount).toBeUndefined();
  });

  it("会话记录里带上用量与规格", async () => {
    useLabStore.getState().initSession("exp-dose");
    await Promise.resolve();
    vi.mocked(appendStepRemote).mockClear();
    useLabStore.getState().addReagent(S("氢氧化钠"), 25);
    const detail = vi.mocked(appendStepRemote).mock.calls.at(-1)?.[1].detail;
    expect(detail).toMatchObject({
      formula: "NaOH",
      用量: "25 mL",
      规格: "1 mol/L",
      物质的量: "0.0250 mol",
    });
  });

  it("液体总体积只计溶液与纯液体，固体不计", () => {
    useLabStore.getState().addReagent(S("盐酸"), 30);
    useLabStore.getState().addReagent(S("乙醇"), 10);
    useLabStore.getState().addReagent(S("锌粒"), 5);
    expect(totalVolume(useLabStore.getState().contents)).toBe(40);
  });
});

describe("过程曲线采样", () => {
  it("每次取用 / 调温 / 混合都留一个采样点，并带操作标记", () => {
    const s = useLabStore.getState;
    s().addReagent(S("盐酸"), 25);
    s().addReagent(S("氢氧化钠"), 25);
    s().mix();
    const marks = s().trace.map((p) => p.mark);
    expect(marks).toEqual(["加盐酸", "加氢氧化钠", "混合"]);
  });

  it("采样点记录容器液体总体积，随取用增长", () => {
    useLabStore.getState().addReagent(S("盐酸"), 25);
    useLabStore.getState().addReagent(S("蒸馏水"), 15);
    expect(useLabStore.getState().trace.map((p) => p.volume)).toEqual([25, 40]);
  });

  it("温度相同时不重复采样，避免滑杆停在同一格刷出一串点", () => {
    useLabStore.getState().setTemperature(60);
    const n = useLabStore.getState().trace.length;
    useLabStore.getState().setTemperature(60);
    useLabStore.getState().setTemperature(60);
    expect(useLabStore.getState().trace.length).toBe(n);
  });

  it("静默期（讲解重放）不采样，学生自己的过程不被假点淹没", () => {
    useLabStore.getState().setSilent(true);
    useLabStore.getState().addReagent(S("盐酸"));
    useLabStore.getState().setTemperature(80);
    useLabStore.getState().mix();
    expect(useLabStore.getState().trace).toEqual([]);
  });

  it("换实验与清空重做都归零曲线", async () => {
    useLabStore.getState().addReagent(S("盐酸"));
    expect(useLabStore.getState().trace.length).toBeGreaterThan(0);
    useLabStore.getState().reset();
    expect(useLabStore.getState().trace).toEqual([]);

    useLabStore.getState().addReagent(S("盐酸"));
    useLabStore.getState().initSession("exp-trace-switch");
    await Promise.resolve();
    expect(useLabStore.getState().trace).toEqual([]);
    expect(useLabStore.getState().startedAt).toBeNull();
  });

  it("record 在未登录（无会话）时也采样，专用实验台的曲线不能依赖登录", () => {
    // sessionId 为 null 时原先直接 return，滴定台这类专用面板的读数一个都留不下
    expect(useLabStore.getState().sessionId).toBeNull();
    useLabStore.getState().record("加半滴", undefined, { ph: 8.4, temperature: 25 });
    expect(useLabStore.getState().trace).toMatchObject([
      { ph: 8.4, temperature: 25, mark: "加半滴" },
    ]);
  });

  it("采样点数有上限，长过程只保留近期，避免折线画上千个点", () => {
    for (let i = 0; i < 300; i += 1) {
      useLabStore.getState().setTemperature(20 + (i % 60));
    }
    expect(useLabStore.getState().trace.length).toBeLessThanOrEqual(240);
  });
});
