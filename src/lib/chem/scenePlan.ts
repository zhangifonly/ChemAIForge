// 3D 场景方案推导（纯函数，无 three 依赖，可单测）。
// 输入：容器内物质 + 反应引擎结果 + 实验仪器；输出：通用 3D 场景该渲染哪些现象。
// 这是"数据驱动 3D"的核心——新实验只要数据正确，无需手写场景即可获得 3D 表现。
import type { ReactionResult, Substance } from "./engine";
import {
  estimatePh,
  extractedColor,
  findColoredGas,
  findCrystal,
  findOrganicPhase,
  isGasAbsorbed,
  isSelfCooling,
  isTurbid,
} from "./phasePlan";
import { resolveProductTint } from "./productTint";
import {
  CLEAR_TINT,
  GAS_COLOR,
  PRECIPITATE_COLOR,
  gasColor,
  indicatorTint,
  mixedTint,
  precipitateColor,
  type SolutionTint,
} from "./appearance";

/** 容器造型 */
export type VesselKind = "beaker" | "flask" | "tube";

/** 一个 3D 场景需要呈现的全部要素 */
export interface ScenePlan {
  vessel: VesselKind;
  /** 液体颜色（反应前后分别取，反应后由产物决定） */
  liquid: SolutionTint | null;
  /** 冒气泡：产气反应 */
  bubbles: { color: string } | null;
  /** 沉淀：颜色由产物化学式决定 */
  precipitate: { color: string } | null;
  /** 火焰 / 强光：放热且有可燃固体参与 */
  flame: boolean;
  /** 加热蒸汽：吸热反应需外部加热 */
  heating: boolean;
  /**
   * 金属固体（片 / 粒）在液中。
   *
   * dissolving 表示这块难溶固体正被反应消耗：氢氧化铝溶于强碱、氢氧化铜溶于氨水
   * 这类实验既不产气也不产沉淀，「白色沉淀逐渐溶解至澄清」本身就是唯一的观察量，
   * 固体若一直原样摆在杯底，3D 便把这个看点抹掉了。
   */
  solid: { formula: string; dissolving: boolean } | null;
  /** 装置：由仪器清单推导，与化学反应无关，决定器皿外的硬件 */
  rig: RigPlan;
  /** 有机相分层：与水互不相溶时在液面上/下形成独立一层 */
  phase: { side: "top" | "bottom"; color: string; label: string } | null;
  /** 乳浊：液体由澄清变浑浊（苯酚析出、盐析、石灰水变浊） */
  turbid: boolean;
  /** 晶体析出：热饱和溶液冷却 / 重结晶 */
  crystal: { formula: string; color: string; label: string } | null;
  /**
   * 温度显著变化的方向。溶解热 / 稀释放热这类实验的唯一观察量就是温度计读数，
   * 3D 层据此让温度计柱明显升降并给容器一层冷凝水雾 / 热雾。
   */
  tempShift: "up" | "down" | null;
}

/**
 * 实验装置类型。很多实验（电解 / 量热 / 焰色 / 过滤 / 蒸馏）的"看点"在装置本身，
 * 引擎判不出反应也该有 3D 表现，所以这一层只看仪器清单。
 */
export type RigKind =
  | "none"
  | "electrolysis" // 电解 / 电镀：两根电极插入电解液，通电两极产气
  | "cell" // 原电池 / 燃料电池：两电极 + 盐桥 + 电压表
  | "calorimeter" // 量热计 / 保温杯：测温，读数随热效应变化
  | "water-bath" // 水浴加热
  | "flame-test" // 焰色反应：铂丝蘸样灼烧
  | "filtration" // 过滤：铁架台 + 漏斗 + 滤纸
  | "distillation" // 蒸馏：蒸馏烧瓶 + 冷凝管
  | "gas-collect" // 排水/排空气集气：导管通入集气瓶
  | "titration" // 滴定：滴定管架在铁架台上，向锥形瓶滴加
  | "syringe" // 注射器：压缩 / 拉伸改变压强，观察有色气体平衡移动
  | "ph-meter" // pH 计：探头插入液中，屏幕显示读数（缓冲液 / 中和曲线）
  | "evaporation" // 蒸发结晶：蒸发皿 + 酒精灯，水分蒸干析出晶体
  | "pressure-drop"; // 气体被吸收致内压下降：软塑料瓶变瘪 / 喷泉 / 液面倒吸

