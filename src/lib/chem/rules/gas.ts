// 产气类反应规则
// 覆盖：碳酸盐/碳酸氢盐 + 酸 → CO₂↑；铵盐 + 碱 → NH₃↑；
// 过氧化氢分解 → O₂↑；活泼金属 + 水 → H₂↑（见 metal 模块）；
// 硫化物 + 酸 → H₂S↑；亚硫酸盐 + 酸 → SO₂↑；
// 难挥发强酸（浓硫酸）+ 挥发性酸的盐 → 该挥发性酸的气体（制 HCl / HF / HBr）。
import type { Reaction } from "./helpers";
import {
  hasAnyFormula,
  hasCategory,
  findByCategory,
  isConcentrated,
  sub,
} from "./helpers";

/**
 * 浓硫酸与卤化物盐微热，把挥发性酸顶出来（高沸点酸制低沸点酸）。
 *
 * 这条反应靠的不是酸性强弱，而是沸点差：H₂SO₄ 沸点 338 ℃，HCl 常温即为气体，
 * 微热就把它赶出体系，平衡不断右移。所以判据必须是「浓」硫酸 —— 稀硫酸里
 * 水远多于盐，HCl 全溶在水里根本出不来，什么也观察不到。
 *
 * 溴化物、碘化物不列入：浓硫酸会把 Br⁻/I⁻ 直接氧化成 Br₂/I₂（红棕/紫黑），
 * 得不到纯 HBr/HI，那是另一类现象，应由氧化还原规则处理。
 */
const VOLATILE_ACID_SALT: Record<
  string,
  { gas: string; gasName: string; equation: string; note: string }
> = {
  NaCl: {
    gas: "HCl",
    gasName: "氯化氢",
    equation: "NaCl + H₂SO₄(浓) --Δ--> NaHSO₄ + HCl↑",
    note: "在潮湿空气中形成白雾（盐酸小液滴），不是白烟",
  },
  KCl: {
    gas: "HCl",
    gasName: "氯化氢",
    equation: "KCl + H₂SO₄(浓) --Δ--> KHSO₄ + HCl↑",
    note: "在潮湿空气中形成白雾",
  },
  CaF2: {
    gas: "HF",
    gasName: "氟化氢",
    equation: "CaF₂ + H₂SO₄(浓) --Δ--> CaSO₄ + 2HF↑",
    note: "HF 腐蚀玻璃，必须用铅皿或塑料容器",
  },
  NaNO3: {
    gas: "HNO3",
    gasName: "硝酸",
    equation: "NaNO₃ + H₂SO₄(浓) --Δ--> NaHSO₄ + HNO₃↑",
    note: "硝酸受热易分解，需低温蒸馏并避光",
  },
};

