// 强氧化剂专项规则
// 覆盖引擎原先缺失的几条：实验室制氯气（二氧化锰 / 高锰酸钾 + 浓盐酸）、
// 氯酸钾受热分解制氧、碘量法的硫代硫酸钠滴定、铁(III)氧化硫离子析硫。
// 这些反应的共同点是「浓度或加热条件决定能否发生」，与 redox.ts 里
// 常温溶液中的显色型氧化还原分开，避免单个文件过长。
import type { Reaction } from "./helpers";
import { hasAnyFormula, isConcentrated } from "./helpers";

export const oxidantRules: Reaction[] = [
  {
    // 高锰酸钾法必须与二氧化锰法分开：原先三种氧化剂共用一条规则、统一标
    // requiresHeat，而规则自己的 build 里就写着"高锰酸钾常温即可、无需加热" ——
    // 那句描述永远走不到，且「常温制氯气」这个实验在界面上永远制不出气。
    // 氧化性强弱本就是这两法的对比看点，规则层面也该分开表达。
    id: "kmno4-concentrated-hcl-chlorine",
    name: "高锰酸钾常温制氯气",
    match: (inputs) =>
      hasAnyFormula(inputs, ["KMnO4"]) && isConcentrated(inputs, "HCl"),
    build: () => ({
      products: [
        { formula: "Cl2", name: "氯气", category: "gas" as const },
        { formula: "MnCl2", name: "氯化锰", category: "salt" as const },
        { formula: "H2O", name: "水", category: "water" as const },
      ],
      producesGas: true,
      producesPrecipitate: false,
      colorChange: true,
      thermal: "exothermic" as const,
      phTrend: "increase" as const,
      equation: "2KMnO₄ + 16HCl(浓) → 2KCl + 2MnCl₂ + 5Cl₂↑ + 8H₂O",
      description:
        "高锰酸钾氧化性极强，常温即可氧化浓盐酸放出黄绿色氯气，无需加热 —— 与二氧化锰法必须加热恰成对照。",
    }),
  },
  {
    id: "mno2-concentrated-hcl-chlorine",
    name: "实验室制氯气",
    requiresHeat: true,
    // 只有浓盐酸才被氧化出氯气，稀盐酸不行；这是浓度决定反应能否发生的
    // 典型例子，故必须读试剂名里的「浓」字
    match: (inputs) =>
      hasAnyFormula(inputs, ["MnO2", "KClO3"]) && isConcentrated(inputs, "HCl"),
    build: () => ({
      products: [
        { formula: "Cl2", name: "氯气", category: "gas" as const },
        { formula: "MnCl2", name: "氯化锰", category: "salt" as const },
        { formula: "H2O", name: "水", category: "water" as const },
      ],
      producesGas: true,
      producesPrecipitate: false,
      // 黄绿色氯气充满容器是该实验最直接的成功标志
      colorChange: true,
      thermal: "exothermic" as const,
      phTrend: "increase" as const,
      equation: "MnO₂ + 4HCl(浓) --Δ--> MnCl₂ + Cl₂↑ + 2H₂O",
      description:
        "加热条件下二氧化锰把浓盐酸氧化，放出黄绿色氯气，须用饱和食盐水除杂并碱液吸收尾气。",
    }),
  },
  {
    id: "kclo3-decompose",
    name: "氯酸钾分解制氧",
    requiresHeat: true,
    // 二氧化锰只作催化剂，不出现在产物里；未加催化剂时分解温度高得多，
    // 这正是"催化剂改变反应条件"的教材实验
    match: (inputs) => hasAnyFormula(inputs, ["KClO3"]) && hasAnyFormula(inputs, ["MnO2"]),
    build: () => ({
      products: [
        { formula: "O2", name: "氧气", category: "gas" },
        { formula: "KCl", name: "氯化钾", category: "salt" },
      ],
      producesGas: true,
      producesPrecipitate: false,
      colorChange: false,
      thermal: "endothermic",
      phTrend: "neutral",
      equation: "2KClO₃ --MnO₂/Δ--> 2KCl + 3O₂↑",
      description:
        "氯酸钾在二氧化锰催化下受热分解放出氧气，带火星的木条复燃即可验证。催化剂本身质量与化学性质不变。",
    }),
  },
  {
    id: "kmno4-decompose",
    name: "高锰酸钾分解制氧",
    requiresHeat: true,
    // 必须限定"容器里只有高锰酸钾"：KMnO₄ 还在十几个实验里作强氧化剂
    // （氧化草酸、亚铁、浓盐酸制氯气…），若只判断"含 KMnO₄"，本条会抢在
    // 那些规则之前命中，把它们统统变成分解制氧。
    match: (inputs) => inputs.length === 1 && inputs[0].formula === "KMnO4",
    build: () => ({
      products: [
        { formula: "O2", name: "氧气", category: "gas" },
        { formula: "K2MnO4", name: "锰酸钾", category: "salt" },
        { formula: "MnO2", name: "二氧化锰", category: "oxide" },
      ],
      producesGas: true,
      producesPrecipitate: false,
      colorChange: true,
      thermal: "endothermic",
      phTrend: "neutral",
      equation: "2KMnO₄ --Δ--> K₂MnO₄ + MnO₂ + O₂↑",
      description:
        "加热紫黑色高锰酸钾固体，分解放出氧气，带火星的木条复燃即可验证。试管口需塞一团棉花，防止高锰酸钾粉末随气流进入导管。",
    }),
  },
  {
    id: "iodine-thiosulfate",
    name: "碘与硫代硫酸钠滴定",
    // 碘量法的终点反应：蓝色（碘-淀粉）褪去的瞬间即为终点
    match: (inputs) =>
      hasAnyFormula(inputs, ["I2"]) && hasAnyFormula(inputs, ["Na2S2O3"]),
    build: () => ({
      products: [
        { formula: "NaI", name: "碘化钠", category: "salt" },
        { formula: "Na2S4O6", name: "连四硫酸钠", category: "salt" },
      ],
      producesGas: false,
      producesPrecipitate: false,
      colorChange: true,
      thermal: "none",
      phTrend: "neutral",
      equation: "I₂ + 2Na₂S₂O₃ → 2NaI + Na₂S₄O₆",
      description:
        "硫代硫酸钠把碘定量还原为碘离子，棕黄色（或碘-淀粉的蓝色）恰好褪去即为碘量法终点。",
    }),
  },
  {
    id: "fe3-oxidize-sulfide",
    name: "铁(III)氧化硫离子析硫",
    match: (inputs) =>
      hasAnyFormula(inputs, ["FeCl3", "Fe2(SO4)3", "Fe(NO3)3"]) &&
      hasAnyFormula(inputs, ["Na2S", "H2S", "K2S"]),
    build: () => ({
      products: [
        { formula: "S", name: "硫", category: "other" },
        { formula: "FeCl2", name: "亚铁盐", category: "salt" },
      ],
      producesGas: false,
      producesPrecipitate: true,
      colorChange: true,
      thermal: "none",
      phTrend: "unknown",
      equation: "2Fe³⁺ + S²⁻ → 2Fe²⁺ + S↓",
      description:
        "铁(III)把硫离子氧化为硫单质，棕黄色溶液变浅绿并析出淡黄色浑浊，而非生成硫化铁沉淀。",
    }),
  },
];