export interface RigPlan {
  kind: RigKind;
  /** 是否显示温度计（量热 / 水浴 / 蒸馏都要读温度） */
  thermometer: boolean;
  /** 是否显示铁架台 */
  stand: boolean;
  /** 电极材质（左 / 右），仅 electrolysis / cell 有意义 */
  electrodes: [string, string];
  /** 装置是否处于"工作中"（通电 / 蒸馏中 / 正在过滤） */
  active: boolean;
  /** 焰色样品（仅 flame-test）：容器内首个含焰色金属的试剂 */
  flameSample: string | null;
  /** 温度读数（℃），供温度计显示 */
  temperature: number;
  /** 注射器内的有色气体（仅 syringe）：压缩活塞时颜色随浓度加深 */
  gasColor: string | null;
  /** pH 读数（仅 ph-meter / 滴定时显示） */
  ph: number;
}

/** 电极材质：按仪器里出现的金属名推断，两极可不同（原电池 / 电镀） */
export function inferElectrodePair(apparatus: string[]): [string, string] {
  const all = apparatus.join(" ");
  if (all.includes("锌") && all.includes("铜")) return ["zinc", "copper"];
  if (all.includes("银") && all.includes("铁")) return ["iron", "silver"];
  if (all.includes("铁") && (all.includes("碳") || all.includes("石墨"))) return ["iron", "carbon"];
  if (all.includes("铂")) return ["platinum", "platinum"];
  if (all.includes("银")) return ["silver", "silver"];
  if (all.includes("铜")) return ["copper", "copper"];
  return ["carbon", "carbon"];
}

/** 按仪器清单推导装置骨架（不含随操作变化的 active / 温度 / 焰色样品） */
export function planRig(apparatus: string[]): RigPlan {
  const all = apparatus.join(" ");
  const has = (...ks: string[]) => ks.some((k) => all.includes(k));
  const thermometer = has("温度计");
  const stand = has("铁架台", "试管架", "铁圈");

  let kind: RigKind = "none";
  // 注射器排最前：它自带密闭容器，一旦出现整个场景就是"针筒里的气体"，与其他装置互斥
  if (has("注射器")) kind = "syringe";
  else if (has("滴定管")) kind = "titration";
  else if (has("铂丝") && has("酒精灯")) kind = "flame-test";
  else if (has("冷凝管", "蒸馏烧瓶")) kind = "distillation";
  else if (has("直流电源", "电解槽", "电镀")) kind = "electrolysis";
  // 电流计 / 检流计 / 导线同属原电池器材：牺牲阳极保护、铁碳微电池、金属活动性比较
  // 这几个实验的看点全在"指针偏转"上，漏掉关键词会让它们在 3D 里彻底没有装置
  else if (
    has("盐桥", "电压表", "发光二极管", "小灯泡", "导电装置", "电流计", "检流计", "导线")
  )
    kind = "cell";
  else if (has("量热计", "保温杯", "密封袋")) kind = "calorimeter";
  else if (has("水浴")) kind = "water-bath";
  else if (has("滤纸") && has("漏斗")) kind = "filtration";
  else if (has("集气瓶", "洗气瓶", "广口瓶")) kind = "gas-collect";
  // 蒸发结晶要有热源，只有蒸发皿（无酒精灯）时按普通容器处理
  else if (has("蒸发皿") && has("酒精灯", "电热套")) kind = "evaporation";
  // pH 计放最后：它常与其他装置共存（滴定时也用 pH 计），只有别无装置时才主导画面
  else if (has("pH 计", "pH计", "pH 传感器")) kind = "ph-meter";

  return {
    kind,
    thermometer,
    stand,
    electrodes: inferElectrodePair(apparatus),
    active: false,
    flameSample: null,
    temperature: 25,
    gasColor: null,
    ph: 7,
  };
}

/** 焰色样品：容器内首个含焰色金属的试剂（优先化学式，回退中文名） */
export function pickFlameSample(contents: Substance[]): string | null {
  const re = /Na|K|Ca|Cu|Sr|Ba|Li|钠|钾|钙|铜|锶|钡|锂/;
  const hit = contents.find((c) => re.test(c.formula) || re.test(c.name));
  return hit ? hit.formula || hit.name : null;
}

