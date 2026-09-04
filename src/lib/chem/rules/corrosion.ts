// 钢铁腐蚀规则
//
// 钢铁生锈不是"铁 + 氧气"的简单化合，而是原电池过程：铁作阳极失电子，溶解的
// 氧在阴极得电子生成 OH⁻（吸氧腐蚀），电解质（食盐水）只是导电介质，本身不消耗。
// 这解释了三件教材要点：① 必须同时有水和氧气 ② 盐水显著加速 ③ 阳极区
// 铁氰化钾变蓝、阴极区酚酞变红（两极产物在空间上分开）。
//
// 引擎原先只有"铁 + 氧气 --点燃--> Fe₃O₄"这种高温路径，常温腐蚀一律判不反应，
// 于是四个腐蚀实验（生锈条件探究、微电池显色、牺牲阳极、吸氧腐蚀测氧）全是死场景。
import type { Reaction } from "./helpers";
import { hasAnyFormula, hasCategory } from "./helpers";
import { isMoreActive } from "../galvanic";

/** 可腐蚀的铁基材料 */
const IRON = ["Fe", "Fe3C"];

/** 电解质：加速腐蚀的介质，本身不被消耗 */
const ELECTROLYTE = ["NaCl", "KCl", "Na2SO4", "MgCl2", "CaCl2", "NH4Cl"];

/** 比铁活泼、可作牺牲阳极的金属 */
const SACRIFICIAL = ["Zn", "Mg", "Al"];

/**
 * 银器除黑：黑锈 Ag₂S 在热碳酸钠溶液中与铝箔接触构成原电池，
 * 铝作阳极失电子，Ag⁺ 在银表面得电子还原为金属银。
 *
 * 这与「牺牲阳极」是同一原理的另一面：那里保护的是铁不被氧化，
 * 这里是把已经氧化的银还原回来。关键是不掉银 —— 与用牙膏摩擦或
 * 硝酸浸洗不同，电化学还原让硫离子进入溶液而银原子留在原处。
 */
const TARNISH_REDUCTION = ["Ag2S", "Ag2O"];

