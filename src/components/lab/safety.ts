// 操作安全 / 规范反馈（教学增强）：根据容器内试剂给出真实的化学安全提醒，
// 并在混合无反应时给出操作提示。纯函数、数据驱动，与反应引擎解耦。
import type { ReactionResult, SubstanceCategory } from "@/lib/chem/engine";

interface Item {
  formula: string;
  category: SubstanceCategory;
  name: string;
}

// 按化学式给出的精确安全提醒
const FORMULA_NOTES: Record<string, string> = {
  H2SO4: "硫酸具强腐蚀性；稀释浓硫酸务必“酸入水”——将酸缓缓倒入水中并搅拌，切勿相反。",
  HCl: "盐酸有挥发性且腐蚀，操作时注意通风、避免吸入酸雾。",
  HNO3: "硝酸强腐蚀且强氧化性，避免与还原性物质混放。",
  NaOH: "氢氧化钠强碱、强腐蚀，溶解放热，避免接触皮肤与眼睛。",
  KOH: "氢氧化钾强碱、强腐蚀，注意防护。",
  Na: "钠是活泼金属，遇水剧烈放热并放出氢气、易燃，须用镊子取用、煤油中保存。",
  K: "钾比钠更活泼，遇水剧烈反应，取用需格外小心。",
  Cl2: "氯气有毒、有刺激性，必须在通风橱中操作。",
  SO2: "二氧化硫有毒、刺激性气体，需在通风橱中操作。",
  NH3: "氨气有强烈刺激性气味，注意通风、避免吸入。",
  KMnO4: "高锰酸钾为强氧化剂，避免与可燃物、还原剂直接接触。",
  K2Cr2O7: "重铬酸钾有毒且强氧化性，废液需专门回收处理。",
  // —— 以下为原表遗漏的高危物质。审计发现硝酸银(21 个实验)、过氧化氢(16 个)、
  //    溴水(12 个)、铅盐(8 个)等常用试剂一条提醒也没有，而它们恰恰是最容易
  //    出事的一类：学生不认为"看起来像水"的试剂危险 ——
  H2S: "硫化氢剧毒（毒性强于一氧化碳）且有臭鸡蛋味，必须在通风橱中制取，尾气需用碱液吸收。",
  CO: "一氧化碳剧毒且无色无味，尾气必须点燃或收集处理，严禁直接排入室内。",
  NO2: "二氧化氮剧毒、红棕色刺激性气体，须在通风橱操作，尾气用碱液吸收。",
  Br2: "溴水（液溴）剧毒且强腐蚀，蒸气刺激呼吸道与眼睛，只能在通风橱中取用。",
  AgNO3: "硝酸银有腐蚀性，溅到皮肤会形成难以洗去的黑斑，见光易分解须避光保存。",
  H2O2: "过氧化氢有漂白与灼伤作用，高浓度接触皮肤会发白刺痛，避免与还原剂剧烈混合。",
  "Pb(NO3)2": "铅盐为重金属毒物，可累积损害神经系统，操作后须洗手、废液专门回收。",
  C6H5OH: "苯酚有腐蚀性并能经皮吸收中毒，溅到皮肤应立即用酒精擦洗（不可只用水冲）。",
  C6H6: "苯为确认致癌物且易燃，须在通风橱中使用、远离明火。",
  CH3OH: "甲醇剧毒，误服或吸入会损伤视神经导致失明，须通风并严禁品尝。",
  CCl4: "四氯化碳有肝毒性且为可疑致癌物，须通风操作、不可用于灭火加热场合。",
  HF: "氢氟酸剧毒，能腐蚀玻璃并渗入皮肤破坏骨骼，必须用塑料或铅制容器与专用防护。",
  P: "白磷剧毒且在空气中自燃，须浸没在水中保存与切割；红磷相对安全但仍需防燃。",
  Hg: "汞在常温下持续挥发出剧毒蒸气，洒落后须用硫粉覆盖处理，绝不可用吸尘器清理。",
  Cd: "镉为重金属毒物，可蓄积损害肾与骨骼，操作后须洗手、废液与废电极专门回收。",
  // 镁燃烧的强光会灼伤视网膜，这是教材反复强调的一条，而"镁条"本身无腐蚀性，
  // 原表按腐蚀/毒性登记的思路正好会漏掉它
  Mg: "镁燃烧发出的强光会灼伤视网膜，须透过蓝色钴玻璃观察，切勿直视。",
};