/**
 * 按仪器选容器：优先试管，其次锥形瓶，默认烧杯。
 * 电解 / 原电池 / 量热类装置即使器材里提到试管，也需要宽口容器放电极或搅拌，
 * 故这些装置一律用烧杯。
 */
export function chooseVessel(apparatus: string[], rig: RigKind = "none"): VesselKind {
  if (rig === "electrolysis" || rig === "cell" || rig === "calorimeter") return "beaker";
  // 滴定一律锥形瓶：便于摇动且瓶口窄不易溅出，这是滴定的标准接收容器
  if (rig === "titration") return "flask";
  // 注射器 / 焰色装置自带容器，不画常规器皿（3D 层会整体接管场景），这里给个稳定占位值
  if (rig === "syringe" || rig === "flame-test") return "tube";
  // 蒸发结晶用浅口敞开容器，烧杯最接近蒸发皿的观感
  if (rig === "evaporation") return "beaker";
  const all = apparatus.join(" ");
  if (all.includes("试管")) return "tube";
  // 圆底 / 蒸馏烧瓶同样是有颈的瓶，画成锥形瓶远比画成敞口烧杯接近实物 ——
  // 制取 SO₂、氯气、HCl 等八个实验都用圆底烧瓶，原先漏了这个词全落到烧杯
  if (all.includes("锥形瓶") || all.includes("碘瓶") || all.includes("烧瓶")) return "flask";
  return "beaker";
}

/** 燃烧类实验的可燃固体：这些参与放热反应时应出现火焰而非气泡 */
const COMBUSTIBLE = new Set([
  "Mg", "Fe", "S", "C", "P", "Na", "K", "Al", "Cu", "Zn",
  // 可燃气体与液体燃料同样有火焰：甲烷的淡蓝色、一氧化碳的蓝色、氢气的淡蓝色
  "CH4", "CO", "H2", "C2H5OH", "C2H4", "C2H2",
]);

/**
 * 支持燃烧的气体。只有可燃物遇到助燃气体才是燃烧——「铁片放进硫酸铜溶液」
 * 同样是放热的金属反应，但它在溶液里安静置换，画火焰是错的。
 */
const OXIDIZING_GAS = new Set(["O2", "Cl2", "air"]);

/**
 * 以固体形态投入容器的物质。金属单质、氧化物、碳酸盐都是粉末或块状，
 * 在 3D 里应当看到沉在器皿底的固体堆——只画液体的话"铁丝插入硫酸铜"就成了一杯蓝水。
 * 可溶盐（category 为 salt）默认按溶液处理，不画固体。
 */
const SOLID_CATEGORIES = new Set<Substance["category"]>(["metal", "oxide", "carbonate"]);

/**
 * 难溶物投入时按固体处理：PRECIPITATE_COLOR 就是全项目的难溶物权威表
 * （既登记颜色、也等价于"这东西不溶于水"），故直接查它，不再手工维护白名单。
 *
 * 原先只列了 5 个难溶碱，于是「氯化银 / 碳酸银 / 溴化银 / 碘化银 / 氢氧化锌 /
 * 氢氧化镍 / 硫化亚铁 / 硫化银」这些难溶盐投进去后 solid 恒为 null ——
 * 而这十来个实验（卤化银溶于氨水、硫化银电解还原、氢氧化锌两性…）的全部看点
 * 正是「固体逐渐溶解消失」，没有固体就等于对着一杯清水看不见的变化。
 *
 * acid / organic 类不纳入：苯甲酸、水杨酸虽微溶，但实验里多按溶液或乳浊处理，
 * 乳浊由 phasePlan 负责，这里画固体会与之重复。
 */
const NON_SOLID_CATEGORIES = new Set<Substance["category"]>(["acid", "organic"]);

function isInsolubleSolid(s: Substance): boolean {
  return s.formula in PRECIPITATE_COLOR && !NON_SOLID_CATEGORIES.has(s.category);
}

/**
 * Ca(OH)₂ 不在难溶物表里（它微溶，实验用澄清石灰水），故上面的查表不会把它当固体。
 * 但「石灰乳 / 熟石灰 / 生石灰」是过量固体的形态，只能靠名称区分。
 */
const SOLID_BY_NAME = ["石灰乳", "熟石灰", "生石灰"];