export const corrosionRules: Reaction[] = [
  {
    id: "steel-oxygen-absorption-corrosion",
    name: "钢铁吸氧腐蚀",
    // 只要「铁 + 水（或电解质水溶液）」即成立：空气中的氧无须显式加入，
    // 敞口体系里氧总是溶解进来的，这也正是"隔绝空气才不锈"的对照点
    match: (inputs) => {
      if (!hasAnyFormula(inputs, IRON)) return false;
      const wet = hasCategory(inputs, "water") || hasAnyFormula(inputs, ELECTROLYTE);
      if (!wet) return false;
      // 若在场金属里存在比铁更活泼的，腐蚀被阴极保护抑制，交给下一条规则
      return !inputs.some(
        (s) => SACRIFICIAL.includes(s.formula) && isMoreActive(s.formula, "Fe"),
      );
    },
    build: (inputs) => {
      const salty = hasAnyFormula(inputs, ELECTROLYTE);
      // 显式加入氧气意味着是"富氧 + 大表面积铁粉"的暖手袋情形：反应速率被拉高
      // 几个数量级，温度计能读出 50 ℃ 以上的温升，此时必须报放热。
      // 敞口锈蚀（氧只靠自然溶解）则慢到测不出，仍报 none —— 同一化学过程，
      // 热效应可见与否取决于速率，这正是暖宝宝与生锈的差别所在
      const forcedOxygen = hasAnyFormula(inputs, ["O2"]);
      // 铁氰化钾遇阳极生成的 Fe²⁺ 立刻显滕氏蓝；酚酞遇阴极 OH⁻ 显红。
      // 这两个指示剂是"腐蚀是原电池"最直接的可视化证据
      const probeDye = hasAnyFormula(inputs, ["K3[Fe(CN)6]"]) ||
        hasCategory(inputs, "indicator");
      return {
        products: [
          { formula: "Fe(OH)2", name: "氢氧化亚铁", category: "base" as const },
          { formula: "Fe2O3·xH2O", name: "铁锈", category: "other" as const },
        ],
        producesGas: false,
        // 铁锈疏松附着在铁表面并脱落到液中，观感上就是沉淀
        producesPrecipitate: true,
        colorChange: true,
        // 常温敞口腐蚀放热极缓慢，温度计读不出，标为无热效应比谎报升温更诚实
        thermal: (forcedOxygen ? "exothermic" : "none") as "exothermic" | "none",
        phTrend: "increase" as const,
        equation: probeDye
          ? "阳极 Fe - 2e⁻ → Fe²⁺（遇 K₃[Fe(CN)₆] 显蓝）；阴极 O₂ + 2H₂O + 4e⁻ → 4OH⁻（遇酚酞显红）"
          : "2Fe + O₂ + 2H₂O → 2Fe(OH)₂ → 铁锈 Fe₂O₃·xH₂O",
        description: probeDye
          ? "腐蚀本质是原电池：铁作阳极失电子成 Fe²⁺，使铁氰化钾显滕氏蓝；溶解氧在阴极得电子生成 OH⁻，使酚酞显红。蓝区与红区在空间上分开，正说明两极反应分处不同位置。"
          : forcedOxygen
            ? "铁粉的巨大表面积加上充足氧气，把原本要几天的锈蚀压缩到十几分钟：氧化放出的热使袋内温度升到 50 ℃ 以上并维持数小时。食盐与活性炭的作用是构成大量微电池、加快电子转移，本身不产热 —— 这就是商品暖宝宝的全部原理，摇一摇只是让空气进入。"
            : salty
              ? "食盐水提高导电性，使腐蚀微电池的电流增大，铁钉表面很快出现红棕色铁锈；氧被消耗致密闭体系内压下降，可由导管液面上升测出。"
              : "铁在有水又有氧时缓慢锈蚀生成疏松的红棕色铁锈；缺水或隔绝空气（如浸没在植物油下）则不生锈，说明水与氧气二者缺一不可。",
      };
    },
  },
  {
    id: "sacrificial-anode-protection",
    name: "牺牲阳极的阴极保护",
    // 更活泼的金属与铁接触后优先失电子，铁被保护而不锈——现象是"锌腐蚀、铁完好"，
    // 与上一条恰好相反，必须单列否则会错报铁生锈
    match: (inputs) =>
      hasAnyFormula(inputs, IRON) &&
      inputs.some((s) => SACRIFICIAL.includes(s.formula) && isMoreActive(s.formula, "Fe")) &&
      (hasCategory(inputs, "water") || hasAnyFormula(inputs, ELECTROLYTE)),
    build: (inputs) => {
      const anode = inputs.find(
        (s) => SACRIFICIAL.includes(s.formula) && isMoreActive(s.formula, "Fe"),
      )!;
      return {
        products: [
          { formula: `${anode.formula}2+`, name: `${anode.name}离子`, category: "salt" as const },
          { formula: "OH-", name: "氢氧根", category: "base" as const },
        ],
        producesGas: false,
        producesPrecipitate: false,
        colorChange: true,
        thermal: "none" as const,
        phTrend: "increase" as const,
        equation: `阳极 ${anode.formula} - 2e⁻ → ${anode.formula}²⁺；阴极(铁) O₂ + 2H₂O + 4e⁻ → 4OH⁻`,
        description: `${anode.name}比铁活泼，接触后由它优先失电子被腐蚀，铁整体沦为阴极只接受电子而不溶解 —— 电流计可测出持续电流，${anode.name}块逐渐消耗而铁件保持光亮，这就是船舶与管道上"锌块要定期更换"的原因。`,
      };
    },
  },
  {
    id: "silver-tarnish-electrochemical-reduction",
    name: "银器电化学还原除黑",
    // 判据是「黑锈 + 活泼金属 + 导电溶液」。碳酸钠既提供电解质又水解显碱性，
    // 使 S²⁻ 稳定留在溶液里不再回到银面
    match: (inputs) =>
      hasAnyFormula(inputs, TARNISH_REDUCTION) &&
      inputs.some((s) => SACRIFICIAL.includes(s.formula)) &&
      (hasCategory(inputs, "water") ||
        hasCategory(inputs, "carbonate") ||
        hasAnyFormula(inputs, ELECTROLYTE)),
    build: (inputs) => {
      const anode = inputs.find((s) => SACRIFICIAL.includes(s.formula))!;
      return {
        products: [
          { formula: "Ag", name: "银", category: "metal" as const },
          { formula: `${anode.formula}(OH)3`, name: `氢氧化${anode.name}`, category: "base" as const },
          { formula: "S2-", name: "硫离子", category: "other" as const },
        ],
        producesGas: false,
        // 铝箔表面逐渐蒙上灰黑色的硫化物与氧化物，是可见的固体析出
        producesPrecipitate: true,
        colorChange: true,
        // 需热溶液加速，但反应本身放热微弱，靠外部加热维持
        thermal: "none" as const,
        phTrend: "increase" as const,
        equation: `3Ag₂S + 2${anode.formula} → 6Ag + ${anode.formula}₂S₃（原电池：${anode.formula} - 3e⁻ → ${anode.formula}³⁺；Ag⁺ + e⁻ → Ag）`,
        description: `银器与${anode.name}箔直接接触浸入热碳酸钠溶液，构成原电池：${anode.name}作阳极失电子，银表面的 Ag⁺ 得电子还原成金属银，黑色锈层几分钟内褪去而光泽恢复。硫元素以 S²⁻ 转移到溶液并附着在${anode.name}箔上（箔面变灰黑）。相比摩擦抛光，此法不损失银，是博物馆修复文物的常规手段。`,
      };
    },
  },
];