/**
 * 组合型危险：单看某一种试剂都不危险，混在一起才需要防护。
 *
 * 铝热反应就是典型 —— 铝粉、氧化铁分开都无害，一旦点燃温度达 2000 ℃ 以上、
 * 熔融铁四射。这类风险按化学式逐个登记必然漏掉，只能按组合判定。
 */
const COMBO_NOTES: { needs: string[]; note: string }[] = [
  {
    needs: ["Al", "Fe2O3"],
    note: "铝热反应温度可达 2000 ℃ 以上并飞溅熔融铁：须在沙盘上进行、远离人员，佩戴护目镜与防护面罩。",
  },
  {
    needs: ["Al", "Fe3O4"],
    note: "铝热反应温度可达 2000 ℃ 以上并飞溅熔融铁：须在沙盘上进行、远离人员，佩戴护目镜与防护面罩。",
  },
];

// 类别兜底提醒（化学式未命中时）
const CATEGORY_NOTES: Partial<Record<SubstanceCategory, string>> = {
  acid: "酸具有腐蚀性，注意防护、避免溅到皮肤和衣物。",
  base: "碱具有腐蚀性，注意防护、避免接触皮肤和眼睛。",
  oxidizer: "氧化剂应避免与还原性物质、可燃物直接接触。",
};

/**
 * 剧毒 / 致癌 / 自燃类物质：提醒必须优先展示，不能被截断掉。
 *
 * safetyNotes 上限 4 条以免刷屏，原先按试剂顺序截断 —— 于是「硫化钠 + 硫酸 +
 * 硫酸铜 + 氢氧化钠」这类四试剂实验里，先命中的酸碱腐蚀提醒会把 H₂S 剧毒
 * 这条挤出去。腐蚀提醒漏掉只是不便，剧毒提醒漏掉是事故。
 */
const CRITICAL = new Set([
  "H2S", "CO", "NO2", "Br2", "HF", "Hg", "P",
  "C6H6", "CH3OH", "CCl4", "Cl2", "SO2", "Pb(NO3)2", "K2Cr2O7",
]);

// 收集当前容器内试剂触发的安全提醒（去重，最多 4 条避免刷屏；剧毒类优先）
export function safetyNotes(contents: Item[]): string[] {
  const seen = new Set<string>();
  const notes: string[] = [];
  // 分两轮：先收剧毒类，再收其余，保证截断时留下的是最要紧的
  for (const pass of [true, false]) {
    for (const c of contents) {
      if (CRITICAL.has(c.formula) !== pass) continue;
      const note = FORMULA_NOTES[c.formula] ?? CATEGORY_NOTES[c.category];
      if (note && !seen.has(note)) {
        seen.add(note);
        notes.push(note);
      }
    }
  }
  const f = new Set(contents.map((c) => c.formula));
  // 组合型危险插到最前：它描述的是"混合后"的风险，比单一试剂的性质更紧要
  for (const { needs, note } of COMBO_NOTES) {
    if (needs.every((x) => f.has(x)) && !seen.has(note)) {
      seen.add(note);
      notes.unshift(note);
    }
  }
  // 浓硫酸 + 水共存：强调“酸入水”
  if (f.has("H2SO4") && f.has("H2O")) {
    const tip = "稀释放热剧烈：必须将浓硫酸缓缓注入水中并不断搅拌，严禁将水倒入浓硫酸！";
    if (!seen.has(tip)) notes.unshift(tip);
  }
  return notes.slice(0, 4);
}

// 混合后无反应时的操作提示
export function operationHint(
  contents: Item[],
  result: ReactionResult | null,
): string | null {
  if (contents.length >= 2 && result && !result.reacted) {
    // 试剂对了只缺加热，与"试剂根本不匹配"要给完全不同的指引：
    // 前者该点酒精灯，后者该换试剂。含糊成一句会把学生引向反方向。
    if (result.pendingCondition === "heat") {
      return "试剂搭配正确，但这个反应需要加热：点燃酒精灯后即可观察到现象。";
    }
    return "当前组合在常温下未发生明显反应。试着更换试剂搭配，或调高温度（部分反应需加热）。";
  }
  return null;
}