/**
 * 只可能以固体粉末 / 块状出现、但 category 落在 SOLID_CATEGORIES 之外的物质。
 * 都不溶于水（appearance 里也没有溶液色），不存在"可能是溶液"的两可：
 *  · MnO2 二氧化锰 —— 黑色粉末，作催化剂或与浓盐酸制氯气，category 记成了 oxidizer
 *  · C 木炭 / P 红磷 —— 燃烧实验里的固体单质，category 只能记成 other
 */
const ALWAYS_SOLID = new Set(["MnO2", "C", "P"]);

/**
 * 既可作溶液、又可作固体的物质：单独投入时才是固体（没有溶剂就谈不上溶液）。
 * 高锰酸钾在十几个实验里是紫红色溶液作氧化剂，唯独「加热高锰酸钾制氧气」
 * 里是单独投入的紫黑色晶体粉末。
 */
const SOLO_SOLID = new Set(["KMnO4"]);

function isSolid(c: Substance): boolean {
  return (
    SOLID_CATEGORIES.has(c.category) ||
    ALWAYS_SOLID.has(c.formula) ||
    isInsolubleSolid(c) ||
    SOLID_BY_NAME.some((k) => c.name.includes(k))
  );
}

/** 容器内的固相物质：取第一个（同时投多种固体时以先投的为主体） */
export function pickSolid(contents: Substance[]): Substance | null {
  const solid = contents.find(isSolid);
  if (solid) return solid;
  if (contents.length === 1 && SOLO_SOLID.has(contents[0].formula)) return contents[0];
  return null;
}

/**
 * 补充产气推断：引擎按"命中第一条规则"返回单一结果，容器里同时存在多组反应物时
 * 会漏掉其中一路现象。例如碳酸钠 + 盐酸 + 澄清石灰水，引擎命中「CO₂ 使石灰水变浑浊」
 * 报沉淀，但碳酸盐与酸产气这一路照样在冒泡——只报沉淀会让 3D 看起来不产气。
 * 这里只做"确定会产气"的保守补充：碳酸盐/活泼金属遇酸。
 */
export function inferGasFormula(contents: Substance[]): string | null {
  const hasAcid = contents.some((s) => s.category === "acid");
  if (!hasAcid) return null;
  if (contents.some((s) => s.category === "carbonate")) return "CO2";
  if (contents.some((s) => s.category === "metal")) return "H2";
  return null;
}

/**
 * 是否为常温气体。只看 category 不够：CO₂ / SO₂ 既是氧化物又是气体，
 * 燃烧规则按化学本质把它们标成 oxide，于是六个燃烧实验（碳、硫、甲烷、乙醇、CO
 * 在氧气中燃烧）在 3D 里一个气泡都不冒。GAS_COLOR 的键就是常温气体清单，
 * 用它兜底可一并挡住将来任何同类的 category 标注分歧。
 */
function isGaseous(s: Substance): boolean {
  return s.category === "gas" || s.formula in GAS_COLOR;
}

/** 从产物中挑出沉淀（category 为 salt/base 且引擎判定产沉淀时，取第一个非水非气产物） */
export function pickPrecipitate(products: Substance[]): string | null {
  const p = products.find(
    (s) => !isGaseous(s) && s.category !== "water" && !s.formula.includes("-"),
  );
  return p ? p.formula : null;
}

/** 从产物中挑出气体 */
export function pickGas(products: Substance[]): string | null {
  const g = products.find(isGaseous);
  return g ? g.formula : null;
}

/** 酸碱环境 */
export type AcidBaseEnv = "acid" | "neutral" | "base";

/**
 * 判断容器内的酸碱环境：指示剂变色只取决于此，不取决于是否"发生反应"。
 * 同时有酸和碱时以引擎的 pH 趋势为准（中和后偏哪边），无趋势则按中性。
 */
export function acidBaseEnv(contents: Substance[], result: ReactionResult | null): AcidBaseEnv {
  // 盐类水解：投料里一个酸一个碱都没有（碳酸钠 category 是 carbonate、
  // 氯化铵是 salt），酸碱性由水解产生 —— 只看投料 category 会判成中性，
  // 于是「纯碱使酚酞变红」这类实验在 3D 里看不到任何变化。
  // 引擎已在产物里给出 OH⁻ / H⁺ 并标了 phTrend，直接采信即可。
  if (result?.reacted && result.products.some((p) => p.formula === "OH-" || p.formula === "H+")) {
    if (result.phTrend === "increase") return "base";
    if (result.phTrend === "decrease") return "acid";
  }
  const hasAcid = contents.some((s) => s.category === "acid");
  const hasBase = contents.some((s) => s.category === "base");
  if (hasAcid && hasBase) {
    if (result?.phTrend === "increase") return "base";
    if (result?.phTrend === "decrease") return "acid";
    return "neutral";
  }
  if (hasAcid) return "acid";
  if (hasBase) return "base";
  return "neutral";
}

