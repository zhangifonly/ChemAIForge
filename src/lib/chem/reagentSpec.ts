// 试剂规格层：一瓶试剂"是什么形态、多浓、怎么量取"。
//
// 这是定量实验的入口。原先界面上试剂只有一个中文名，点一下就"加进去了"，
// 加多少不存在 —— 而实验目录里 60 个实验写着滴定管/移液管/量筒/天平，
// 那些仪器在界面上只是灰色标签。有了规格，才谈得上「取 25.00 mL 0.1000 mol/L 盐酸」。
//
// 设计取舍：不为 200 多个化学式手工写规格（必然漏、必然过时），而是
//   ① 按 SubstanceCategory 给出合理默认（酸碱盐 = 溶液、金属 = 固体、气体 = 气体）；
//   ② 只为「化学上必须精确」的项写覆盖 —— 浓硫酸不是 1 mol/L，饱和石灰水只有
//      0.02 mol/L，把它们按默认值处理会让所有定量结论错一个数量级。
// 新增试剂默认就有合理规格，需要精确时再补一条覆盖。
import type { SubstanceCategory } from "./engine";
import { molarMass } from "./formula";

/**
 * 试剂在试剂瓶里的形态，决定用什么仪器量取。
 * bulk 是「取适量即可」的一类：油脂、纤维素、淀粉这些混合物或高分子没有确定的
 * 摩尔质量，真实实验里也从不称到 mol —— 强行按固体处理会算出无意义的物质的量。
 */
export type ReagentPhase =
  | "solution"
  | "solid"
  | "liquid"
  | "gas"
  | "indicator"
  | "bulk";

/** 一瓶试剂的规格 */
export interface ReagentSpec {
  phase: ReagentPhase;
  /** 溶液浓度（mol/L）；固体/纯液体/气体无此项 */
  concentration?: number;
  /** 纯液体密度（g/mL），用于按体积算物质的量（乙醇、乙酸等） */
  density?: number;
  /** 摩尔质量（g/mol）；哨兵标签为 null */
  molarMass: number | null;
  /** 瓶签上的规格文字，如 "1.00 mol/L"、"分析纯 固体" */
  label: string;
  /** 默认单次取用量（溶液/液体 mL，固体 g，气体 mL） */
  defaultDose: number;
  /** 取用单位 */
  unit: "mL" | "g";
}

/**
 * 精确浓度覆盖表：只列「按默认值会错得离谱」的项。
 * 值取中学实验室常规配制浓度；浓酸浓碱按试剂瓶标称。
 */
const CONCENTRATION: Record<string, number> = {
  // 浓酸：按市售试剂标称浓度，与稀酸差一个数量级
  H2SO4: 18.4,
  HNO3: 14.5,
  CH3COOH: 17.4,
  // 微溶物的饱和溶液：石灰水只有 0.02 mol/L，当成 1 mol/L 会让中和计算错 50 倍
  "Ca(OH)2": 0.02,
  "Ba(OH)2": 0.1,
  H2CO3: 0.04,
  // 常规稀溶液（实验室标配 0.1 mol/L 一档）
  KMnO4: 0.02,
  K2Cr2O7: 0.1,
  Na2S2O3: 0.1,
  Na2EDTA: 0.02,
  AgNO3: 0.1,
  I2: 0.05,
  Br2: 0.05,
  H2O2: 0.9,
  "NH3·H2O": 2.0,
};

/**
 * 难溶物：以固体形态取用，不能按溶液处理。
 * 类别（carbonate / salt / base）本身分不出溶与不溶 —— Na₂CO₃ 配 1 mol/L 溶液，
 * CaCO₃ 是称 2 g 石灰石丢进去。前者按固体算会让浓度失真，后者按溶液算
 * 更荒唐（大理石没有"1 mol/L"这回事）。
 */
const INSOLUBLE = new Set([
  "CaCO3",
  "Ag2CO3",
  "AgCl",
  "AgBr",
  "AgI",
  "Ag2S",
  "FeS",
  "BaSO4",
  "CaSO4",
  "Na3AlF6",
  "Al(OH)3",
  "Fe(OH)3",
  "Fe(OH)2",
  "Cu(OH)2",
  "Mg(OH)2",
  "Zn(OH)2",
  "Ni(OH)2",
  "Co(OH)2",
]);

/** 无确定摩尔质量的混合物 / 高分子：取"适量"，不参与 mol 计算 */
const BULK = new Set(["fat", "cellulose", "starch", "soap-solution", "petroleum"]);