export const gasRules: Reaction[] = [
  {
    id: "volatile-acid-from-salt",
    name: "浓硫酸制挥发性酸",
    // 必须排在 carbonate-acid 之前？不必 —— 卤化物盐不是 carbonate 类别。
    // 但必须早于通用的溶解/复分解规则，否则「氯化钠 + 浓硫酸」只报个溶解
    match: (inputs) =>
      inputs.some((s) => s.formula in VOLATILE_ACID_SALT) &&
      isConcentrated(inputs, "H2SO4"),
    build: (inputs) => {
      const salt = inputs.find((s) => s.formula in VOLATILE_ACID_SALT)!;
      const spec = VOLATILE_ACID_SALT[salt.formula];
      return {
        products: [
          { formula: spec.gas, name: spec.gasName, category: "gas" as const },
          { formula: "NaHSO4", name: "硫酸氢盐", category: "salt" as const },
        ],
        producesGas: true,
        producesPrecipitate: false,
        colorChange: false,
        thermal: "exothermic" as const,
        phTrend: "decrease" as const,
        equation: spec.equation,
        description: `浓硫酸沸点高达 338 ℃，微热即把挥发性的${spec.gasName}顶出体系，平衡持续右移 —— 这是"高沸点酸制低沸点酸"，与酸性强弱无关。${spec.note}。若换成稀硫酸则完全无效：水太多，气体全溶在溶液里出不来。`,
      };
    },
  },
  {
    id: "carbonate-acid",
    name: "碳酸盐与酸反应",
    match: (inputs) =>
      hasCategory(inputs, "carbonate") && hasCategory(inputs, "acid"),
    build: (inputs) => {
      const carb = findByCategory(inputs, "carbonate")!;
      // 热效应要按碳酸盐 / 碳酸氢盐分开：这是教材专门设计的对照知识点。
      //   碳酸钠 + 盐酸  放热（ΔH < 0）
      //   碳酸氢钠 + 酸  吸热（ΔH > 0）—— 泡腾片入水会降温就是这个原因
      // 原先一律写 exothermic，柠檬酸泡腾反应这个以"温度下降"为唯一看点的
      // 实验就被报成放热，温度计方向恰好相反。
      //
      // ⚠️ 判据必须是「全部碳酸盐都是酸式盐」，不能用 findByCategory 取到的
      // 那一个：它返回首个匹配，结果随投料顺序变 —— 二氧化碳除杂实验里
      // 碳酸钙与碳酸氢钠同时在场，正序报放热、逆序报吸热。
      // 正盐一旦在场，它与酸的放热就占主导，故只在"清一色酸式盐"时报吸热
      const carbonates = inputs.filter((s) => s.category === "carbonate");
      const bicarbonate = carbonates.every((s) => /HCO3/.test(s.formula));
      return {
        products: [
          { formula: "CO2", name: "二氧化碳", category: "gas" },
          { formula: "H2O", name: "水", category: "water" },
        ],
        producesGas: true,
        producesPrecipitate: false,
        colorChange: false,
        thermal: bicarbonate ? "endothermic" : "exothermic",
        phTrend: "increase",
        equation: `${carb.formula} + 酸 → 盐 + H₂O + CO₂↑`,
        description: bicarbonate
          ? "碳酸氢盐与酸反应放出二氧化碳，同时吸热使温度下降 —— 泡腾片入水后杯壁发凉正是如此，与碳酸钠和酸的放热恰成对照。"
          : "碳酸盐与酸反应放出无色二氧化碳气体，能使澄清石灰水变浑浊，过程放热。",
      };
    },
  },
  {
    id: "ammonium-base",
    name: "铵盐与碱反应",
    match: (inputs) =>
      hasAnyFormula(inputs, [
        "NH4Cl",
        "(NH4)2SO4",
        "NH4NO3",
        "(NH4)2CO3",
        "NH4HCO3",
      ]) &&
      hasCategory(inputs, "base"),
    build: () => ({
      products: [
        { formula: "NH3", name: "氨气", category: "gas" },
        { formula: "H2O", name: "水", category: "water" },
      ],
      producesGas: true,
      producesPrecipitate: false,
      colorChange: false,
      thermal: "endothermic",
      phTrend: "increase",
      equation: "铵盐 + 碱 → 盐 + H₂O + NH₃↑",
      description: "铵盐与碱共热放出有刺激性气味的氨气，使湿润红色石蕊试纸变蓝。",
    }),
  },
  {
    id: "h2o2-decompose",
    name: "过氧化氢分解",
    match: (inputs) =>
      hasAnyFormula(inputs, ["H2O2"]) &&
      hasAnyFormula(inputs, ["MnO2", "catalyst", "KI", "FeCl3"]),
    build: () => ({
      products: [
        { formula: "O2", name: "氧气", category: "gas" },
        { formula: "H2O", name: "水", category: "water" },
      ],
      producesGas: true,
      producesPrecipitate: false,
      colorChange: false,
      thermal: "exothermic",
      phTrend: "neutral",
      equation: "2H₂O₂ --催化--> 2H₂O + O₂↑",
      description: "过氧化氢在催化剂作用下迅速分解，放出能使带火星木条复燃的氧气。",
    }),
  },
  {
    id: "sulfite-acid",
    name: "亚硫酸盐与酸反应",
    match: (inputs) =>
      hasAnyFormula(inputs, ["Na2SO3", "K2SO3", "NaHSO3"]) &&
      hasCategory(inputs, "acid"),
    build: () => ({
      products: [
        { formula: "SO2", name: "二氧化硫", category: "gas" },
        { formula: "H2O", name: "水", category: "water" },
      ],
      producesGas: true,
      producesPrecipitate: false,
      colorChange: false,
      thermal: "exothermic",
      phTrend: "increase",
      equation: "亚硫酸盐 + 酸 → 盐 + H₂O + SO₂↑",
      description: "亚硫酸盐与酸反应放出有刺激性气味的二氧化硫气体。",
    }),
  },
  {
    id: "sulfide-acid",
    name: "硫化物与酸反应",
    // ⚠️ 必须排除体系里存在重金属离子：Cu²⁺/Pb²⁺/Ag⁺/Hg²⁺ 会把 S²⁻ 直接锁成
    // CuS / PbS / Ag₂S 沉淀，而这些硫化物的 Ksp 极小、不溶于稀酸，加酸也放不出 H₂S。
    // 这正是"用硫化钠沉淀废水重金属"与"硫化氢气体发生"两类实验的分界。
    // 原先只判「有硫化物 + 有酸」，于是「硫酸铜 + 硫化钠 + 盐酸」被报成冒 H₂S 气泡，
    // 实际现象是生成黑色 CuS 沉淀且加酸不溶 —— 现象和结论完全相反。
    // 硫化亚铁、硫化锌本身可溶于稀酸，故它们保留在本规则内（实验室就是用 FeS 制 H₂S）
    match: (inputs) =>
      hasAnyFormula(inputs, ["FeS", "Na2S", "ZnS"]) &&
      hasCategory(inputs, "acid") &&
      !hasAnyFormula(inputs, [
        "CuSO4", "CuCl2", "Cu(NO3)2",
        "Pb(NO3)2", "AgNO3", "Hg(NO3)2", "HgCl2",
      ]),
    build: () => ({
      products: [{ formula: "H2S", name: "硫化氢", category: "gas" }],
      producesGas: true,
      producesPrecipitate: false,
      colorChange: false,
      thermal: "none",
      phTrend: "increase",
      equation: "硫化物 + 酸 → 盐 + H₂S↑",
      description: "硫化物与酸反应放出有臭鸡蛋气味的硫化氢气体。",
    }),
  },
  {
    id: "acidic-oxide-base",
    name: "酸性氧化物与碱反应",
    // CO₂ / SO₂ 等酸性氧化物通入碱液：与石灰水生成沉淀（变浑浊），与可溶强碱被吸收。
    match: (inputs) =>
      hasAnyFormula(inputs, ["CO2", "SO2"]) && hasCategory(inputs, "base"),
    build: (inputs) => {
      const oxide = inputs.find((s) => ["CO2", "SO2"].includes(s.formula))!;
      const lime = hasAnyFormula(inputs, ["Ca(OH)2", "Ba(OH)2"]);
      const isCO2 = oxide.formula === "CO2";
      // 石灰水 / 钡碱：生成难溶的碳酸钙(钡) / 亚硫酸钙(钡) → 变浑浊
      if (lime) {
        const base = inputs.find((s) =>
          ["Ca(OH)2", "Ba(OH)2"].includes(s.formula),
        )!;
        const metal = base.formula.startsWith("Ca") ? "Ca" : "Ba";
        // 下标必须用半角数字：产物化学式是查 PRECIPITATE_COLOR / SOLUTION_TINT 的键，
        // 全角 `CaCO₃` 与色表里的 `CaCO3` 不是同一个键，颜色一律回退默认值。
        // 碳酸钙碰巧就是白色所以一直没暴露，但同一条规则生成的亚硫酸盐、
        // 以及将来任何有色碳酸盐都会静默失色 —— 方程式文字里才用全角
        const salt = isCO2 ? `${metal}CO3` : `${metal}SO3`;
        return {
          products: [
            { formula: salt, name: isCO2 ? "碳酸盐沉淀" : "亚硫酸盐沉淀", category: "salt" },
            { formula: "H2O", name: "水", category: "water" },
          ],
          producesGas: false,
          producesPrecipitate: true,
          colorChange: false,
          thermal: "none",
          phTrend: "decrease",
          // 方程式排版用全角下标，产物 formula 保持半角（查色表的键）
          equation: `${sub(oxide.formula)} + ${sub(base.formula)} → ${sub(salt)}↓ + H₂O`,
          description: isCO2
            ? "二氧化碳通入澄清石灰水生成白色碳酸钙沉淀，石灰水变浑浊（CO₂ 的检验）。"
            : "二氧化硫通入石灰水 / 钡碱生成白色亚硫酸盐沉淀，溶液变浑浊。",
        };
      }
      // 可溶强碱（NaOH/KOH）：酸性氧化物被吸收生成盐和水，无明显沉淀
      return {
        products: [
          { formula: isCO2 ? "CO₃²⁻盐" : "SO₃²⁻盐", name: "盐", category: "salt" },
          { formula: "H2O", name: "水", category: "water" },
        ],
        producesGas: false,
        producesPrecipitate: false,
        colorChange: false,
        thermal: "none",
        phTrend: "decrease",
        equation: `${oxide.formula} + 2NaOH → 盐 + H₂O`,
        description: "酸性氧化物被可溶强碱吸收，生成相应的盐和水。",
      };
    },
  },
];
