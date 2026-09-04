// 配位 / 显色反应规则
// 覆盖：Fe³⁺ + SCN⁻ 血红、Cu²⁺ + 过量氨水深蓝、苯酚 + FeCl₃ 紫色、
// 蛋白质遇浓硝酸变黄、酸碱指示剂变色。
import type { Reaction } from "./helpers";
import { hasAnyFormula } from "./helpers";

export const coordinationRules: Reaction[] = [
  {
    id: "prussian-blue",
    name: "普鲁士蓝（滕氏蓝）生成",
    // Fe²⁺ + 铁氰化钾，或 Fe³⁺ + 亚铁氰化钾，均得同一蓝色沉淀
    match: (inputs) =>
      (hasAnyFormula(inputs, ["FeSO4", "FeCl2"]) &&
        hasAnyFormula(inputs, ["K3[Fe(CN)6]"])) ||
      (hasAnyFormula(inputs, ["FeCl3", "Fe2(SO4)3", "Fe(NO3)3"]) &&
        hasAnyFormula(inputs, ["K4[Fe(CN)6]"])),
    build: () => ({
      products: [
        { formula: "KFe[Fe(CN)6]", name: "普鲁士蓝", category: "salt" },
      ],
      producesGas: false,
      producesPrecipitate: true,
      colorChange: true,
      thermal: "none",
      phTrend: "neutral",
      equation: "Fe²⁺ + [Fe(CN)₆]³⁻ + K⁺ → KFe[Fe(CN)₆]↓（深蓝）",
      description:
        "亚铁离子与铁氰化钾生成深蓝色沉淀普鲁士蓝，可用于铁离子检验，亦是经典颜料。",
    }),
  },
  {
    id: "edta-hardness-titration",
    name: "EDTA 配位滴定（水硬度）",
    // 铬黑T 先与 Ca²⁺/Mg²⁺ 显酒红，EDTA 夺取金属离子后指示剂游离显纯蓝 → 终点
    match: (inputs) =>
      hasAnyFormula(inputs, ["Na2EDTA"]) &&
      hasAnyFormula(inputs, ["CaCl2", "MgCl2", "MgSO4"]) &&
      hasAnyFormula(inputs, ["EBT"]),
    build: () => ({
      products: [
        { formula: "[Ca-EDTA]2-", name: "钙-EDTA 配离子", category: "salt" },
      ],
      producesGas: false,
      producesPrecipitate: false,
      colorChange: true,
      thermal: "none",
      phTrend: "neutral",
      equation: "Ca²⁺ + H₂Y²⁻ → CaY²⁻ + 2H⁺（pH≈10 氨性缓冲）",
      description:
        "EDTA 夺取被铬黑T 络合的钙镁离子，指示剂游离，溶液由酒红色变为纯蓝色，即为滴定终点。",
    }),
  },
  // 原 cocl2-equilibrium 已删除：与 equilibrium.ts 的 cobalt-chloride-equilibrium
  // 是同一化学，而后者注册序号更前（4 < 37），按首命中优先本规则永远轮不到执行，
  // 属于死代码；且后者的方程带 ΔH > 0、描述里有变色硅胶的实际应用，信息更完整。
  {
    id: "fe-scn",
    name: "铁(III)与硫氰酸根显色",
    match: (inputs) =>
      hasAnyFormula(inputs, ["FeCl3", "Fe2(SO4)3", "Fe(NO3)3"]) &&
      hasAnyFormula(inputs, ["KSCN", "NaSCN", "NH4SCN"]),
    build: () => ({
      products: [{ formula: "Fe(SCN)3", name: "硫氰化铁", category: "salt" }],
      producesGas: false,
      producesPrecipitate: false,
      colorChange: true,
      thermal: "none",
      phTrend: "neutral",
      equation: "Fe³⁺ + 3SCN⁻ → Fe(SCN)₃（血红色）",
      description: "铁(III)离子与硫氰酸根生成血红色配合物，常用于 Fe³⁺ 的灵敏检验。",
    }),
  },
  {
    id: "cu-ammonia",
    name: "铜氨配离子显色",
    match: (inputs) =>
      hasAnyFormula(inputs, ["CuSO4", "CuCl2", "Cu(NO3)2"]) &&
      hasAnyFormula(inputs, ["NH3·H2O", "NH3"]),
    build: () => ({
      products: [
        { formula: "[Cu(NH3)4]2+", name: "铜氨配离子", category: "salt" },
      ],
      producesGas: false,
      producesPrecipitate: false,
      colorChange: true,
      thermal: "none",
      phTrend: "increase",
      equation: "Cu²⁺ + 4NH₃ → [Cu(NH₃)₄]²⁺（深蓝）",
      description: "铜盐中加入过量氨水，先生成蓝色沉淀后溶解为深蓝色铜氨配离子。",
    }),
  },
  {
    id: "silver-ammonia",
    name: "银氨溶液配制",
    // AgNO₃ 中滴氨水：先生成白色 AgOH/Ag₂O 沉淀，继续加氨至沉淀恰好溶解得银氨溶液
    match: (inputs) =>
      hasAnyFormula(inputs, ["AgNO3"]) && hasAnyFormula(inputs, ["NH3·H2O", "NH3"]),
    build: () => ({
      products: [
        { formula: "[Ag(NH3)2]+", name: "二氨合银配离子", category: "salt" },
      ],
      producesGas: false,
      // 加氨过程中确有白色沉淀先出现，是这个实验的关键观察点
      producesPrecipitate: true,
      // 沉淀是 AgOH（白），不是产物那个无色配离子
      precipitateFormula: "AgOH",
      colorChange: false,
      thermal: "none",
      phTrend: "increase",
      equation: "Ag⁺ + 2NH₃ → [Ag(NH₃)₂]⁺（沉淀先生成后溶解）",
      description:
        "硝酸银中逐滴加入氨水，先析出白色沉淀，继续滴加至沉淀恰好溶解，即得澄清的银氨溶液。",
    }),
  },
  {
    id: "zinc-ammonia",
    name: "锌氨配离子",
    match: (inputs) =>
      hasAnyFormula(inputs, ["ZnSO4", "ZnCl2", "Zn(NO3)2"]) &&
      hasAnyFormula(inputs, ["NH3·H2O", "NH3"]),
    build: () => ({
      products: [
        { formula: "[Zn(NH3)4]2+", name: "锌氨配离子", category: "salt" },
      ],
      producesGas: false,
      producesPrecipitate: true,
      // 中间沉淀是白色 Zn(OH)2；产物配离子无色，拿它查沉淀色表查不到
      precipitateFormula: "Zn(OH)2",
      colorChange: false,
      thermal: "none",
      phTrend: "increase",
      equation: "Zn²⁺ + 4NH₃ → [Zn(NH₃)₄]²⁺（白色沉淀先生成后溶解）",
      description:
        "锌盐中加少量氨水生成白色氢氧化锌沉淀，氨水过量时沉淀溶解为无色锌氨配离子。",
    }),
  },
  {
    id: "nickel-ammonia",
    name: "镍氨配离子显色",
    // 必须排除丁二酮肟：它是镍的特效试剂，螯合常数远大于氨，且实验里加氨水
    // 只为调到弱碱性。若不排除，「氯化镍 + 丁二酮肟 + 氨水」会报成蓝紫色氨配离子，
    // 丢掉鲜红螯合沉淀这个唯一看点（下一条规则本可正确处理，却因排序被截住）
    match: (inputs) =>
      hasAnyFormula(inputs, ["NiCl2", "NiSO4", "Ni(NO3)2"]) &&
      hasAnyFormula(inputs, ["NH3·H2O", "NH3"]) &&
      !hasAnyFormula(inputs, ["C4H8N2O2"]),
    build: () => ({
      products: [
        { formula: "[Ni(NH3)6]2+", name: "六氨合镍配离子", category: "salt" },
      ],
      producesGas: false,
      producesPrecipitate: true,
      // 中间沉淀是苹果绿的 Ni(OH)2。原先靠产物反推，拿蓝紫配离子去查沉淀色表
      // 查不到，回退成白色 —— 恰好把「绿色沉淀溶成蓝紫溶液」的对比抹平
      precipitateFormula: "Ni(OH)2",
      colorChange: true,
      thermal: "none",
      phTrend: "increase",
      equation: "Ni²⁺ + 6NH₃ → [Ni(NH₃)₆]²⁺（浅绿 → 蓝紫）",
      description:
        "镍盐加氨水先生成浅绿色氢氧化镍沉淀，氨水过量后溶解为蓝紫色六氨合镍配离子。",
    }),
  },
  {
    id: "nickel-dimethylglyoxime",
    name: "镍与二乙酮肟显色",
    match: (inputs) =>
      hasAnyFormula(inputs, ["NiCl2", "NiSO4", "Ni(NO3)2"]) &&
      hasAnyFormula(inputs, ["C4H8N2O2"]),
    build: () => ({
      products: [
        { formula: "Ni(DMG)2", name: "二乙酮肟镍", category: "salt" },
      ],
      producesGas: false,
      producesPrecipitate: true,
      colorChange: true,
      thermal: "none",
      phTrend: "neutral",
      equation: "Ni²⁺ + 2HDMG → Ni(DMG)₂↓（鲜红）",
      description:
        "弱碱性条件下镍离子与二乙酮肟生成鲜红色螯合沉淀，是镍的特征鉴别反应，灵敏度极高。",
    }),
  },
  {
    id: "aluminum-hydroxide-amphoteric",
    name: "氢氧化铝两性溶解",
    // 既溶于酸又溶于强碱，是"两性"最经典的演示；碱中生成偏铝酸盐
    match: (inputs) =>
      hasAnyFormula(inputs, ["Al(OH)3"]) && hasAnyFormula(inputs, ["NaOH", "KOH"]),
    build: () => ({
      products: [
        { formula: "NaAlO2", name: "偏铝酸钠", category: "salt" },
      ],
      producesGas: false,
      producesPrecipitate: false,
      colorChange: false,
      thermal: "none",
      phTrend: "increase",
      equation: "Al(OH)₃ + NaOH → NaAlO₂ + 2H₂O",
      description:
        "白色氢氧化铝沉淀在强碱中溶解为无色澄清的偏铝酸钠溶液，与它溶于酸的行为共同体现两性。",
    }),
  },
  // 原 phenol-fecl3 已删除：chromogenic.ts 的 chromo-phenol-fe3 注册序号更前
  //（31 < 45），本规则永远命中不到。后者覆盖面也更广：酚一侧含水杨酸、
  // 铁一侧含硫酸铁与硝酸铁，方程写出了配位比与放出的 H⁺，产物化学式规范。
];