/** 纯液体密度（g/mL）：这些试剂以纯液体形态取用，靠密度换算物质的量 */
const DENSITY: Record<string, number> = {
  C2H5COOH: 0.993,
  C6H5CHO: 1.044,
  C8H8: 0.909,
  C2H5OH: 0.789,
  CH3OH: 0.792,
  C3H7OH: 0.804,
  C3H8O: 0.785,
  C4H9OH: 0.81,
  C6H6: 0.876,
  C7H8: 0.867,
  CCl4: 1.594,
  CH3COCH3: 0.791,
  CH3CHO: 0.784,
  C6H5NH2: 1.022,
  C6H5NO2: 1.204,
  C2H6O2: 1.113,
  C3H8O3: 1.261,
  "(CH3CO)2O": 1.082,
  CH3COOC2H5: 0.902,
  CH3COOCH3: 0.934,
  HCOOCH3: 0.974,
  HCOOC2H5: 0.917,
  HCOOH: 1.22,
  H2O: 1.0,
};

/** 以纯液体取用的类别归属（有机物中的液体由 DENSITY 表判定） */
function phaseOf(formula: string, category: SubstanceCategory): ReagentPhase {
  if (BULK.has(formula)) return "bulk";
  if (category === "indicator") return "indicator";
  if (category === "gas") return "gas";
  if (formula in DENSITY) return "liquid";
  if (category === "metal") return "solid";
  if (INSOLUBLE.has(formula)) return "solid";
  // 氧化物与单质固体（C/S/P）以固体形态取用
  if (category === "oxide") return "solid";
  if (category === "organic") return "solid"; // 未列入密度表的有机物按固体（葡萄糖、苯甲酸等）
  return "solution";
}

/** 固体默认称量值（g）：金属片/粒比粉末取得少 */
const SOLID_DOSE = 2;
/** 溶液默认取用体积（mL）：与常规试管/烧杯实验用量一致 */
const SOLUTION_DOSE = 10;

/** 生成瓶签文字：溶液标浓度，纯液体标密度，固体标"固体" */
function labelOf(spec: Omit<ReagentSpec, "label">): string {
  if (spec.phase === "indicator") return "指示剂";
  if (spec.phase === "gas") return "气体";
  if (spec.phase === "bulk") return "取适量";
  if (spec.phase === "solution") {
    const c = spec.concentration;
    return c === undefined ? "溶液" : `${c} mol/L`;
  }
  if (spec.phase === "liquid") {
    return spec.density ? `纯液体 ρ=${spec.density} g/mL` : "液体";
  }
  return "固体 分析纯";
}

/**
 * 规格标签的本地化版本：按规格字段选词条，而不是翻译 labelOf 的中文输出。
 *
 * labelOf 保留中文，因为它还被非界面代码使用（会话记录的「规格」字段、测试断言）。
 * 界面上展示的瓶签要随语言变，故另走这里 —— 分支与 labelOf 一一对应，
 * 由调用方注入取词函数（本文件是纯 .ts，拿不到 React 上下文）。
 */
export function localizedSpecLabel(
  spec: Pick<ReagentSpec, "phase" | "concentration" | "density">,
  t: (key: string, vars?: Record<string, string | number>) => string,
): string {
  if (spec.phase === "indicator") return t("specIndicator");
  if (spec.phase === "gas") return t("specGas");
  if (spec.phase === "bulk") return t("specBulk");
  if (spec.phase === "solution") {
    return spec.concentration === undefined
      ? t("specSolution")
      : t("specConc", { conc: spec.concentration });
  }
  if (spec.phase === "liquid") {
    return spec.density
      ? t("specLiquidDensity", { density: spec.density })
      : t("specLiquid");
  }
  return t("specSolid");
}

/**
 * 查一瓶试剂的规格。
 * 未登记浓度的溶液默认 1.0 mol/L —— 中学实验室"稀溶液"的通用档位，
 * 与 CONCENTRATION 里的精确项配合即可覆盖全库。
 */
export function reagentSpec(
  formula: string,
  category: SubstanceCategory,
): ReagentSpec {
  const phase = phaseOf(formula, category);
  const mm = molarMass(formula);
  const base = {
    phase,
    molarMass: mm,
    concentration:
      phase === "solution" ? (CONCENTRATION[formula] ?? 1.0) : undefined,
    density: phase === "liquid" ? DENSITY[formula] : undefined,
    defaultDose: phase === "solid" ? SOLID_DOSE : SOLUTION_DOSE,
    unit: (phase === "solid" ? "g" : "mL") as "mL" | "g",
  };
  return { ...base, label: labelOf(base) };
}

/**
 * 按取用量算物质的量（mol）。
 * 溶液走 c·V，纯液体走 ρ·V/M，固体走 m/M；哨兵标签（无摩尔质量）返回 null
 * —— 指示剂本来就不参与定量，返回 0 会让"加了 2 g 酚酞"流进报告。
 */
export function amountOf(spec: ReagentSpec, dose: number): number | null {
  if (spec.phase === "indicator" || spec.phase === "gas") return null;
  if (spec.phase === "bulk") return null;
  if (spec.phase === "solution") {
    if (spec.concentration === undefined) return null;
    return (spec.concentration * dose) / 1000; // mL → L
  }
  if (spec.molarMass === null) return null;
  if (spec.phase === "liquid") {
    if (!spec.density) return null;
    return (spec.density * dose) / spec.molarMass;
  }
  return dose / spec.molarMass;
}