/** 容器内的指示剂化学式（酚酞 / 石蕊 / 甲基橙 / pH 试纸） */
export function findIndicator(contents: Substance[]): string | null {
  const i = contents.find((s) => s.category === "indicator");
  return i ? i.formula : null;
}

export interface PlanInput {
  contents: Substance[];
  result: ReactionResult | null;
  apparatus: string[];
  /** 是否处于加热状态（外部热源） */
  heated?: boolean;
  /** 装置是否已启动（通电 / 开始蒸馏 / 开始过滤），由界面开关传入 */
  rigActive?: boolean;
  /** 当前温度读数（℃） */
  temperature?: number;
}

/** 推导 3D 场景方案 */
export function planScene({
  contents,
  result,
  apparatus,
  heated = false,
  rigActive = false,
  temperature = 25,
}: PlanInput): ScenePlan {
  const rig = planRig(apparatus);
  rig.active = rigActive;
  rig.temperature = temperature;
  if (rig.kind === "flame-test") rig.flameSample = pickFlameSample(contents);
  if (rig.kind === "syringe") rig.gasColor = findColoredGas(contents)?.color ?? null;
  rig.ph = estimatePh(contents);
  // 气体被溶液吸收致内压下降（CO₂ + NaOH、NH₃ 溶于水）：仪器清单看不出来，
  // 必须结合化学——反应物含气体且被消耗掉，才是"瓶内变瘪 / 喷泉"这一路看点
  if (rig.kind === "none" && isGasAbsorbed(contents, result ?? null)) rig.kind = "pressure-drop";
  const vessel = chooseVessel(apparatus, rig.kind);
  const hasAny = contents.length > 0;
  const reacted = Boolean(result?.reacted);

  // 液色优先级：指示剂 > 反应产物 > 投入的溶质。
  // 指示剂放最前是因为它本就是"用颜色报告环境"的试剂，一旦在场，
  // 观察者看到的就是指示剂的颜色，而不是底液（稀酸碱多为无色）的颜色。
  const indicator = findIndicator(contents);
  const env = acidBaseEnv(contents, result);
  const indTint = indicator ? indicatorTint(indicator, env) : null;

  // 产物液色：引擎的通用规则常返回占位化学式（"salt" / "X2" / "Zn-salt"），
  // 查不到色表就会让"氧化铜溶于硫酸变蓝"这类实验毫无变化，故按反应物反推
  const productTint =
    reacted && result?.colorChange ? resolveProductTint(result.products, contents) : null;

  const tintSource = reacted && result ? result.products.map((p) => p.formula) : [];
  const base = hasAny
    ? tintSource.length > 0
      ? mixedTint([...tintSource, ...contents.map((c) => c.formula)])
      : mixedTint(contents.map((c) => c.formula))
    : null;
  // 反应后的产物色优先于反应前的底液色（底液已被消耗）
  const mixed = productTint ?? base;
  // 指示剂色只在底液本身无特征色时覆盖：往高锰酸钾里滴石蕊，看到的仍是紫色
  const liquid = indTint && mixed === CLEAR_TINT ? indTint : mixed;

  // 产气：优先取引擎产物中的气体；引擎因单规则匹配漏报时，用保守补充推断兜底
  const gasF = reacted
    ? (result?.producesGas ? pickGas(result.products) : null) ?? inferGasFormula(contents)
    : null;
  // 规则显式指定的沉淀物优先：「先沉淀后溶解」时沉淀物不在产物列表里
  const precF = reacted && result?.producesPrecipitate
    ? (result.precipitateFormula ?? pickPrecipitate(result.products))
    : null;

  // 火焰：可燃物 + 助燃气体 + 放热。三者缺一不可——单看"放热且有可燃固体"
  // 会把铁置换铜、原电池这类溶液里的安静反应也画成一团火。
  const combustible = contents.some((c) => COMBUSTIBLE.has(c.formula));
  const oxidizingGas = contents.some((c) => OXIDIZING_GAS.has(c.formula));
  // 水相中的氧化是缓慢氧化（暖宝宝里的铁粉、钢铁生锈），只发热不起火
  const aqueous = contents.some((c) => c.category === "water");
  const solid = pickSolid(contents);
  // 固体正在溶解：仅限「难溶物」（登记在沉淀色表里的）且产物列表里已不含它。
  // 限定难溶物是为了避开金属置换 —— 铁片放入硫酸铜，铁片本就该留在杯底，
  // 表面镀上铜才是那类实验的看点；引擎不建模用量，不能把它当作被消耗掉。
  const solidDissolving =
    reacted &&
    solid !== null &&
    solid.formula in PRECIPITATE_COLOR &&
    !(result?.products ?? []).some((p) => p.formula === solid.formula);
  // 燃烧产物是气体也照样有火焰（硫在氧气中燃烧生成 SO₂ 仍是蓝紫色火焰），
  // 故这里不能用「不产气」当条件，助燃气体在场才是燃烧的判据
  // 催化氧化不是燃烧：产物里留着有机物就说明碳链没被烧断（乙醇在灼热铜丝上
  // 只变成乙醛，铜丝黑红交替而无火焰）。燃烧的产物必然全是氧化物，
  // 故"产物含有机相"是排除火焰的可靠判据
  const organicProduct = reacted
    ? Boolean(result?.products.some((p) => p.category === "organic"))
    : false;
  const flame =
    reacted &&
    result?.thermal === "exothermic" &&
    combustible &&
    oxidizingGas &&
    !aqueous &&
    !organicProduct;

  // 有机相分层：酯 / 苯 / CCl₄ 与水互不相溶。有机相被萃取的卤素染色（碘的 CCl₄ 层紫红）。
  // 反应把有机相消耗掉（酯完全水解）时不再分层，故仅在未反应或可逆反应时保留。
  // 产物里的有机相同样要分层：酯化生成的酯不溶于水，在液面形成油状层，
  // 这是酯化实验唯一的可见证据，只看反应物会漏掉它
  const phaseSpec =
    findOrganicPhase(contents) ?? (reacted && result ? findOrganicPhase(result.products) : null);
  // 萃取时有机相被卤素染色（碘的四氯化碳层紫红），反应生成的卤素也算
  const extractSource = reacted && result ? [...contents, ...result.products] : contents;
  const phase = phaseSpec
    ? {
        side: phaseSpec.side,
        color: extractedColor(extractSource, phaseSpec.color),
        label: phaseSpec.label,
      }
    : null;

  // 晶体析出：蒸发结晶 / 重结晶（降温）时才出现，单纯配溶液不该长晶体
  const crystallizing = rig.kind === "evaporation" ? rig.active : temperature < 25;
  const crystal = crystallizing ? findCrystal(contents) : null;

  // 通电的电解装置一定两极产气，与引擎是否识别出反应无关（电解是电驱动而非试剂互撞）
  const electrolyzing = rig.kind === "electrolysis" && rig.active && Boolean(liquid);
  const bubbleColor = gasF ? gasColor(gasF) : electrolyzing ? gasColor("H2") : null;

  return {
    vessel,
    liquid,
    bubbles: bubbleColor ? { color: bubbleColor } : null,
    precipitate: precF ? { color: precipitateColor(precF) } : null,
    flame,
    // 水浴装置自带酒精灯，启动即视为加热；焰色装置的火焰由 FlameTestRig 自己画。
    // 吸热反应需外部供热 → 画酒精灯；但"溶解吸热"是体系自己变冷（简易冰袋），
    // 加热源反而给出相反的暗示，故排除掉。
    heating:
      heated ||
      (reacted && result?.thermal === "endothermic" && !isSelfCooling(result)) ||
      (rig.kind === "water-bath" && rig.active),
    solid: solid ? { formula: solid.formula, dissolving: solidDissolving } : null,
    rig,
    phase,
    turbid: isTurbid(contents, result ?? null),
    crystal,
    tempShift: reacted && result
      ? result.thermal === "exothermic"
        ? "up"
        : result.thermal === "endothermic"
          ? "down"
          : null
      : null,
  };
}
