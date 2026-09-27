// 实验操作原语：按实验配备的仪器决定「这张实验台能做哪些动作」。
//
// 为什么要有这一层：原先 501 个实验的操作只有「加试剂 → 混合 → 完成」三步，
// 而仪器清单（试管 256 次、玻璃棒 84 次、酒精灯 74 次…）只是画在旁边的灰色标签。
// 真实实验的步骤感来自动作序列：取液 → 振荡 → 加热 → 静置 → 读数。
// 这里只做各实验共有的通用动作 —— 仪器在场则动作可用，不为单个实验写特例。
//
// 纯函数、无状态：可用性判定与效果描述在此，实际改 store 由组件执行，
// 这样同一份判定 2D / 3D / 讲解层都能复用。

export type OperationId =
  | "stir" // 搅拌（玻璃棒）
  | "shake" // 振荡摇匀（试管 / 锥形瓶）
  | "heat" // 加热（酒精灯 / 水浴 / 电炉）
  | "cool" // 冷却（撤火 / 冷水浴）
  | "settle" // 静置（沉降分层）
  | "read"; // 读数（温度计 / pH 计）

export interface Operation {
  id: OperationId;
  label: string;
  /** 按钮上的符号（不依赖字体图标） */
  glyph: string;
  /** 操作后写入实验记录的现象描述 */
  effect: string;
  /** 对体系温度的影响（℃），0 表示不改温度 */
  deltaT: number;
  /** 鼠标悬停解释：为什么真实实验里要做这一步 */
  hint: string;
}

/** 关键词 → 操作。同一操作由多种仪器触发时取并集 */
const RULES: { id: OperationId; match: RegExp }[] = [
  { id: "stir", match: /玻璃棒|搅拌棒|搅拌器|药匙/ },
  { id: "shake", match: /试管|锥形瓶|碘瓶|分液漏斗|容量瓶/ },
  // 火柴与木条也算热源：氢气/甲烷/一氧化碳在导管口点燃靠的是火柴，
  // 不是酒精灯或燃烧匙。漏掉它们，这几个实验的界面上只剩"静置""读数"，
  // 而引擎又要求 heated —— 学生无论怎么点都点不着
  { id: "heat", match: /酒精灯|水浴|电炉|石棉网|坩埚|蒸发皿|加热|电热|燃烧匙|喷灯|火柴|燃着的木条/ },
  { id: "read", match: /温度计|pH|酸度计|比色|电流表|电压表|天平|量筒|滴定管|移液管/ },
];
// settle 与 read 不进 RULES：它们不依赖任何仪器。
// 「静置观察」和「记录读数」是所有实验共有的动作 —— 沉淀要时间沉降、
// 分层要时间分开、现象要时间显现，而这些不需要配备秒表才能做。

/**
 * 加热一次升多少度：酒精灯直接加热升温快，水浴受水温限制升得慢且更平稳 ——
 * 这个差别是水浴存在的理由（受热均匀、不超过 100 ℃），照同一个步长走就没意义了。
 */
function heatStep(apparatus: string[]): number {
  const all = apparatus.join(" ");
  if (/水浴/.test(all)) return 8;
  if (/坩埚|喷灯|马弗炉/.test(all)) return 25;
  return 15;
}

const BASE: Record<OperationId, Omit<Operation, "deltaT">> = {
  stir: {
    id: "stir",
    label: "搅拌",
    glyph: "🥄",
    effect: "用玻璃棒搅拌，溶质加速溶解、混合更均匀",
    hint: "搅拌加快溶解与传热，也让局部浓度趋于一致，读数才代表整体",
  },
  shake: {
    id: "shake",
    label: "振荡",
    glyph: "🤝",
    effect: "振荡摇匀，试剂充分接触",
    hint: "试管内液体少，靠振荡（不是搅拌）混匀，手持管口朝无人处",
  },
  heat: {
    id: "heat",
    label: "加热",
    glyph: "🔥",
    effect: "点燃酒精灯加热，体系温度上升",
    hint: "多数反应升温加快；吸热反应必须持续加热才能进行",
  },
  cool: {
    id: "cool",
    label: "冷却",
    glyph: "❄️",
    effect: "撤去热源自然冷却，温度回落",
    hint: "冷却让溶解度下降，是结晶析出与产物收集的常规步骤",
  },
  settle: {
    id: "settle",
    label: "静置",
    glyph: "⏳",
    effect: "静置片刻，沉淀沉降、液体分层更清晰",
    hint: "沉淀与分层需要时间；静置后才能判断上层清液是否澄清",
  },
  read: {
    id: "read",
    label: "读数",
    glyph: "📋",
    effect: "记录当前读数",
    hint: "视线与刻度平齐读数；把每次读数记进数据表才能算平均值与误差",
  },
};

/** 按仪器清单给出这张实验台可用的操作，顺序固定（与真实操作先后一致） */
export function availableOperations(apparatus: string[]): Operation[] {
  const all = apparatus.join(" ");
  const ids = new Set<OperationId>();
  for (const r of RULES) if (r.match.test(all)) ids.add(r.id);
  // 静置与读数总是可用：观察、等待、记录不依赖仪器（见 RULES 处的说明）
  ids.add("settle");
  ids.add("read");
  // 有加热手段就一定有撤火冷却这一步，不必单独配"冷水浴"才给
  if (ids.has("heat")) ids.add("cool");
  const step = heatStep(apparatus);
  const order: OperationId[] = ["stir", "shake", "heat", "cool", "settle", "read"];
  return order
    .filter((id) => ids.has(id))
    .map((id) => ({
      ...BASE[id],
      deltaT: id === "heat" ? step : id === "cool" ? -step : 0,
    }));
}
